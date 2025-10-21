import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, getAzureEndpoints, COOKIE_NAMES } from '@/lib/latch/config';
import { unseal } from '@/lib/latch/crypto/seal';
import { RefreshTokenData } from '@/lib/latch/types';
import { refreshAccessToken } from '@/lib/latch/oidc/tokens';

/**
 * GET /api/me
 * Secure Proxy mode example: Fetches user profile from Microsoft Graph
 * Access token never reaches the client
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    // Get refresh token from cookie
    const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
    if (!refreshTokenCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const refreshTokenData = await unseal<RefreshTokenData>(
      refreshTokenCookie.value,
      config.cookieSecret!
    );

    // Get fresh access token
    const tokens = await refreshAccessToken(
      refreshTokenData.refreshToken,
      config.clientId,
      config.tenantId,
      config.cloud,
      config.scopes
    );

    // Call Microsoft Graph
    const graphUrl = `${endpoints.graphBaseUrl}/v1.0/me`;
    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!graphResponse.ok) {
      const error = await graphResponse.text();
      throw new Error(`Graph API error: ${error}`);
    }

    const profile = await graphResponse.json();

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Latch] Error fetching profile:', error);

    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
