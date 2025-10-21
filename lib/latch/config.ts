import { LatchConfig, LatchCloud, LatchError, AzureEndpoints } from './types';

/**
 * Get Latch configuration from environment variables
 */
export function getLatchConfig(): LatchConfig {
  const clientId = process.env.LATCH_CLIENT_ID;
  const tenantId = process.env.LATCH_TENANT_ID;
  const cloud = process.env.LATCH_CLOUD as LatchCloud | undefined;
  const scopes = process.env.LATCH_SCOPES?.split(' ');
  const redirectUri = process.env.LATCH_REDIRECT_URI;
  const cookieSecret = process.env.LATCH_COOKIE_SECRET;
  const debug = process.env.LATCH_DEBUG === 'true';

  if (!clientId) {
    throw new LatchError(
      'LATCH_CLIENT_ID_MISSING',
      'LATCH_CLIENT_ID environment variable is required'
    );
  }

  if (!tenantId) {
    throw new LatchError(
      'LATCH_TENANT_ID_MISSING',
      'LATCH_TENANT_ID environment variable is required'
    );
  }

  if (!cloud || !['commercial', 'gcc-high', 'dod'].includes(cloud)) {
    throw new LatchError(
      'LATCH_CLOUD_INVALID',
      'LATCH_CLOUD must be one of: commercial, gcc-high, dod'
    );
  }

  if (!cookieSecret) {
    throw new LatchError(
      'LATCH_COOKIE_SECRET_MISSING',
      'LATCH_COOKIE_SECRET environment variable is required. Generate with: openssl rand -base64 32'
    );
  }

  return {
    clientId,
    tenantId,
    cloud,
    scopes: scopes || ['openid', 'profile', 'User.Read'],
    redirectUri:
      redirectUri || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/latch/callback`,
    cookieSecret,
    debug,
  };
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
    throw new LatchError(
      'LATCH_CLOUD_MISMATCH',
      `Cloud is set to '${cloud}' but scopes contain commercial Graph URL (.com). Use appropriate .us endpoints.`
    );
  }

  // Check for Gov endpoints in commercial cloud
  if (cloud === 'commercial' && scopeString.includes('graph.microsoft.us')) {
    throw new LatchError(
      'LATCH_CLOUD_MISMATCH',
      `Cloud is set to 'commercial' but scopes contain Government Graph URL (.us). Use .com endpoints.`
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
