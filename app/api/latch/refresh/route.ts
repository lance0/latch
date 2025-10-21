import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, COOKIE_NAMES, COOKIE_OPTIONS } from '@/lib/latch/config';
import { unseal, seal } from '@/lib/latch/crypto/seal';
import { RefreshTokenData, LatchError } from '@/lib/latch/types';
import { refreshAccessToken } from '@/lib/latch/oidc/tokens';

/**
 * POST /api/latch/refresh
 * Refreshes the access token using the refresh token
 * Returns the new access token (for Direct Token mode)
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
      config.scopes
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
