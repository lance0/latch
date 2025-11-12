import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  suggestion?: string;
}

/**
 * Check if file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if .env.local exists
 */
async function checkEnvFile(): Promise<DiagnosticResult> {
  const envPath = join(process.cwd(), '.env.local');
  const exists = await fileExists(envPath);

  if (exists) {
    return {
      name: 'Configuration File',
      status: 'pass',
      message: '.env.local found',
    };
  }

  return {
    name: 'Configuration File',
    status: 'fail',
    message: '.env.local not found',
    suggestion: 'Run: latch init',
  };
}

/**
 * Check if Next.js is installed
 */
async function checkNextJs(): Promise<DiagnosticResult> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  if (!await fileExists(packageJsonPath)) {
    return {
      name: 'Next.js Project',
      status: 'fail',
      message: 'package.json not found',
      suggestion: 'Run this command from your Next.js project root',
    };
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    const hasNext = packageJson.dependencies?.next || packageJson.devDependencies?.next;
    
    if (hasNext) {
      const version = packageJson.dependencies?.next || packageJson.devDependencies?.next;
      return {
        name: 'Next.js Project',
        status: 'pass',
        message: `Next.js ${version} detected`,
      };
    }

    return {
      name: 'Next.js Project',
      status: 'fail',
      message: 'Next.js not found in dependencies',
      suggestion: 'Install Next.js: npm install next',
    };
  } catch (error) {
    return {
      name: 'Next.js Project',
      status: 'fail',
      message: 'Could not read package.json',
    };
  }
}

/**
 * Check if @lance0/latch is installed
 */
async function checkLatchPackage(): Promise<DiagnosticResult> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    const latchVersion = packageJson.dependencies?.['@lance0/latch'];
    
    if (latchVersion) {
      return {
        name: 'Latch Package',
        status: 'pass',
        message: `@lance0/latch ${latchVersion} installed`,
      };
    }

    return {
      name: 'Latch Package',
      status: 'fail',
      message: '@lance0/latch not found in dependencies',
      suggestion: 'Install: npm install @lance0/latch',
    };
  } catch (error) {
    return {
      name: 'Latch Package',
      status: 'warning',
      message: 'Could not check package installation',
    };
  }
}

/**
 * Check if API routes exist
 */
async function checkApiRoutes(): Promise<DiagnosticResult> {
  const routes = [
    'app/api/latch/start/route.ts',
    'app/api/latch/callback/route.ts',
    'app/api/latch/session/route.ts',
    'app/api/latch/refresh/route.ts',
    'app/api/latch/logout/route.ts',
  ];

  const jsRoutes = routes.map(r => r.replace('.ts', '.js'));
  
  let foundCount = 0;
  for (const route of routes) {
    const tsPath = join(process.cwd(), route);
    const jsPath = join(process.cwd(), route.replace('.ts', '.js'));
    
    if (await fileExists(tsPath) || await fileExists(jsPath)) {
      foundCount++;
    }
  }

  if (foundCount === routes.length) {
    return {
      name: 'API Routes',
      status: 'pass',
      message: 'All 5 required routes found',
    };
  }

  if (foundCount > 0) {
    return {
      name: 'API Routes',
      status: 'warning',
      message: `Only ${foundCount}/5 routes found`,
      suggestion: 'Run: latch scaffold',
    };
  }

  return {
    name: 'API Routes',
    status: 'fail',
    message: 'No API routes found',
    suggestion: 'Run: latch scaffold',
  };
}

/**
 * Check if LatchProvider exists in layout
 */
async function checkLatchProvider(): Promise<DiagnosticResult> {
  const layoutPaths = [
    'app/layout.tsx',
    'app/layout.ts',
    'app/layout.jsx',
    'app/layout.js',
  ];

  for (const layoutPath of layoutPaths) {
    const fullPath = join(process.cwd(), layoutPath);
    
    if (await fileExists(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8');
        
        if (content.includes('LatchProvider')) {
          return {
            name: 'LatchProvider',
            status: 'pass',
            message: 'LatchProvider found in layout',
          };
        }

        return {
          name: 'LatchProvider',
          status: 'warning',
          message: 'Layout found but LatchProvider not detected',
          suggestion: 'Import and use <LatchProvider> in your root layout',
        };
      } catch {
        // Continue to next file
      }
    }
  }

  return {
    name: 'LatchProvider',
    status: 'fail',
    message: 'No app/layout file found',
    suggestion: 'Create app/layout.tsx with <LatchProvider>',
  };
}

/**
 * Check cookie secret strength
 */
