/**
 * Next.js 16 Proxy with Latch Authentication
 * 
 * Copy this file to your project root as proxy.ts
 * 
 * IMPORTANT: proxy.ts automatically runs on Node.js runtime in Next.js 16
 * DO NOT add: export const runtime = 'nodejs' (causes build error in Next.js 16)
 * 
 * Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAMES, unseal } from '@lance0/latch';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes - allow without authentication
  const publicRoutes = [
    '/api/latch/',      // All Latch auth endpoints
    '/api/health',      // Health check
    '/',                // Landing page
    '/about',           // About page
  ];

  // Check if route is public
  if (publicRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next();
  }

  // Validate session - check for ID token cookie
  const sessionCookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN)?.value;

  if (!sessionCookie) {
    console.log('[Proxy] No session cookie, redirecting to home');
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unseal and validate session
  try {
    const secret = process.env.LATCH_COOKIE_SECRET;
    if (!secret) {
      console.error('[Proxy] LATCH_COOKIE_SECRET not configured');
      return NextResponse.redirect(new URL('/', request.url));
    }

    const session = await unseal(sessionCookie, secret) as any;

    // Check for user ID (sub claim) - indicates valid session
    // NOTE: Check session.sub (from ID token claims), NOT session.idToken
    if (!session || !session.sub) {
      console.log('[Proxy] Invalid session (missing sub claim), redirecting to home');
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Session is valid - allow request to proceed
    return NextResponse.next();
  } catch (error) {
    console.log('[Proxy] Session validation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.redirect(new URL('/', request.url));
  }
}

/**
 * Configure which routes the proxy runs on
 * 
 * This matcher excludes:
 * - Next.js static files (_next/static)
 * - Next.js image optimization (_next/image)
 * - Public assets (favicon, images, etc.)
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
