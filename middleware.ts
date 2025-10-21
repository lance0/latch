import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAMES } from '@/lib/latch/config';

/**
 * Middleware for protecting routes
 * Redirects to /api/latch/start if not authenticated
 */
export function middleware(request: NextRequest) {
  // Check if user has refresh token cookie (indicates authentication)
  const hasRefreshToken = request.cookies.has(COOKIE_NAMES.REFRESH_TOKEN);

  if (!hasRefreshToken) {
    // Redirect to sign-in with return URL
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    const signInUrl = new URL('/api/latch/start', request.url);
    signInUrl.searchParams.set('returnTo', returnTo);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

/**
 * Configure which routes this middleware runs on
 * Example: protect all routes under /dashboard
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/latch/* (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/dashboard/:path*',
    // Add more protected routes here
  ],
};
