'use client';

import { useState, useTransition } from 'react';
import { getProfile, getUserInitials, checkAdminStatus } from '@/app/actions/profile';
import { updateDisplayName, updateEmailPreferences, deleteAccount } from '@/app/actions/updateSettings';

export default function ServerActionsDemo() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<any>(null);

  const handleGetProfile = () => {
    startTransition(async () => {
      const data = await getProfile();
      setResult(data);
    });
  };

  const handleGetInitials = () => {
    startTransition(async () => {
      const data = await getUserInitials();
      setResult(data);
    });
  };

  const handleCheckAdmin = () => {
    startTransition(async () => {
      const data = await checkAdminStatus();
      setResult(data);
    });
  };

  const handleUpdateName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const data = await updateDisplayName(formData);
      setResult(data);
      if (data.success) {
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  const handleUpdatePreferences = () => {
    startTransition(async () => {
      const data = await updateEmailPreferences({
        marketing: true,
        security: true,
        product: false,
      });
      setResult(data);
    });
  };

  const handleDeleteAccount = () => {
    const confirmation = prompt('Type DELETE to confirm:');
    if (!confirmation) return;
    
    startTransition(async () => {
      const data = await deleteAccount(confirmation);
      setResult(data);
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Server Actions Demo</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">About Server Actions</h2>
        <p className="text-sm text-blue-800">
          Server Actions are asynchronous functions that run on the server. They can be called directly from Client Components
          without creating API routes. This demo shows various patterns for using Latch with Server Actions.
        </p>
      </div>

      <div className="space-y-6">
        {/* Read Operations */}
        <section className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Read Operations (Query Data)</h2>
          <p className="text-sm text-gray-600 mb-4">
            These Server Actions read data and check authentication status.
          </p>
          
          <div className="space-x-2 space-y-2">
            <button
              onClick={handleGetProfile}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Get Profile
            </button>
            
            <button
              onClick={handleGetInitials}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Get Initials
            </button>
            
            <button
              onClick={handleCheckAdmin}
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Check Admin Status
            </button>
          </div>
        </section>

        {/* Write Operations */}
        <section className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Write Operations (Mutate Data)</h2>
          <p className="text-sm text-gray-600 mb-4">
            These Server Actions modify data and require authentication.
          </p>
          
          <form onSubmit={handleUpdateName} className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Update Display Name:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="name"
                placeholder="Enter new name"
                className="flex-1 px-3 py-2 border rounded"
                required
              />
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Update Name
              </button>
            </div>
          </form>
          
          <div className="space-x-2">
            <button
              onClick={handleUpdatePreferences}
              disabled={isPending}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Update Email Preferences
            </button>
          </div>
        </section>

        {/* Dangerous Operations */}
        <section className="border border-red-200 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-red-700">Dangerous Operations</h2>
          <p className="text-sm text-gray-600 mb-4">
            These Server Actions perform dangerous operations and require confirmation.
          </p>
          
          <button
            onClick={handleDeleteAccount}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Delete Account (Demo)
          </button>
        </section>

        {/* Result Display */}
        {result && (
          <section className="border rounded-lg p-4 bg-gray-50">
            <h2 className="text-xl font-semibold mb-2">Result</h2>
            <pre className="text-sm bg-white p-4 rounded border overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        )}

        {isPending && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-sm text-gray-600">Processing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Documentation Links */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Learn More</h3>
        <ul className="text-sm space-y-1">
          <li>
            <a href="/docs/SERVER_ACTIONS.md" className="text-blue-600 hover:underline">
              Server Actions Documentation
            </a>
          </li>
          <li>
            <a href="https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Next.js Server Actions Docs
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
