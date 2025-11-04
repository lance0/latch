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
 */
export async function verifyIdToken(
  idToken: string,
  jwksUri: string,
  clientId: string,
  nonce: string
): Promise<LatchUser> {
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
