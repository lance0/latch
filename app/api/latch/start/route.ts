import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, getAzureEndpoints, validateScopes, COOKIE_NAMES, COOKIE_OPTIONS } from '@/lib/latch/config';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/latch/crypto/pkce';
import { generateState, generateNonce } from '@/lib/latch/crypto/random';
import { seal } from '@/lib/latch/crypto/seal';
import { PKCEData, LatchError } from '@/lib/latch/types';
import { validateReturnUrl } from '@/lib/latch/oidc/validation';

/**
 * GET /api/latch/start
 * Initiates the OAuth 2.0 PKCE flow
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    // Validate scopes
    validateScopes(config.scopes || [], config.cloud);

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();
    const nonce = generateNonce();

    // Get returnTo from query params
    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo');
    const baseUrl = new URL(request.url).origin;
    const validatedReturnTo = validateReturnUrl(returnTo, baseUrl);

    // Store PKCE data in encrypted cookie
    const pkceData: PKCEData = {
      codeVerifier,
      state,
      nonce,
      returnTo: validatedReturnTo,
    };

    const sealedPkce = await seal(pkceData, config.cookieSecret!);

    // Build authorization URL
    const authUrl = new URL(endpoints.authorizeUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.redirectUri!);
    authUrl.searchParams.set('scope', config.scopes?.join(' ') || '');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('response_mode', 'query');

    // Create response with cookie
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(COOKIE_NAMES.PKCE_DATA, sealedPkce, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 10, // 10 minutes for OAuth flow
    });

    if (config.debug) {
      console.log('[Latch] Starting OAuth flow:', {
        cloud: config.cloud,
        authorizeUrl: endpoints.authorizeUrl,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
      });
    }

    return response;
  } catch (error) {
    console.error('[Latch] Error starting OAuth flow:', error);

    if (error instanceof LatchError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to start authentication' },
      { status: 500 }
    );
  }
}
