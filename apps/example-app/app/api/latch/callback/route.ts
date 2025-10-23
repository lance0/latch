import { NextRequest, NextResponse } from 'next/server';
import {
  getLatchConfig,
  getAzureEndpoints,
  COOKIE_NAMES,
  COOKIE_OPTIONS,
  unseal,
  seal,
  validateState,
  verifyIdToken,
  exchangeCodeForTokens,
  LatchError,
  type PKCEData,
  type RefreshTokenData,
} from '@latch/core';

/**
 * GET /api/latch/callback
 * Handles OAuth 2.0 callback and exchanges code for tokens
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);
    const searchParams = request.nextUrl.searchParams;

    // Check for errors from Azure AD
    const error = searchParams.get('error');
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('[Latch] OAuth error:', error, errorDescription);
      return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
    }

    // Get authorization code and state
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      throw new LatchError('LATCH_CODE_MISSING', 'Authorization code missing from callback');
    }

    // Retrieve PKCE data from cookie
    const pkceCookie = request.cookies.get(COOKIE_NAMES.PKCE_DATA);
    if (!pkceCookie) {
      throw new LatchError('LATCH_PKCE_MISSING', 'PKCE data missing from cookie');
    }

    const pkceData = await unseal<PKCEData>(pkceCookie.value, config.cookieSecret!);

    // Validate state
    validateState(state, pkceData.state);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      pkceData.codeVerifier,
      config.redirectUri!,
      config.clientId,
      config.tenantId,
      config.cloud,
      config.clientSecret
    );

    // Verify ID token
    let user = null;
    if (tokens.id_token) {
      user = await verifyIdToken(
        tokens.id_token,
        endpoints.jwksUri,
        config.clientId,
        pkceData.nonce
      );
    }

    // Store refresh token in encrypted cookie
    const refreshTokenData: RefreshTokenData = {
      refreshToken: tokens.refresh_token!,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    const sealedRefreshToken = await seal(refreshTokenData, config.cookieSecret!);
    const sealedIdToken = tokens.id_token
      ? await seal(user, config.cookieSecret!)
      : null;

    // Create response
    const returnTo = pkceData.returnTo || '/';
    const response = NextResponse.redirect(new URL(returnTo, request.url));

    // Set cookies
    response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, sealedRefreshToken, COOKIE_OPTIONS);

    if (sealedIdToken) {
      response.cookies.set(COOKIE_NAMES.ID_TOKEN, sealedIdToken, COOKIE_OPTIONS);
    }

    // Delete PKCE cookie
    response.cookies.delete(COOKIE_NAMES.PKCE_DATA);

    if (config.debug) {
      console.log('[Latch] OAuth callback successful:', {
        user: user?.preferred_username || user?.email,
        returnTo,
      });
    }

    return response;
  } catch (error) {
    console.error('[Latch] Error in OAuth callback:', error);

    if (error instanceof LatchError) {
      return NextResponse.redirect(
        new URL(`/?error=${error.code}`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/?error=CALLBACK_FAILED', request.url)
    );
  }
}
