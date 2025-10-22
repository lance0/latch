import { LatchError, LatchErrorCode } from './types';

/**
 * Error suggestion for "Did you mean?" functionality
 */
interface ErrorSuggestion {
  title: string;
  steps: string[];
  example?: string;
  docsUrl?: string;
}

/**
 * Map of error codes to helpful suggestions
 */
const ERROR_SUGGESTIONS: Record<LatchErrorCode, ErrorSuggestion> = {
  LATCH_CLIENT_ID_MISSING: {
    title: 'Missing Azure AD Client ID',
    steps: [
      '1. Go to Azure Portal → App Registrations',
      '2. Select your app or create a new one',
      '3. Copy the "Application (client) ID"',
      '4. Add to your .env file',
    ],
    example: 'LATCH_CLIENT_ID=00000000-0000-0000-0000-000000000000',
    docsUrl: 'https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app',
  },

  LATCH_TENANT_ID_MISSING: {
    title: 'Missing Azure AD Tenant ID',
    steps: [
      '1. Go to Azure Portal → App Registrations',
      '2. Select your app',
      '3. Copy the "Directory (tenant) ID"',
      '4. Add to your .env file',
    ],
    example: 'LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111',
    docsUrl: 'https://learn.microsoft.com/azure/active-directory/fundamentals/how-to-find-tenant',
  },

  LATCH_CLOUD_INVALID: {
    title: 'Invalid Cloud Environment',
    steps: [
      'Set LATCH_CLOUD to one of the following:',
      '  • commercial - Azure Public Cloud (most common)',
      '  • gcc-high - Azure Government GCC-High',
      '  • dod - Azure Government DoD',
    ],
    example: 'LATCH_CLOUD=commercial',
  },

  LATCH_CLOUD_MISMATCH: {
    title: 'Cloud and Scope Mismatch',
    steps: [
      'Your LATCH_CLOUD setting does not match the Graph URL in your scopes',
      'For commercial cloud: use .com endpoints (or omit URL prefix)',
      'For gcc-high/dod: use .us endpoints (or omit URL prefix)',
    ],
    example: `# Commercial
LATCH_CLOUD=commercial
LATCH_SCOPES=openid profile User.Read

# GCC-High
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile User.Read`,
  },

  LATCH_COOKIE_SECRET_MISSING: {
    title: 'Missing Cookie Encryption Secret',
    steps: [
      '1. Generate a secure random secret:',
      '   openssl rand -base64 32',
      '2. Add to your .env file',
      '3. NEVER commit this to git',
    ],
    example: 'LATCH_COOKIE_SECRET=your-generated-secret-here',
  },

  LATCH_STATE_MISSING: {
    title: 'OAuth State Parameter Missing',
    steps: [
      'This usually means:',
      '  • The OAuth callback was called directly (not via /api/latch/start)',
      '  • Cookies are disabled in the browser',
      '  • The PKCE cookie expired (10 min timeout)',
    ],
    example: 'Try starting the flow again by visiting /api/latch/start',
  },

  LATCH_STATE_MISMATCH: {
    title: 'OAuth State Mismatch (CSRF Protection)',
    steps: [
      'This is a security error. Possible causes:',
      '  • Someone is attempting a CSRF attack',
      '  • You opened the callback URL from a different session',
      '  • Cookies were tampered with',
    ],
    example: 'Start a fresh OAuth flow from /api/latch/start',
  },

  LATCH_NONCE_MISSING: {
    title: 'ID Token Nonce Missing',
    steps: [
      'The ID token from Azure AD is missing a nonce claim',
      'This is required for replay attack prevention',
      'Check your Azure AD app registration scopes',
    ],
  },

  LATCH_NONCE_MISMATCH: {
    title: 'ID Token Nonce Mismatch',
    steps: [
      'The nonce in the ID token does not match the expected value',
      'This prevents replay attacks',
      'Try authenticating again from /api/latch/start',
    ],
  },

  LATCH_CODE_MISSING: {
    title: 'OAuth Authorization Code Missing',
    steps: [
      'The callback was called without an authorization code',
      'Possible causes:',
      '  • User denied consent at Azure AD',
      '  • Redirect URI mismatch',
      '  • Invalid Azure AD configuration',
    ],
  },

  LATCH_TOKEN_EXCHANGE_FAILED: {
    title: 'Failed to Exchange Code for Tokens',
    steps: [
      'Could not exchange authorization code for tokens',
      'Common causes:',
      '  • LATCH_CLIENT_ID mismatch with Azure AD',
      '  • LATCH_REDIRECT_URI not registered in Azure AD',
      '  • Code already used (codes are single-use)',
      '  • Network/Azure AD outage',
    ],
    docsUrl: 'https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow',
  },

  LATCH_TOKEN_REFRESH_FAILED: {
    title: 'Token Refresh Failed',
    steps: [
      'Could not refresh access token using refresh token',
      'Possible causes:',
      '  • Refresh token expired (typically 90 days)',
      '  • User revoked consent',
      '  • Azure AD configuration changed',
      '  • Network/Azure AD outage',
    ],
    example: 'User may need to sign in again',
  },

  LATCH_INVALID_RETURN_URL: {
    title: 'Invalid Return URL (Open Redirect Protection)',
    steps: [
      'The returnTo URL failed validation',
      'Only same-origin URLs are allowed',
      'Blocked URL types:',
      '  • Different domains (cross-origin)',
      '  • javascript: or data: URLs',
      '  • Protocol-relative URLs to other domains',
    ],
    example: 'returnTo=/dashboard (relative path only)',
  },

  LATCH_ID_TOKEN_INVALID: {
    title: 'ID Token Validation Failed',
    steps: [
      'The ID token from Azure AD failed JWKS verification',
      'Common causes:',
      '  • Token signature invalid',
      '  • Token expired',
      '  • Audience (aud) claim mismatch',
      '  • Issuer (iss) claim invalid',
    ],
  },

  LATCH_REFRESH_TOKEN_MISSING: {
    title: 'Refresh Token Not Found',
    steps: [
      'No refresh token cookie found',
      'Possible causes:',
      '  • User not authenticated (call /api/latch/start first)',
      '  • Cookie expired (7 day max age)',
      '  • Cookies blocked by browser',
      '  • User cleared cookies',
    ],
    example: 'Redirect user to sign in: /api/latch/start',
  },

  LATCH_ENCRYPTION_FAILED: {
    title: 'Cookie Encryption Failed',
    steps: [
      'Failed to encrypt data for secure cookie',
      'This is an internal error, check:',
      '  • LATCH_COOKIE_SECRET is valid',
      '  • Node.js crypto is available',
    ],
  },

  LATCH_DECRYPTION_FAILED: {
    title: 'Cookie Decryption Failed',
    steps: [
      'Failed to decrypt cookie data',
      'Common causes:',
      '  • Cookie was tampered with (security)',
      '  • LATCH_COOKIE_SECRET changed since cookie was set',
      '  • Corrupted cookie data',
    ],
    example: 'Clear cookies and sign in again',
  },

  LATCH_CONFIG_MISSING: {
    title: 'Configuration Missing',
    steps: [
      'Latch configuration could not be loaded',
      'Ensure your .env file contains:',
      '  • LATCH_CLIENT_ID',
      '  • LATCH_TENANT_ID',
      '  • LATCH_CLOUD',
      '  • LATCH_COOKIE_SECRET',
    ],
    example: 'See .env.example for template',
  },

  LATCH_PKCE_MISSING: {
    title: 'PKCE Data Missing',
    steps: [
      'PKCE cookie not found during OAuth callback',
      'This cookie is set when you visit /api/latch/start',
      'Possible causes:',
      '  • Cookies disabled',
      '  • PKCE cookie expired (10 min timeout)',
      '  • Cookie cleared by browser',
    ],
  },
};

