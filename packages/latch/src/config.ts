import { NextResponse } from 'next/server';
import { LatchConfig, LatchCloud, AzureEndpoints, ClientCertificate, TokenCacheOptions } from './types';
import { validateLatchConfig, createLatchError } from './errors';

/**
 * Get Latch configuration from environment variables
 * Validates all required fields and provides helpful error messages
 */
export function getLatchConfig(): LatchConfig {
  const clientId = process.env.LATCH_CLIENT_ID;
  const tenantId = process.env.LATCH_TENANT_ID;
  const clientSecret = process.env.LATCH_CLIENT_SECRET;
  const cloud = process.env.LATCH_CLOUD as LatchCloud | undefined;
  const scopes = process.env.LATCH_SCOPES?.split(' ');
  const redirectUri = process.env.LATCH_REDIRECT_URI;
  const cookieSecret = process.env.LATCH_COOKIE_SECRET;
  const debug = process.env.LATCH_DEBUG === 'true';

  // Parse security settings (optional)
  const clockSkewTolerance = process.env.LATCH_CLOCK_SKEW_TOLERANCE
    ? parseInt(process.env.LATCH_CLOCK_SKEW_TOLERANCE, 10)
    : 60; // Default: 60 seconds

  const jwksCacheTTL = process.env.LATCH_JWKS_CACHE_TTL
    ? parseInt(process.env.LATCH_JWKS_CACHE_TTL, 10)
    : 3600; // Default: 1 hour

  // Parse client certificate (optional - alternative to client secret)
  let clientCertificate: ClientCertificate | undefined;
  const certPrivateKey = process.env.LATCH_CERTIFICATE_PRIVATE_KEY;
  const certThumbprint = process.env.LATCH_CERTIFICATE_THUMBPRINT;
  const certX5c = process.env.LATCH_CERTIFICATE_X5C;
  const certKid = process.env.LATCH_CERTIFICATE_KID;

  if (certPrivateKey && certThumbprint) {
    clientCertificate = {
      privateKey: certPrivateKey,
      thumbprint: certThumbprint,
      x5c: certX5c ? parseX5cCertChain(certX5c) : undefined,
      kid: certKid || undefined,
    };

    if (debug) {
      console.log('[Latch] Client certificate configured');
      console.log(`[Latch] Certificate thumbprint: ${certThumbprint.substring(0, 8)}...`);
      if (certKid) {
        console.log(`[Latch] Certificate key ID: ${certKid}`);
      }
    }
  } else if (certPrivateKey || certThumbprint) {
    throw createLatchError(
      'LATCH_CONFIG_MISSING',
      'Incomplete certificate configuration. Both LATCH_CERTIFICATE_PRIVATE_KEY and LATCH_CERTIFICATE_THUMBPRINT are required.\n\n' +
      'For certificate authentication, set:\n' +
      '  LATCH_CERTIFICATE_PRIVATE_KEY=<PEM private key>\n' +
      '  LATCH_CERTIFICATE_THUMBPRINT=<SHA-1 thumbprint>\n' +
      '  LATCH_CERTIFICATE_X5C=<base64 cert chain> (optional)\n' +
      '  LATCH_CERTIFICATE_KID=<key ID> (optional, for multi-cert scenarios)'
    );
  }

  // Parse allowed audiences for OBO (optional)
  const allowedAudiences = process.env.LATCH_ALLOWED_AUDIENCES
    ? process.env.LATCH_ALLOWED_AUDIENCES.split(',').map(a => a.trim()).filter(Boolean)
    : undefined;

  // Parse OBO cache options (optional)
  let oboCache: TokenCacheOptions | undefined;
  const cacheEnabled = process.env.LATCH_OBO_CACHE_ENABLED;
  const cacheTtlBuffer = process.env.LATCH_OBO_CACHE_TTL_BUFFER_SECONDS;
  const cacheMaxSize = process.env.LATCH_OBO_CACHE_MAX_SIZE;

  if (cacheEnabled !== undefined || cacheTtlBuffer || cacheMaxSize) {
    oboCache = {
      enabled: cacheEnabled === 'true',
      ttlBufferSeconds: cacheTtlBuffer ? parseInt(cacheTtlBuffer, 10) : undefined,
      maxCacheSize: cacheMaxSize ? parseInt(cacheMaxSize, 10) : undefined,
    };

    if (debug) {
      console.log(`[Latch] OBO cache: ${oboCache.enabled !== false ? 'enabled' : 'disabled'}`);
      if (oboCache.ttlBufferSeconds) {
        console.log(`[Latch] OBO cache TTL buffer: ${oboCache.ttlBufferSeconds}s`);
      }
      if (oboCache.maxCacheSize) {
        console.log(`[Latch] OBO cache max size: ${oboCache.maxCacheSize}`);
      }
    }
  }

  // Validate configuration with enhanced error messages
  validateLatchConfig({
    clientId,
    tenantId,
    cloud,
    cookieSecret,
    scopes,
  });

  // TypeScript knows these are defined after validation
  const validatedConfig: LatchConfig = {
    clientId: clientId!,
    tenantId: tenantId!,
    clientSecret, // Optional - determines confidential vs public client flow
    clientCertificate,
    cloud: cloud as LatchCloud,
    scopes: scopes || ['openid', 'profile', 'User.Read'],
    redirectUri:
      redirectUri || `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/latch/callback`,
    cookieSecret: cookieSecret!,
    debug,
    allowedAudiences,
    oboCache,
    clockSkewTolerance,
    jwksCacheTTL,
  };

  // Validate scopes match cloud environment
  if (validatedConfig.scopes && validatedConfig.scopes.length > 0) {
    validateScopes(validatedConfig.scopes, validatedConfig.cloud);
  }

  // Debug logging
  if (debug) {
    console.log('[Latch] Configuration loaded successfully');
    const authMethod = clientCertificate
      ? 'Confidential (with certificate)'
      : clientSecret
      ? 'Confidential (with client_secret)'
      : 'Public (PKCE only)';
    console.log(`[Latch] Client type: ${authMethod}`);
    console.log(`[Latch] Cloud: ${validatedConfig.cloud}`);
    if (validatedConfig.scopes) {
      console.log(`[Latch] Scopes: ${validatedConfig.scopes.join(' ')}`);
    }
    console.log(`[Latch] Redirect URI: ${validatedConfig.redirectUri}`);
    if (allowedAudiences) {
      console.log(`[Latch] Allowed audiences: ${allowedAudiences.join(', ')}`);
    }
  }

  return validatedConfig;
}

