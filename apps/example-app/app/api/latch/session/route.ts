import { NextRequest, NextResponse } from 'next/server';
import {
  getLatchConfig,
  COOKIE_NAMES,
  unseal,
  type LatchUser,
  type LatchSession,
} from '@latch/core';

/**
 * GET /api/latch/session
 * Returns the current user session (sanitized)
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();

    // Get ID token from cookie
    const idTokenCookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN);

    if (!idTokenCookie) {
      const session: LatchSession = {
        user: null,
        isAuthenticated: false,
      };
      return NextResponse.json(session);
    }

    const user = await unseal<LatchUser>(idTokenCookie.value, config.cookieSecret!);

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (user.exp < now) {
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
