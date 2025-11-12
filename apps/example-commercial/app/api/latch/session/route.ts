import { NextRequest, NextResponse } from 'next/server';
import {
  getLatchConfig,
  COOKIE_NAMES,
  unseal,
  type LatchUser,
  type LatchSession,
  type RefreshTokenData,
} from '@lance0/latch';

/**
 * GET /api/latch/session
 * 
 * Returns the current authenticated user session.
 * 
 * **What this route does:**
 * 1. Reads the ID token cookie (contains user object)
 * 2. Checks if the refresh token is still valid (7-day session lifetime)
 * 3. Returns user object if authenticated, null if not
 * 
 * **Session Lifetime:**
 * Sessions last 7 days (COOKIE_OPTIONS.maxAge). After 7 days, the refresh token
 * expires and the user must re-authenticate. The ID token itself has a 1-hour
 * expiry from Azure AD, but we don't enforce that here since we can refresh it.
 * 
 * **When to call this route:**
 * - On page load to check authentication status
 * - After login to get user info
 * - When you need to verify the user is still authenticated
 * 
 * **Note:** This route does NOT refresh tokens. Call `/api/latch/refresh` to get
 * a fresh access token for API calls.
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();

    // Get ID token and refresh token from cookies
    const idTokenCookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN);
    const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);

    if (!idTokenCookie || !refreshTokenCookie) {
      const session: LatchSession = {
        user: null,
        isAuthenticated: false,
      };
      return NextResponse.json(session);
    }

    const user = await unseal<LatchUser>(idTokenCookie.value, config.cookieSecret!);
    const refreshTokenData = await unseal<RefreshTokenData>(
      refreshTokenCookie.value,
      config.cookieSecret!
    );

    // Check if refresh token is expired (7-day session lifetime)
    // The ID token exp is 1 hour from Azure AD, but we can refresh it, so we only
    // check the refresh token expiry to determine if the session is truly expired
    const now = Date.now();
    if (refreshTokenData.expiresAt < now) {
      const session: LatchSession = {
        user: null,
        isAuthenticated: false,
      };
      return NextResponse.json(session);
    }

    const session: LatchSession = {
      user,
      isAuthenticated: true,
    };

    return NextResponse.json(session);
  } catch (error) {
    console.error('[Latch] Error retrieving session:', error);

    const session: LatchSession = {
      user: null,
      isAuthenticated: false,
    };

    return NextResponse.json(session);
  }
}