async function checkCookieSecret(): Promise<DiagnosticResult> {
  const envPath = join(process.cwd(), '.env.local');
  
  if (!await fileExists(envPath)) {
    return {
      name: 'Cookie Secret',
      status: 'fail',
      message: '.env.local not found',
      suggestion: 'Run: latch init',
    };
  }

  try {
    const content = await readFile(envPath, 'utf-8');
    const match = content.match(/LATCH_COOKIE_SECRET=(.+)/);
    
    if (!match) {
      return {
        name: 'Cookie Secret',
        status: 'fail',
        message: 'LATCH_COOKIE_SECRET not found',
        suggestion: 'Run: latch generate-secret',
      };
    }

    const secret = match[1].trim();
    
    // Check for placeholders
    const placeholders = ['your-secret', 'REPLACE_WITH'];
    if (placeholders.some(p => secret.includes(p))) {
      return {
        name: 'Cookie Secret',
        status: 'fail',
        message: 'Placeholder value detected',
        suggestion: 'Run: latch generate-secret',
      };
    }

    // Check length
    if (secret.length < 32) {
      return {
        name: 'Cookie Secret',
        status: 'warning',
        message: 'Cookie secret may be too weak',
        suggestion: 'Use at least 32 bytes (base64: ~44 chars)',
      };
    }

    return {
      name: 'Cookie Secret',
      status: 'pass',
      message: 'Cookie secret looks good',
    };

  } catch {
    return {
      name: 'Cookie Secret',
      status: 'warning',
      message: 'Could not verify cookie secret',
    };
  }
}

/**
 * Check for common configuration issues
 */
async function checkCommonIssues(): Promise<DiagnosticResult> {
  const envPath = join(process.cwd(), '.env.local');
  
  if (!await fileExists(envPath)) {
    return {
      name: 'Configuration Issues',
      status: 'warning',
      message: 'Cannot check - .env.local not found',
    };
  }

  try {
    const content = await readFile(envPath, 'utf-8');
    const issues: string[] = [];

    // Check for NEXTAUTH_URL (common mistake from NextAuth migration)
    if (content.includes('NEXTAUTH_URL') && !content.includes('LATCH_REDIRECT_URI')) {
      issues.push('Found NEXTAUTH_URL but missing LATCH_REDIRECT_URI');
    }

    // Check for missing required vars
    const required = ['LATCH_CLIENT_ID', 'LATCH_TENANT_ID', 'LATCH_CLOUD', 'LATCH_SCOPES'];
    for (const varName of required) {
      if (!content.includes(`${varName}=`)) {
        issues.push(`Missing ${varName}`);
      }
    }

    if (issues.length > 0) {
      return {
        name: 'Configuration Issues',
        status: 'warning',
        message: `${issues.length} issue(s) found`,
        suggestion: 'Run: latch validate',
      };
    }

    return {
      name: 'Configuration Issues',
      status: 'pass',
      message: 'No obvious issues detected',
    };

  } catch {
    return {
      name: 'Configuration Issues',
      status: 'warning',
      message: 'Could not check configuration',
    };
  }
}

/**
 * Run diagnostic checks on Latch setup
 */
export async function doctor(): Promise<void> {
  console.log(chalk.bold.cyan('\n🩺 Latch Doctor\n'));
  console.log(chalk.dim('Running diagnostics...\n'));

  // Run all checks
  const results: DiagnosticResult[] = [];

  results.push(await checkNextJs());
  results.push(await checkLatchPackage());
  results.push(await checkEnvFile());
  results.push(await checkCookieSecret());
  results.push(await checkApiRoutes());
  results.push(await checkLatchProvider());
  results.push(await checkCommonIssues());

  // Print results
  let hasFailures = false;
  let hasWarnings = false;

  for (const result of results) {
    let icon: string;
    let color: typeof chalk.green;

    switch (result.status) {
      case 'pass':
        icon = '✓';
        color = chalk.green;
        break;
      case 'warning':
        icon = '⚠';
        color = chalk.yellow;
        hasWarnings = true;
        break;
      case 'fail':
        icon = '✗';
        color = chalk.red;
        hasFailures = true;
        break;
    }

    console.log(color(`${icon} ${result.name}`));
    console.log(chalk.dim(`  ${result.message}`));
    
    if (result.suggestion) {
      console.log(chalk.cyan(`  → ${result.suggestion}`));
    }
    
    console.log();
  }

  // Summary
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warning').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ✓ ${passCount} passed`));
  if (warnCount > 0) console.log(chalk.yellow(`  ⚠ ${warnCount} warnings`));
  if (failCount > 0) console.log(chalk.red(`  ✗ ${failCount} failed`));
  console.log();

  if (hasFailures) {
    console.log(chalk.red('⚠ Please address the failures above before using Latch'));
    console.log();
    process.exit(1);
  }

  if (hasWarnings) {
    console.log(chalk.yellow('⚠ Your setup has warnings but should work'));
    console.log();
  } else if (!hasFailures) {
    console.log(chalk.green('✓ Your Latch setup looks good!'));
    console.log();
  }
}
