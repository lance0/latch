import { NextRequest, NextResponse } from 'next/server';
import {
  getLatchConfig,
  COOKIE_NAMES,
  COOKIE_OPTIONS,
  unseal,
  seal,
  refreshAccessToken,
  LatchError,
  type RefreshTokenData,
} from '@lance0/latch';

/**
 * POST /api/latch/refresh
 * 
 * Refreshes the access token using the stored refresh token.
 * 
 * **What this route does:**
 * 1. Reads refresh token from cookie
 * 2. Calls Azure AD token endpoint to get fresh access token
 * 3. Returns new access token (expires in 1 hour)
 * 4. Updates refresh token cookie if Azure AD issues a new one
 * 
 * **When to call this route:**
 * - Before making Microsoft Graph API calls (to ensure fresh token)
 * - When access token expires (1 hour lifetime)
 * - In your API routes that need to call downstream APIs
 * 
 * **Usage Pattern (Direct Token Mode):**
 * ```typescript
 * // Client-side: Get fresh access token
 * const response = await fetch('/api/latch/refresh', { method: 'POST' });
 * const { access_token } = await response.json();
 * 
 * // Use token for Microsoft Graph
 * const userProfile = await fetch('https://graph.microsoft.us/v1.0/me', {
 *   headers: { Authorization: `Bearer ${access_token}` }
 * });
 * ```
 * 
 * **Usage Pattern (Secure Proxy Mode - Recommended):**
 * ```typescript
 * // Server-side API route: Refresh and proxy in one step
 * const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
 * const rtData = await unseal(refreshTokenCookie.value, secret);
 * const tokens = await refreshAccessToken(rtData.refreshToken, ...);
 * 
 * // Call Graph directly from server (token never exposed to client)
 * const userProfile = await fetch('https://graph.microsoft.us/v1.0/me', {
 *   headers: { Authorization: `Bearer ${tokens.access_token}` }
 * });
 * ```
 * 
 * **Error Handling:**
 * Returns 401 if refresh token is missing or invalid. Client should redirect to login.
 */
export async function POST(request: NextRequest) {
  try {
    const config = getLatchConfig();

    // Get refresh token from cookie
    const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
    if (!refreshTokenCookie) {
      throw new LatchError('LATCH_REFRESH_TOKEN_MISSING', 'Refresh token not found');
    }

    const refreshTokenData = await unseal<RefreshTokenData>(
      refreshTokenCookie.value,
      config.cookieSecret!
    );

    // Refresh the token
    const tokens = await refreshAccessToken(
      refreshTokenData.refreshToken,
      config.clientId,
      config.tenantId,
      config.cloud,
      config.scopes,
      config.clientSecret
    );

    // Update refresh token cookie if a new one was issued
    let response;
    if (tokens.refresh_token) {
      const newRefreshTokenData: RefreshTokenData = {
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };

      const sealedRefreshToken = await seal(newRefreshTokenData, config.cookieSecret!);

      response = NextResponse.json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      });

      response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, sealedRefreshToken, COOKIE_OPTIONS);
    } else {
      response = NextResponse.json({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      });
    }

    if (config.debug) {
      console.log('[Latch] Token refreshed successfully');
    }

    return response;
  } catch (error) {
    console.error('[Latch] Error refreshing token:', error);

    if (error instanceof LatchError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'REFRESH_FAILED', message: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
