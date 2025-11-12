import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Parse KEY=VALUE
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key] = value;
    }
  }
  
  return env;
}

/**
 * Validate LATCH_CLIENT_ID format
 */
function validateClientId(value: string | undefined): ValidationIssue | null {
  if (!value) {
    return {
      level: 'error',
      field: 'LATCH_CLIENT_ID',
      message: 'Required field is missing',
      suggestion: 'Get this from your Azure AD app registration (Application ID)',
    };
  }
  
  if (!UUID_REGEX.test(value)) {
    return {
      level: 'error',
      field: 'LATCH_CLIENT_ID',
      message: 'Invalid UUID format',
      suggestion: 'Should be: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    };
  }
  
  return null;
}

/**
 * Validate LATCH_TENANT_ID format
 */
function validateTenantId(value: string | undefined): ValidationIssue | null {
  if (!value) {
    return {
      level: 'error',
      field: 'LATCH_TENANT_ID',
      message: 'Required field is missing',
      suggestion: 'Get this from your Azure AD (Directory ID)',
    };
  }
  
  if (!UUID_REGEX.test(value)) {
    return {
      level: 'error',
      field: 'LATCH_TENANT_ID',
      message: 'Invalid UUID format',
      suggestion: 'Should be: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    };
  }
  
  return null;
}

/**
 * Validate LATCH_CLOUD value
 */
function validateCloud(value: string | undefined): ValidationIssue | null {
  if (!value) {
    return {
      level: 'error',
      field: 'LATCH_CLOUD',
      message: 'Required field is missing',
      suggestion: 'Valid values: commercial, gcc-high, dod',
    };
  }
  
  const validClouds = ['commercial', 'gcc-high', 'dod'];
  if (!validClouds.includes(value)) {
    return {
      level: 'error',
      field: 'LATCH_CLOUD',
      message: `Invalid cloud value: ${value}`,
      suggestion: `Valid values: ${validClouds.join(', ')}`,
    };
  }
  
  return null;
}

/**
 * Validate LATCH_SCOPES for cloud mismatches
 */
function validateScopes(scopes: string | undefined, cloud: string | undefined): ValidationIssue | null {
  if (!scopes) {
    return {
      level: 'error',
      field: 'LATCH_SCOPES',
      message: 'Required field is missing',
      suggestion: 'At minimum: openid profile email',
    };
  }
  
  // Check for cloud/scope mismatches
  if (cloud === 'gcc-high' || cloud === 'dod') {
    if (scopes.includes('graph.microsoft.com')) {
      return {
        level: 'error',
        field: 'LATCH_SCOPES',
        message: 'Commercial Graph URL in government cloud',
        suggestion: 'Use scope names without URLs (e.g., "User.Read") or use .us endpoints',
      };
    }
  }
  
  if (cloud === 'commercial') {
    if (scopes.includes('graph.microsoft.us')) {
      return {
        level: 'error',
        field: 'LATCH_SCOPES',
        message: 'Government Graph URL in commercial cloud',
        suggestion: 'Use scope names without URLs (e.g., "User.Read") or use .com endpoints',
      };
    }
  }
  
  // Check for common scope
  if (!scopes.includes('openid')) {
    return {
      level: 'warning',
      field: 'LATCH_SCOPES',
      message: 'Missing "openid" scope',
      suggestion: 'Add "openid" to scopes for OIDC authentication',
    };
  }
  
  return null;
}

/**
 * Validate LATCH_REDIRECT_URI format
 */
function validateRedirectUri(value: string | undefined): ValidationIssue | null {
  if (!value) {
    return {
      level: 'error',
      field: 'LATCH_REDIRECT_URI',
      message: 'Required field is missing',
      suggestion: 'Example: http://localhost:3000/api/latch/callback',
    };
  }
  
  try {
    const url = new URL(value);
    
    // Check if callback path is correct
    if (!url.pathname.includes('/api/latch/callback')) {
      return {
        level: 'warning',
        field: 'LATCH_REDIRECT_URI',
        message: 'Redirect URI should point to callback route',
        suggestion: 'Path should end with: /api/latch/callback',
      };
    }
  } catch {
    return {
      level: 'error',
      field: 'LATCH_REDIRECT_URI',
      message: 'Invalid URL format',
      suggestion: 'Must be a valid URL (e.g., http://localhost:3000/api/latch/callback)',
    };
  }
  
  return null;
}

/**
 * Validate LATCH_COOKIE_SECRET
 */
function validateCookieSecret(value: string | undefined): ValidationIssue | null {
  if (!value) {
    return {
      level: 'error',
      field: 'LATCH_COOKIE_SECRET',
      message: 'Required field is missing',
      suggestion: 'Generate one with: latch generate-secret',
    };
  }
  
  // Check if it's a placeholder
  const placeholders = ['your-secret-here', 'your-32-byte-secret-here', 'REPLACE_WITH_GENERATED_SECRET'];
  if (placeholders.some(p => value.includes(p))) {
    return {
      level: 'error',
      field: 'LATCH_COOKIE_SECRET',
      message: 'Placeholder value detected',
      suggestion: 'Generate a real secret with: latch generate-secret',
    };
  }
  
  // Check length (base64 of 32 bytes should be ~44 chars)
  if (value.length < 32) {
    return {
      level: 'warning',
      field: 'LATCH_COOKIE_SECRET',
      message: 'Secret might be too short',
      suggestion: 'Use at least 32 bytes (base64 encoded ~44 chars)',
    };
  }
  
  return null;
}

/**
 * Validate optional security settings
 */
function validateSecuritySettings(env: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (env.LATCH_CLOCK_SKEW_TOLERANCE) {
    const value = parseInt(env.LATCH_CLOCK_SKEW_TOLERANCE, 10);
    if (isNaN(value) || value < 0) {
      issues.push({
        level: 'error',
        field: 'LATCH_CLOCK_SKEW_TOLERANCE',
        message: 'Must be a positive integer (seconds)',
        suggestion: 'Default: 60 (60 seconds)',
      });
    } else if (value > 300) {
      issues.push({
        level: 'warning',
        field: 'LATCH_CLOCK_SKEW_TOLERANCE',
        message: 'Clock skew tolerance is very high',
        suggestion: 'Values > 300 seconds may pose security risks',
      });
    }
  }
  
  if (env.LATCH_JWKS_CACHE_TTL) {
    const value = parseInt(env.LATCH_JWKS_CACHE_TTL, 10);
    if (isNaN(value) || value < 0) {
      issues.push({
        level: 'error',
        field: 'LATCH_JWKS_CACHE_TTL',
        message: 'Must be a positive integer (seconds)',
        suggestion: 'Default: 3600 (1 hour)',
      });
    } else if (value < 300) {
      issues.push({
        level: 'warning',
        field: 'LATCH_JWKS_CACHE_TTL',
        message: 'JWKS cache TTL is very low',
        suggestion: 'Low values increase API calls to Azure AD',
      });
    }
  }
  
  return issues;
}

/**
 * Validate .env.local configuration
 */
export async function validate(): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Latch Configuration Validator\n'));

  const envPath = join(process.cwd(), '.env.local');

  // Check if .env.local exists
  if (!existsSync(envPath)) {
    console.error(chalk.red('✗ .env.local not found'));
    console.log(chalk.dim('  Run: latch init'));
    process.exit(1);
  }

  try {
    // Read and parse .env.local
    const content = await readFile(envPath, 'utf-8');
    const env = parseEnvFile(content);

    const issues: ValidationIssue[] = [];

    // Validate required fields
    const clientIdIssue = validateClientId(env.LATCH_CLIENT_ID);
    if (clientIdIssue) issues.push(clientIdIssue);

    const tenantIdIssue = validateTenantId(env.LATCH_TENANT_ID);
    if (tenantIdIssue) issues.push(tenantIdIssue);

    const cloudIssue = validateCloud(env.LATCH_CLOUD);
    if (cloudIssue) issues.push(cloudIssue);

    const scopesIssue = validateScopes(env.LATCH_SCOPES, env.LATCH_CLOUD);
    if (scopesIssue) issues.push(scopesIssue);

    const redirectIssue = validateRedirectUri(env.LATCH_REDIRECT_URI);
    if (redirectIssue) issues.push(redirectIssue);

    const secretIssue = validateCookieSecret(env.LATCH_COOKIE_SECRET);
    if (secretIssue) issues.push(secretIssue);

    // Validate security settings
    const securityIssues = validateSecuritySettings(env);
    issues.push(...securityIssues);

    // Report issues
    if (issues.length === 0) {
      console.log(chalk.green('✓ Configuration is valid!'));
      console.log();
      console.log(chalk.bold('Configuration:'));
      console.log(chalk.dim(`  Cloud: ${env.LATCH_CLOUD || 'not set'}`));
      console.log(chalk.dim(`  Client ID: ${env.LATCH_CLIENT_ID ? '✓ set' : '✗ missing'}`));
      console.log(chalk.dim(`  Tenant ID: ${env.LATCH_TENANT_ID ? '✓ set' : '✗ missing'}`));
      console.log(chalk.dim(`  Scopes: ${env.LATCH_SCOPES || 'not set'}`));
      console.log();
      return;
    }

    // Group issues by level
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    const infos = issues.filter(i => i.level === 'info');

    // Print errors
    if (errors.length > 0) {
      console.log(chalk.red.bold(`✗ ${errors.length} error(s) found:\n`));
      for (const issue of errors) {
        console.log(chalk.red(`  ${issue.field}:`));
        console.log(chalk.dim(`    ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.yellow(`    → ${issue.suggestion}`));
        }
        console.log();
      }
    }

    // Print warnings
    if (warnings.length > 0) {
      console.log(chalk.yellow.bold(`⚠ ${warnings.length} warning(s) found:\n`));
      for (const issue of warnings) {
        console.log(chalk.yellow(`  ${issue.field}:`));
        console.log(chalk.dim(`    ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.cyan(`    → ${issue.suggestion}`));
        }
        console.log();
      }
    }

    // Print info
    if (infos.length > 0) {
      console.log(chalk.cyan.bold(`ℹ ${infos.length} suggestion(s):\n`));
      for (const issue of infos) {
        console.log(chalk.cyan(`  ${issue.field}:`));
        console.log(chalk.dim(`    ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.dim(`    → ${issue.suggestion}`));
        }
        console.log();
      }
    }

    // Exit with error if there are errors
    if (errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Error reading .env.local:'), error);
    process.exit(1);
  }
}
