'use client';

import { useEffect } from 'react';
import { useLatch } from './LatchProvider';

interface LatchGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that protects child components from unauthenticated access
 * Redirects to sign-in if not authenticated
 */
export function LatchGuard({ children, fallback, redirectTo }: LatchGuardProps) {
  const { isAuthenticated, isLoading, signIn } = useLatch();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to sign-in with return URL
      const returnTo = redirectTo || window.location.pathname;
      signIn(returnTo);
    }
  }, [isAuthenticated, isLoading, signIn, redirectTo]);

  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || null;
  }

  return <>{children}</>;
}
