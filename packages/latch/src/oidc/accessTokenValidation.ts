import {  createRemoteJWKSet, jwtVerify } from 'jose';
import { getAzureEndpoints } from '../config';
import { LatchError, LatchCloud, ValidatedAccessToken } from '../types';

/**
 * Validate an incoming bearer access token from Authorization header
 *
 * This validates:
 * - Signature via JWKS (per cloud)
 * - Audience (must match your API's client ID or allowed audiences)
 * - Issuer (must match tenant and cloud - sovereign host guard)
 * - Tenant ID (must match configured tenant)
 * - Expiration with clock-skew tolerance (60 seconds)
 *
 * @param accessToken - Bearer token from Authorization header
 * @param clientId - Your API's Azure AD client ID
 * @param tenantId - Azure AD tenant ID
 * @param cloud - Cloud environment
 * @param options - Validation options
 * @returns Validated token claims
 *
 * @throws {LatchError} LATCH_OBO_INVALID_ASSERTION - Token validation failed
 * @throws {LatchError} LATCH_OBO_AUDIENCE_MISMATCH - Token not for your API
 * @throws {LatchError} LATCH_OBO_TENANT_MISMATCH - Token from wrong tenant
 * @throws {LatchError} LATCH_OBO_ISSUER_MISMATCH - Token from wrong issuer/cloud
 * @throws {LatchError} LATCH_OBO_TOKEN_EXPIRED - Token is expired
 */
export async function validateAccessToken(
  accessToken: string,
  clientId: string,
  tenantId: string,
  cloud: LatchCloud,
  options?: {
    /** Additional allowed audiences (e.g., "api://your-api") */
    allowedAudiences?: string[];
    /** Clock skew tolerance in seconds (default: 60) */
    clockToleranceSeconds?: number;
    /** Require specific authorized party (azp claim) */
    requiredAzp?: string;
  }
): Promise<ValidatedAccessToken> {
  const endpoints = getAzureEndpoints(cloud, tenantId);
  const clockTolerance = options?.clockToleranceSeconds ?? 60;

  // Build list of allowed audiences (your client ID + any additional URIs)
  const allowedAudiences = [clientId, ...(options?.allowedAudiences || [])];

  try {
    // Create JWKS fetcher (jose caches internally)
    const JWKS = createRemoteJWKSet(new URL(endpoints.jwksUri));

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(accessToken, JWKS, {
      audience: allowedAudiences,
      clockTolerance,
    });

    // Cast payload to ValidatedAccessToken
    const claims = payload as unknown as ValidatedAccessToken;

    // Validate issuer matches tenant and cloud
    const expectedIssuer = `${endpoints.loginBaseUrl}/${tenantId}/v2.0`;
    if (claims.iss !== expectedIssuer) {
      throw new LatchError(
        'LATCH_OBO_ISSUER_MISMATCH',
        `Token issuer mismatch. Expected: ${expectedIssuer}, Got: ${claims.iss}. ` +
        `This may indicate a sovereign cloud mismatch or wrong tenant.`,
        { expected: expectedIssuer, actual: claims.iss }
      );
    }

    // Validate tenant ID matches
    if (claims.tid !== tenantId) {
      throw new LatchError(
        'LATCH_OBO_TENANT_MISMATCH',
        `Token tenant mismatch. Expected: ${tenantId}, Got: ${claims.tid}`,
        { expected: tenantId, actual: claims.tid }
      );
    }

    // Optional: Validate authorized party (azp) to prevent token forwarding
    if (options?.requiredAzp && claims.azp !== options.requiredAzp) {
      throw new LatchError(
        'LATCH_OBO_INVALID_ASSERTION',
        `Token authorized party mismatch. Expected: ${options.requiredAzp}, Got: ${claims.azp}. ` +
        `This may indicate token forwarding from an unexpected client.`,
        { expected: options.requiredAzp, actual: claims.azp }
      );
    }

    // Validate audience is one of the allowed values
    if (!allowedAudiences.includes(claims.aud)) {
      throw new LatchError(
        'LATCH_OBO_AUDIENCE_MISMATCH',
        `Token audience mismatch. Expected one of: ${allowedAudiences.join(', ')}, Got: ${claims.aud}. ` +
        `The token is not for your API.`,
        { expected: allowedAudiences, actual: claims.aud }
      );
    }

    return claims;
  } catch (error) {
    // Pass through LatchError instances
    if (error instanceof LatchError) {
      throw error;
    }

    // Handle jose library errors
    if (error instanceof Error) {
      if (error.message.includes('exp')) {
        throw new LatchError(
          'LATCH_OBO_TOKEN_EXPIRED',
          'Access token has expired',
          error
        );
      }

      if (error.message.includes('aud')) {
        throw new LatchError(
          'LATCH_OBO_AUDIENCE_MISMATCH',
          `Token audience validation failed: ${error.message}`,
          error
        );
      }

      throw new LatchError(
        'LATCH_OBO_INVALID_ASSERTION',
        `Access token validation failed: ${error.message}`,
        error
      );
    }

    // Generic fallback
    throw new LatchError(
      'LATCH_OBO_INVALID_ASSERTION',
      'Failed to validate access token',
      error
    );
  }
}

/**
 * Extract bearer token from Authorization header
 *
 * @param authHeader - Authorization header value (e.g., "Bearer eyJ...")
 * @returns Access token without "Bearer " prefix, or null if not found
 *
 * @example
 * const token = extractBearerToken(request.headers.get('authorization'));
 * if (!token) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Trim and normalize whitespace
  const normalized = authHeader.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }

  // Trim the token to handle any edge cases
  return parts[1].trim();
}

/**
 * Check if access token is close to expiration
 *
 * @param claims - Validated access token claims
 * @param bufferSeconds - Consider expired N seconds before actual expiration (default: 300 = 5 minutes)
 * @returns True if token will expire within bufferSeconds
 *
 * @example
 * if (isTokenExpiringSoon(claims, 300)) {
 *   // Token expires in less than 5 minutes, refresh it
 * }
 */
export function isTokenExpiringSoon(
  claims: ValidatedAccessToken,
  bufferSeconds: number = 300
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return claims.exp - now <= bufferSeconds;
}
