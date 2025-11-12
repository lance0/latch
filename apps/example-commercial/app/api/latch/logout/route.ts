import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, buildLogoutUrl, clearLatchCookies } from '@lance0/latch';

/**
 * GET /api/latch/logout
 * 
 * Logs the user out of both your application and Azure AD (SSO logout).
 * 
 * **What this route does:**
 * 1. Clears all Latch cookies (session, refresh token, PKCE data)
 * 2. Redirects user to Azure AD logout endpoint
 * 3. Azure AD signs user out of all Microsoft services
 * 4. Azure AD redirects back to your application
 * 
 * **Azure AD SSO Logout:**
 * By redirecting to Azure AD's logout endpoint, you ensure the user is signed out
 * of their entire Azure AD session, not just your application. This is important
 * for shared/public computers and government compliance requirements.
 * 
 * **Note:** If you only want to clear local cookies without Azure AD SSO logout,
 * simply call `clearLatchCookies(response)` and redirect to your home page.
 * 
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc#send-a-sign-out-request
 */
export async function GET(request: NextRequest) {
  try {
    const config = getLatchConfig();
    const baseUrl = new URL(request.url).origin;

    // Build Azure AD logout URL with post-logout redirect
    const logoutUrl = buildLogoutUrl(config.cloud, config.tenantId, baseUrl);

    // Create response and clear all Latch cookies
    const response = NextResponse.redirect(logoutUrl);
    clearLatchCookies(response);

    if (config.debug) {
      console.log('[Latch] User logged out, redirecting to Azure AD');
    }

    return response;
  } catch (error) {
    console.error('[Latch] Error during logout:', error);

    // Even if there's an error, redirect to home and clear cookies
    const response = NextResponse.redirect(new URL('/', request.url));
    clearLatchCookies(response);

    return response;
  }
}
