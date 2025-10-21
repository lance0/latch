'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAccessTokenResult {
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for Direct Token mode
 * Returns a short-lived access token that can be used to call APIs directly
 *
 * WARNING: This exposes the access token to client JavaScript
 * Only use for read-only operations or in trusted environments
 */
export function useAccessToken(): UseAccessTokenResult {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/latch/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch access token');
      }

      const data = await response.json();
      setAccessToken(data.access_token);

      // Auto-refresh before expiration
      if (data.expires_in) {
        const refreshTime = (data.expires_in - 60) * 1000; // Refresh 60s before expiry
        setTimeout(() => {
          fetchToken();
        }, refreshTime);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return {
    accessToken,
    isLoading,
    error,
    refresh: fetchToken,
  };
}
