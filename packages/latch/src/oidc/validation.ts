import { LatchError, LatchUser } from '../types';
import * as jose from 'jose';

/**
 * Validate state parameter matches
 */
export function validateState(receivedState: string | null, expectedState: string): void {
  if (!receivedState) {
    throw new LatchError('LATCH_STATE_MISSING', 'State parameter is missing from callback');
  }

  if (receivedState !== expectedState) {
    throw new LatchError('LATCH_STATE_MISMATCH', 'State parameter does not match');
  }
}

/**
 * Validate return URL is same-origin and not an open redirect
 * 
 * @param returnTo - The URL to validate (can be relative or absolute)
 * @param baseUrl - The base URL of your application (e.g., request origin or redirectUri)
 * @returns A validated relative path (pathname + search params)
 * 
 * @example
 * ```typescript
 * // In your start route:
 * const origin = request.nextUrl.origin; // or config.redirectUri
 * const returnTo = searchParams.get('returnTo');
 * const validatedPath = validateReturnUrl(returnTo, origin);
 * ```
 */
export function validateReturnUrl(returnTo: string | null | undefined, baseUrl: string): string {
  // Default to home page
  if (!returnTo) {
    return '/';
  }

  try {
    // Parse the return URL - works with both relative and absolute URLs
    const returnUrl = new URL(returnTo, baseUrl);
    const base = new URL(baseUrl);

    // Ensure same origin (prevent open redirect attacks)
    if (returnUrl.origin !== base.origin) {
      throw new Error('Cross-origin redirect not allowed');
    }

    // Return just the pathname and search (removes origin)
    return returnUrl.pathname + returnUrl.search;
  } catch (error) {
    throw new LatchError(
      'LATCH_INVALID_RETURN_URL',
      `Invalid return URL - must be same-origin. Received: ${returnTo}, Expected origin: ${new URL(baseUrl).origin}`,
      error
    );
  }
}

/**
 * Verify and decode ID token using JWKS
 * 
 * ⚠️ **WARNING:** Only `sub`, `iat`, and `exp` are guaranteed to be present in the returned user object.
 * The `email`, `name`, and `preferred_username` fields **may be undefined** depending on:
 * - Azure AD configuration
 * - Requested scopes (need `email` and `profile` scopes)
 * - User account type (guest users may not have email)
 * 
 * @param idToken - ID token JWT from token response
 * @param jwksUri - JWKS endpoint URL for token verification (from getAzureEndpoints)
 * @param clientId - Azure AD Application (client) ID - must match token audience
 * @param nonce - Nonce value from PKCE data - must match token nonce claim
 * @returns Decoded and verified user information from ID token
 * 
 * @example
 * ```typescript
 * // In your callback route:
 * const config = getLatchConfig();
 * const endpoints = getAzureEndpoints(config.cloud, config.tenantId);
 * 
 * // Safe: use requireIdToken helper
 * const user = await verifyIdToken(
 *   requireIdToken(tokens),  // Throws clear error if missing
 *   endpoints.jwksUri,
 *   config.clientId,
 *   pkceData.nonce
 * );
 * 
 * // ❌ BAD: email might be undefined
 * console.log(user.email);
 * 
 * // ✅ GOOD: Use getUserDisplayName helper
 * import { getUserDisplayName } from '@lance0/latch';
 * const displayName = getUserDisplayName(user);  // Always defined
 * 
 * // ✅ GOOD: Or use fallback chain
 * const displayName = user.email || user.preferred_username || user.name || user.sub;
 * ```
 * 
 * @throws {LatchError} LATCH_ID_TOKEN_INVALID if verification fails
 * @throws {LatchError} LATCH_NONCE_MISMATCH if nonce doesn't match
 * 
 * @see {@link requireIdToken} - Helper to validate tokens.id_token exists
 * @see {@link getUserDisplayName} - Helper to get best available display name
 */
export async function verifyIdToken(
  idToken: string,
  jwksUri: string,
  clientId: string,
  nonce: string
): Promise<LatchUser> {
  // Runtime validation
  if (!idToken || typeof idToken !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] verifyIdToken: 'idToken' must be a non-empty string, got ${typeof idToken}`
    );
  }
  if (!jwksUri || typeof jwksUri !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] verifyIdToken: 'jwksUri' must be a non-empty string, got ${typeof jwksUri}`
    );
  }
  if (!clientId || typeof clientId !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] verifyIdToken: 'clientId' must be a non-empty string, got ${typeof clientId}`
    );
  }
  if (!nonce || typeof nonce !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] verifyIdToken: 'nonce' must be a non-empty string, got ${typeof nonce}`
    );
  }

  try {
    // Fetch JWKS
    const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));

    // Verify token
    const { payload } = await jose.jwtVerify(idToken, JWKS, {
      audience: clientId,
      clockTolerance: 60, // Allow 60 seconds clock skew
    });

    // Validate nonce
    if (payload.nonce !== nonce) {
      throw new LatchError('LATCH_NONCE_MISMATCH', 'Nonce does not match');
    }

    // Extract user info
    const user: LatchUser = {
      sub: payload.sub!,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      preferred_username: payload.preferred_username as string | undefined,
      iat: payload.iat!,
      exp: payload.exp!,
    };

    return user;
  } catch (error) {
    if (error instanceof LatchError) {
      throw error;
    }
    throw new LatchError('LATCH_ID_TOKEN_INVALID', 'Failed to verify ID token', error);
  }
}