/**
 * Create an enhanced LatchError with helpful suggestions
 */
export function createLatchError(
  code: LatchErrorCode,
  customMessage?: string,
  details?: unknown
): LatchError {
  const suggestion = ERROR_SUGGESTIONS[code];

  // Build enhanced message
  let message = customMessage || suggestion.title;

  if (suggestion) {
    message += '\n\n';
    message += suggestion.steps.join('\n');

    if (suggestion.example) {
      message += '\n\nExample:\n' + suggestion.example;
    }

    if (suggestion.docsUrl) {
      message += '\n\nDocs: ' + suggestion.docsUrl;
    }
  }

  return new LatchError(code, message, details);
}

/**
 * Format error for logging (sanitized, no tokens)
 */
export function formatErrorForLog(error: unknown): string {
  if (error instanceof LatchError) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return `[${error.name}] ${error.message}`;
  }

  return String(error);
}

/**
 * Check if error is a known Latch error
 */
export function isLatchError(error: unknown): error is LatchError {
  return error instanceof LatchError;
}

/**
 * Get user-safe error message (no sensitive data)
 */
export function getUserSafeErrorMessage(error: unknown): string {
  if (error instanceof LatchError) {
    const suggestion = ERROR_SUGGESTIONS[error.code];
    return suggestion?.title || 'Authentication error';
  }

  return 'An unexpected error occurred';
}

