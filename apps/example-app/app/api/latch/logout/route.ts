import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, getAzureEndpoints, COOKIE_NAMES } from '@latch/core';

/**
 * GET /api/latch/logout
 * Clears session cookies and redirects to Azure AD logout
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    // Build logout URL
    const logoutUrl = new URL(endpoints.logoutUrl);
    const baseUrl = new URL(request.url).origin;
    logoutUrl.searchParams.set('post_logout_redirect_uri', baseUrl);

    // Create response
    const response = NextResponse.redirect(logoutUrl.toString());

    // Delete all Latch cookies
    response.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
    response.cookies.delete(COOKIE_NAMES.ID_TOKEN);
    response.cookies.delete(COOKIE_NAMES.PKCE_DATA);

    if (config.debug) {
      console.log('[Latch] User logged out');
    }

    return response;
  } catch (error) {
    console.error('[Latch] Error during logout:', error);

    // Even if there's an error, redirect to home and clear cookies
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete(COOKIE_NAMES.REFRESH_TOKEN);
    response.cookies.delete(COOKIE_NAMES.ID_TOKEN);
    response.cookies.delete(COOKIE_NAMES.PKCE_DATA);

    return response;
  }
}