/**
 * Parse X.509 certificate chain from environment variable
 * Supports JSON array or newline-separated base64 strings
 */
function parseX5cCertChain(x5cValue: string): string[] {
  // Try parsing as JSON array first
  if (x5cValue.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(x5cValue);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // Fall through to newline parsing
    }
  }

  // Parse as newline-separated values
  return x5cValue
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(Boolean);
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
 * Build Azure AD logout URL with post_logout_redirect_uri
 *
 * This signs the user out of Azure AD and redirects back to your application.
 * Use this in your logout route to ensure the user's Azure AD session is cleared.
 *
 * @param cloud - Azure cloud environment
 * @param tenantId - Azure AD tenant ID
 * @param postLogoutRedirectUri - URL to redirect to after logout (typically your app's home page)
 * @returns Complete logout URL to redirect the user to
 *
 * @example
 * ```typescript
 * // In your logout route
 * const logoutUrl = buildLogoutUrl(
 *   config.cloud,
 *   config.tenantId,
 *   'https://yourdomain.com'
 * );
 * return NextResponse.redirect(logoutUrl);
 * ```
 */
export function buildLogoutUrl(
  cloud: LatchCloud,
  tenantId: string,
  postLogoutRedirectUri: string
): string {
  const endpoints = getAzureEndpoints(cloud, tenantId);
  const logoutUrl = new URL(endpoints.logoutUrl);
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  return logoutUrl.toString();
}

/**
 * Clear all Latch authentication cookies from a NextResponse
 * 
 * Helper function to delete all Latch cookies at once. Use this in your logout route
 * to ensure complete session cleanup.
 * 
 * @param response - NextResponse object to clear cookies from
 * 
 * @example
 * ```typescript
 * // In your logout route
 * import { clearLatchCookies, buildLogoutUrl } from '@lance0/latch';
 * 
 * export async function GET(request: NextRequest) {
 *   const config = getLatchConfig();
 *   const logoutUrl = buildLogoutUrl(config.cloud, config.tenantId, baseUrl);
 *   
 *   const response = NextResponse.redirect(logoutUrl);
 *   clearLatchCookies(response); // Delete all Latch cookies
 *   return response;
 * }
 * ```
 */
export function clearLatchCookies(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
  response.cookies.delete(COOKIE_NAMES.ID_TOKEN);
  response.cookies.delete(COOKIE_NAMES.PKCE_DATA);
}

/**
 * Validate token issuer matches expected cloud and tenant
 * 
 * Prevents token confusion attacks where tokens from wrong tenant/cloud are accepted.
 * 
 * **Security:** This is a critical security function. Always validate issuer before
 * trusting token claims.
 * 
 * @param issuer - Issuer from token (iss claim)
 * @param expectedTenantId - Expected tenant ID
 * @param expectedCloud - Expected cloud environment
 * @throws {LatchError} if issuer doesn't match expectations
 * 
 * @example
 * ```typescript
 * const claims = jwt.decode(token);
 * validateIssuer(claims.iss, config.tenantId, config.cloud);
 * ```
 */
export function validateIssuer(
  issuer: string | undefined,
  expectedTenantId: string,
  expectedCloud: LatchCloud
): void {
  if (!issuer) {
    throw createLatchError(
      'LATCH_ID_TOKEN_INVALID',
      '[Latch] Token missing issuer (iss) claim.\n\n' +
      'This token is invalid or malformed.'
    );
  }

  // Expected issuer formats by cloud
  const expectedIssuers: string[] = [];
  
  if (expectedCloud === 'commercial') {
    expectedIssuers.push(`https://login.microsoftonline.com/${expectedTenantId}/v2.0`);
    expectedIssuers.push(`https://sts.windows.net/${expectedTenantId}/`);
  } else if (expectedCloud === 'gcc-high' || expectedCloud === 'dod') {
    expectedIssuers.push(`https://login.microsoftonline.us/${expectedTenantId}/v2.0`);
    expectedIssuers.push(`https://sts.windows.net/${expectedTenantId}/`); // v1 endpoint
  }

  // Check if issuer matches any expected format
  const issuerMatch = expectedIssuers.some(expected => issuer === expected);

  if (!issuerMatch) {
    // Try to detect the issue
    let hint = '';
    
    if (issuer.includes('login.microsoftonline.com') && expectedCloud !== 'commercial') {
      hint = `\n\nThe token is from Azure Commercial (.com) but LATCH_CLOUD=${expectedCloud}.\n` +
             'Fix: Set LATCH_CLOUD=commercial in your .env.local';
    } else if (issuer.includes('login.microsoftonline.us') && expectedCloud === 'commercial') {
      hint = `\n\nThe token is from Azure Government (.us) but LATCH_CLOUD=commercial.\n` +
             'Fix: Set LATCH_CLOUD=gcc-high or LATCH_CLOUD=dod in your .env.local';
    } else if (!issuer.includes(expectedTenantId)) {
      hint = `\n\nThe token is from a different tenant.\n` +
             `Expected tenant: ${expectedTenantId}\n` +
             `Fix: Verify LATCH_TENANT_ID matches your Azure AD tenant`;
    }

    throw createLatchError(
      'LATCH_CLOUD_MISMATCH',
      `[Latch] Token issuer mismatch (potential token confusion attack).\n\n` +
      `Received issuer: ${issuer}\n` +
      `Expected one of:\n${expectedIssuers.map(e => `  • ${e}`).join('\n')}${hint}`
    );
  }
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
 * Recommended scopes for different use cases
 * 
 * @example
 * ```typescript
 * // In .env.local, use one of:
 * LATCH_SCOPES=openid profile email offline_access User.Read  // Recommended
 * // OR
 * import { RECOMMENDED_SCOPES } from '@lance0/latch';
 * const scopes = RECOMMENDED_SCOPES.FULL.split(' ');
 * ```
 */
export const RECOMMENDED_SCOPES = {
  /** Minimal: Just authentication - ID token only, no email, no refresh token */
  MINIMAL: 'openid profile',

  /** Standard: Auth + email + offline access (RECOMMENDED) */
  STANDARD: 'openid profile email offline_access',

  /** Full: Everything including Microsoft Graph User.Read */
  FULL: 'openid profile email offline_access User.Read',
} as const;

/**
 * Cookie names used by Latch for storing authentication data
 * 
 * ⚠️ **IMPORTANT:** Latch uses **three separate cookies** to stay under browser 4KB limits.
 * 
 * Each cookie stores different data:
 * - `ID_TOKEN` - Stores the DECODED user object (~300 bytes)
 * - `REFRESH_TOKEN` - Stores refresh token + expiry (~2700 bytes)
 * - `PKCE_DATA` - Temporary PKCE flow data, deleted after callback (~250 bytes)
 * 
 * ❌ **DO NOT** store everything in one cookie - it will exceed 4KB and fail silently!
 * 
 * @example
 * ```typescript
 * // ✅ CORRECT: Set cookies separately after token exchange
 * const user = await verifyIdToken(tokens.id_token, ...);
 * 
 * // Cookie 1: User object only
 * const sealedUser = await seal(user, config.cookieSecret);
 * response.cookies.set(COOKIE_NAMES.ID_TOKEN, sealedUser, COOKIE_OPTIONS);
 * 
 * // Cookie 2: Refresh token + expiry
 * const sealedRT = await seal(
 *   { refreshToken: tokens.refresh_token!, expiresAt: Date.now() + tokens.expires_in * 1000 },
 *   config.cookieSecret
 * );
 * response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, sealedRT, COOKIE_OPTIONS);
 * 
 * // ❌ WRONG: Everything in one cookie (exceeds 4KB!)
 * const sealedSession = await seal(
 *   { user, accessToken, refreshToken, expiresAt },
 *   config.cookieSecret
 * ); // Throws: Cookie too large
 * response.cookies.set(COOKIE_NAMES.ID_TOKEN, sealedSession, COOKIE_OPTIONS);
 * ```
 * 
 * @see Example callback route: apps/example-app/app/api/latch/callback/route.ts
 */
export const COOKIE_NAMES = {
  /**
   * Stores encrypted refresh token + expiry timestamp (~2700 bytes)
   * 
   * Contains: `{ refreshToken: string, expiresAt: number }`
   * 
   * @example
   * ```typescript
   * const rtData: RefreshTokenData = {
   *   refreshToken: tokens.refresh_token!,
   *   expiresAt: Date.now() + tokens.expires_in * 1000
   * };
   * const sealed = await seal(rtData, config.cookieSecret);
   * response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, sealed, COOKIE_OPTIONS);
   * ```
   */
  REFRESH_TOKEN: 'latch_rt',
  
  /**
   * Stores encrypted PKCE flow data - TEMPORARY (10 min expiry)
   * 
   * Contains: `{ codeVerifier: string, state: string, nonce: string, returnTo?: string }`
   * 
   * Automatically deleted after OAuth callback completes.
   * 
   * @example
   * ```typescript
   * const pkceData: PKCEData = {
   *   codeVerifier,
   *   state,
   *   nonce,
   *   returnTo: '/dashboard'
   * };
   * const sealed = await seal(pkceData, config.cookieSecret);
   * response.cookies.set(COOKIE_NAMES.PKCE_DATA, sealed, {
   *   ...COOKIE_OPTIONS,
   *   maxAge: 60 * 10  // 10 minutes
   * });
   * ```
   */
  PKCE_DATA: 'latch_pkce',
  
  /**
   * Stores encrypted DECODED user object from verifyIdToken() (~300 bytes)
   * 
   * ⚠️ **Does NOT store the raw ID token JWT!** Stores the decoded/verified user object.
   * 
   * Contains: `LatchUser { sub, email?, name?, preferred_username?, iat, exp }`
   * 
   * @example
   * ```typescript
   * // ✅ CORRECT: Store decoded user object
   * const user = await verifyIdToken(tokens.id_token, jwksUri, clientId, nonce);
   * const sealed = await seal(user, config.cookieSecret);
   * response.cookies.set(COOKIE_NAMES.ID_TOKEN, sealed, COOKIE_OPTIONS);
   * 
   * // ❌ WRONG: Don't store the raw JWT string
   * const sealed = await seal(tokens.id_token, config.cookieSecret);
   * 
   * // ❌ WRONG: Don't store tokens here
   * const sealed = await seal({ user, accessToken, refreshToken }, config.cookieSecret);
   * ```
   */
  ID_TOKEN: 'latch_id',
} as const;

/**
 * Common mistake helper - use COOKIE_NAMES instead
 * @deprecated Import and use COOKIE_NAMES directly
 */
export const CookieNames = COOKIE_NAMES;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
