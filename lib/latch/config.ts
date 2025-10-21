import { LatchConfig, LatchCloud, AzureEndpoints } from './types';
import { validateLatchConfig, createLatchError } from './errors';

/**
 * Get Latch configuration from environment variables
 * Validates all required fields and provides helpful error messages
 */
export function getLatchConfig(): LatchConfig {
  const clientId = process.env.LATCH_CLIENT_ID;
  const tenantId = process.env.LATCH_TENANT_ID;
  const cloud = process.env.LATCH_CLOUD as LatchCloud | undefined;
  const scopes = process.env.LATCH_SCOPES?.split(' ');
  const redirectUri = process.env.LATCH_REDIRECT_URI;
  const cookieSecret = process.env.LATCH_COOKIE_SECRET;
  const debug = process.env.LATCH_DEBUG === 'true';

  // Validate configuration with enhanced error messages
  validateLatchConfig({
    clientId,
    tenantId,
    cloud,
    cookieSecret,
    scopes,
  });

  // TypeScript knows these are defined after validation
  const validatedConfig = {
    clientId: clientId!,
    tenantId: tenantId!,
    cloud: cloud as LatchCloud,
    scopes: scopes || ['openid', 'profile', 'User.Read'],
    redirectUri:
      redirectUri || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/latch/callback`,
    cookieSecret: cookieSecret!,
    debug,
  };

  // Validate scopes match cloud environment
  validateScopes(validatedConfig.scopes, validatedConfig.cloud);

  // Debug logging
  if (debug) {
    console.log('[Latch] Configuration loaded successfully');
    console.log(`[Latch] Cloud: ${validatedConfig.cloud}`);
    console.log(`[Latch] Scopes: ${validatedConfig.scopes.join(' ')}`);
    console.log(`[Latch] Redirect URI: ${validatedConfig.redirectUri}`);
  }

  return validatedConfig;
}

/**
 * Get Azure AD endpoints based on cloud environment
 */
export function getAzureEndpoints(cloud: LatchCloud, tenantId: string): AzureEndpoints {
  let loginBaseUrl: string;
  let graphBaseUrl: string;

  switch (cloud) {
    case 'commercial':
      loginBaseUrl = 'https://login.microsoftonline.com';
      graphBaseUrl = 'https://graph.microsoft.com';
      break;
    case 'gcc-high':
      loginBaseUrl = 'https://login.microsoftonline.us';
      graphBaseUrl = 'https://graph.microsoft.us';
      break;
    case 'dod':
      loginBaseUrl = 'https://login.microsoftonline.us';
      graphBaseUrl = 'https://dod-graph.microsoft.us';
      break;
  }

  const authorizeUrl = `${loginBaseUrl}/${tenantId}/oauth2/v2.0/authorize`;
  const tokenUrl = `${loginBaseUrl}/${tenantId}/oauth2/v2.0/token`;
  const logoutUrl = `${loginBaseUrl}/${tenantId}/oauth2/v2.0/logout`;
  const jwksUri = `${loginBaseUrl}/${tenantId}/discovery/v2.0/keys`;

  return {
    loginBaseUrl,
    graphBaseUrl,
    authorizeUrl,
    tokenUrl,
    logoutUrl,
    jwksUri,
  };
}

/**
 * Validate that scopes are appropriate for the cloud environment
 */
export function validateScopes(scopes: string[], cloud: LatchCloud): void {
  const scopeString = scopes.join(' ').toLowerCase();

  // Check for commercial endpoints in Gov clouds
  if ((cloud === 'gcc-high' || cloud === 'dod') && scopeString.includes('graph.microsoft.com')) {
    throw createLatchError(
      'LATCH_CLOUD_MISMATCH',
      `Cloud/Scope Mismatch: LATCH_CLOUD is set to '${cloud}' but scopes contain .com Graph URL\n\n` +
      'Government clouds (gcc-high, dod) require .us endpoints.\n\n' +
      'Fix by using simple scope names (recommended):\n' +
      '  LATCH_SCOPES=openid profile User.Read\n\n' +
      'Or use explicit .us URLs:\n' +
      '  LATCH_SCOPES=openid profile https://graph.microsoft.us/User.Read\n\n' +
      `Current scopes: ${scopes.join(' ')}`
    );
  }

  // Check for Gov endpoints in commercial cloud
  if (cloud === 'commercial' && scopeString.includes('graph.microsoft.us')) {
    throw createLatchError(
      'LATCH_CLOUD_MISMATCH',
      `Cloud/Scope Mismatch: LATCH_CLOUD is set to 'commercial' but scopes contain .us Graph URL\n\n` +
      'Commercial cloud requires .com endpoints.\n\n' +
      'Fix by using simple scope names (recommended):\n' +
      '  LATCH_SCOPES=openid profile User.Read\n\n' +
      'Or use explicit .com URLs:\n' +
      '  LATCH_SCOPES=openid profile https://graph.microsoft.com/User.Read\n\n' +
      `Current scopes: ${scopes.join(' ')}`
    );
  }
}

/**
 * Cookie configuration
 */
export const COOKIE_NAMES = {
  REFRESH_TOKEN: 'latch_rt',
  PKCE_DATA: 'latch_pkce',
  ID_TOKEN: 'latch_id',
} as const;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
