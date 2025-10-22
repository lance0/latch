'use client';

import { useLatch } from '@latch/core/react';

export default function Home() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useLatch();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Latch
          </h1>
          <p className="text-xl text-gray-600">
            Modern OIDC for Next.js and Secure Clouds
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="space-y-6">
            <p className="text-gray-700">
              Secure authentication for Azure Government clouds. PKCE-enabled OAuth 2.0 with
              encrypted cookies and zero client-side token exposure.
            </p>
            <button
              onClick={() => signIn()}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Sign In with Azure AD
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-green-800 font-medium">Authenticated</p>
              {user && (
                <div className="mt-4 space-y-2 text-left">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Name:</span> {user.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {user.email || user.preferred_username || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">ID:</span> {user.sub}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <a
                href="/dashboard"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </a>
              <button
                onClick={() => signOut()}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Features</h2>
          <ul className="text-sm text-gray-600 space-y-2 text-left max-w-md mx-auto">
            <li>✓ PKCE S256 (no client secrets)</li>
            <li>✓ HttpOnly encrypted cookies</li>
            <li>✓ Azure Government cloud support (GCC-High, DoD)</li>
            <li>✓ Next.js 15 App Router native</li>
            <li>✓ TypeScript-first with full IntelliSense</li>
            <li>✓ Audit-friendly and transparent</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