/**
 * Validate UUID format (for Client ID, Tenant ID)
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validate environment configuration on startup
 * Throws enhanced errors with suggestions
 */
export function validateLatchConfig(config: {
  clientId?: string;
  tenantId?: string;
  cloud?: string;
  cookieSecret?: string;
  scopes?: string[];
}): void {
  // Client ID validation
  if (!config.clientId) {
    throw createLatchError('LATCH_CLIENT_ID_MISSING');
  }

  if (!isValidUUID(config.clientId)) {
    throw createLatchError(
      'LATCH_CLIENT_ID_MISSING',
      'LATCH_CLIENT_ID must be a valid UUID (Application ID from Azure AD)\n\n' +
      'Your current value does not look like a valid GUID.\n' +
      'Expected format: 00000000-0000-0000-0000-000000000000\n\n' +
      'Steps to fix:\n' +
      '1. Go to Azure Portal → App Registrations\n' +
      '2. Copy the "Application (client) ID" (should be a UUID)\n' +
      '3. Update LATCH_CLIENT_ID in your .env file'
    );
  }

  // Tenant ID validation
  if (!config.tenantId) {
    throw createLatchError('LATCH_TENANT_ID_MISSING');
  }

  if (!isValidUUID(config.tenantId)) {
    throw createLatchError(
      'LATCH_TENANT_ID_MISSING',
      'LATCH_TENANT_ID must be a valid UUID (Directory ID from Azure AD)\n\n' +
      'Your current value does not look like a valid GUID.\n' +
      'Expected format: 11111111-1111-1111-1111-111111111111\n\n' +
      'Steps to fix:\n' +
      '1. Go to Azure Portal → App Registrations\n' +
      '2. Copy the "Directory (tenant) ID" (should be a UUID)\n' +
      '3. Update LATCH_TENANT_ID in your .env file'
    );
  }

  // Cloud validation
  const validClouds = ['commercial', 'gcc-high', 'dod'];
  if (!config.cloud) {
    throw createLatchError('LATCH_CLOUD_INVALID');
  }

  if (!validClouds.includes(config.cloud)) {
    // Did you mean? suggestion
    const similar = findSimilarString(config.cloud, validClouds);
    const didYouMean = similar ? `\n\nDid you mean "${similar}"?` : '';

    throw createLatchError(
      'LATCH_CLOUD_INVALID',
      `LATCH_CLOUD must be one of: ${validClouds.join(', ')}\n` +
      `You provided: "${config.cloud}"${didYouMean}\n\n` +
      'Valid options:\n' +
      '  • commercial - Azure Public Cloud (most common)\n' +
      '  • gcc-high - Azure Government GCC-High\n' +
      '  • dod - Azure Government DoD'
    );
  }

  // Cookie secret validation
  if (!config.cookieSecret) {
    throw createLatchError('LATCH_COOKIE_SECRET_MISSING');
  }

  if (config.cookieSecret.length < 32) {
    throw createLatchError(
      'LATCH_COOKIE_SECRET_MISSING',
      'LATCH_COOKIE_SECRET is too short (minimum 32 characters)\n\n' +
      `Current length: ${config.cookieSecret.length} characters\n` +
      'Security requirement: At least 32 characters\n\n' +
      'Generate a secure secret:\n' +
      '  openssl rand -base64 32\n\n' +
      'Then update your .env file'
    );
  }

  // Warn about weak secrets (common patterns)
  const weakPatterns = ['test', 'secret', 'password', '123', 'abc'];
  const lowerSecret = config.cookieSecret.toLowerCase();
  const foundWeak = weakPatterns.find(p => lowerSecret.includes(p));

  if (foundWeak && process.env.NODE_ENV === 'production') {
    console.warn(
      '[Latch] WARNING: LATCH_COOKIE_SECRET appears to contain common pattern "' + foundWeak + '".\n' +
      'For production, use a cryptographically random secret:\n' +
      '  openssl rand -base64 32'
    );
  }
}

/**
 * Find similar string using Levenshtein distance
 * For "Did you mean?" suggestions
 */
function findSimilarString(input: string, candidates: string[]): string | null {
  if (!input) return null;

  const distances = candidates.map(candidate => ({
    candidate,
    distance: levenshteinDistance(input.toLowerCase(), candidate.toLowerCase()),
  }));

  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest if distance is <= 3 (reasonable typo)
  return distances[0] && distances[0].distance <= 3 ? distances[0].candidate : null;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}
