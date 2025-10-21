'use client';

import { useState, useEffect } from 'react';
import { useLatch, LatchGuard } from '@/lib/latch';

interface UserProfile {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  officeLocation?: string;
  id?: string;
}

function DashboardContent() {
  const { user, signOut } = useLatch();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/me');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Latch Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.email || user?.preferred_username}
              </span>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Welcome to Latch</h2>
            <p className="text-gray-600">
              This is a protected dashboard page. You&apos;re successfully authenticated!
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">ID Token Claims</h3>
            {user && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Subject (sub):</span>
                    <p className="text-gray-600 break-all">{user.sub}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>
                    <p className="text-gray-600">{user.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-600">{user.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Username:</span>
                    <p className="text-gray-600">{user.preferred_username || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Issued At:</span>
                    <p className="text-gray-600">{new Date(user.iat * 1000).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Expires At:</span>
                    <p className="text-gray-600">{new Date(user.exp * 1000).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Microsoft Graph Profile</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800 text-sm">Error: {error}</p>
                <p className="text-red-600 text-xs mt-2">
                  Make sure you&apos;ve configured the Graph API proxy at /api/me
                </p>
              </div>
            ) : profile ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Display Name:</span>
                    <p className="text-gray-600">{profile.displayName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-600">{profile.mail || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">UPN:</span>
                    <p className="text-gray-600 break-all">{profile.userPrincipalName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Job Title:</span>
                    <p className="text-gray-600">{profile.jobTitle || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Office:</span>
                    <p className="text-gray-600">{profile.officeLocation || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">ID:</span>
                    <p className="text-gray-600 break-all">{profile.id || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <LatchGuard>
      <DashboardContent />
    </LatchGuard>
  );
}
