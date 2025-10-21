'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Token metadata for tracking expiry and managing auto-refresh
 */
interface TokenMetadata {
  token: string;
  expiresAt: number; // Unix timestamp in milliseconds
  issuedAt: number;  // Unix timestamp in milliseconds
}

/**
 * Configuration options for useAccessToken
 */
export interface UseAccessTokenOptions {
  /**
   * Enable automatic token refresh before expiry
   * @default true
   */
  autoRefresh?: boolean;

  /**
   * Seconds before expiry to trigger refresh
   * @default 300 (5 minutes)
   */
  refreshThreshold?: number;

  /**
   * Enable retry on refresh failure with exponential backoff
   * @default true
   */
  retryOnFailure?: boolean;

  /**
   * Maximum retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Pause auto-refresh when page is hidden (Page Visibility API)
   * @default true
   */
  pauseWhenHidden?: boolean;
}

export interface UseAccessTokenResult {
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
  expiresAt: number | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for Direct Token mode with enhanced auto-refresh
 * Returns a short-lived access token that can be used to call APIs directly
 *
 * Features:
 * - Auto-refresh before expiration with configurable threshold
 * - Exponential backoff retry on failure
 * - Page Visibility API support (pauses when hidden)
 * - Proper cleanup on unmount
 * - Stale token detection on mount
 *
 * WARNING: This exposes the access token to client JavaScript
 * Only use for read-only operations or in trusted environments
 */
export function useAccessToken(options: UseAccessTokenOptions = {}): UseAccessTokenResult {
  const {
    autoRefresh = true,
    refreshThreshold = 300, // 5 minutes
    retryOnFailure = true,
    maxRetries = 3,
    pauseWhenHidden = true,
  } = options;

  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for managing timers and retry state
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isPageVisibleRef = useRef(true);

  /**
   * Calculate milliseconds until token should be refreshed
   */
  const getTimeUntilRefresh = useCallback((expiresAt: number): number => {
    const now = Date.now();
    const expiresIn = expiresAt - now;
    const refreshAt = expiresAt - refreshThreshold * 1000;
    return Math.max(0, refreshAt - now);
  }, [refreshThreshold]);

  /**
   * Calculate exponential backoff delay
   */
  const getRetryDelay = useCallback((attempt: number): number => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  /**
   * Clear any existing refresh timer
   */
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /**
   * Schedule next refresh
   */
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (!autoRefresh) return;

    clearRefreshTimer();

    const timeUntilRefresh = getTimeUntilRefresh(expiresAt);

    if (timeUntilRefresh <= 0) {
      // Token is already expired or within refresh threshold, refresh immediately
      fetchToken();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      // Only refresh if page is visible or pauseWhenHidden is disabled
      if (isPageVisibleRef.current || !pauseWhenHidden) {
        fetchToken();
      } else {
        // Re-schedule for when page becomes visible
        scheduleRefresh(expiresAt);
      }
    }, timeUntilRefresh);
  }, [autoRefresh, getTimeUntilRefresh, pauseWhenHidden]);

  /**
   * Fetch or refresh access token
   */
  const fetchToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/latch/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to fetch access token');
      }

      const data = await response.json();
      const now = Date.now();
      const expiresAt = now + data.expires_in * 1000;

      const metadata: TokenMetadata = {
        token: data.access_token,
        expiresAt,
        issuedAt: now,
      };

      setTokenMetadata(metadata);
      retryCountRef.current = 0; // Reset retry count on success

      // Schedule next refresh
      if (autoRefresh) {
        scheduleRefresh(expiresAt);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setTokenMetadata(null);

      // Retry with exponential backoff if enabled
      if (retryOnFailure && retryCountRef.current < maxRetries) {
        const delay = getRetryDelay(retryCountRef.current);
        retryCountRef.current++;

        console.warn(
          `[Latch] Token refresh failed (attempt ${retryCountRef.current}/${maxRetries}), retrying in ${Math.round(delay / 1000)}s...`
        );

        refreshTimerRef.current = setTimeout(() => {
          fetchToken();
        }, delay);
      } else if (retryOnFailure && retryCountRef.current >= maxRetries) {
        console.error('[Latch] Token refresh failed after max retries');
      }
    } finally {
      setIsLoading(false);
    }
  }, [autoRefresh, retryOnFailure, maxRetries, getRetryDelay, scheduleRefresh]);

  /**
   * Handle page visibility changes
   */
  useEffect(() => {
    if (!pauseWhenHidden || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;

      if (!document.hidden && tokenMetadata) {
        // Page became visible - check if token needs refresh
        const timeUntilRefresh = getTimeUntilRefresh(tokenMetadata.expiresAt);

        if (timeUntilRefresh <= 0) {
          // Token needs refresh now
          fetchToken();
        } else if (autoRefresh) {
          // Re-schedule refresh
          scheduleRefresh(tokenMetadata.expiresAt);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseWhenHidden, tokenMetadata, autoRefresh, getTimeUntilRefresh, scheduleRefresh, fetchToken]);

  /**
   * Initial token fetch and stale token detection
   */
  useEffect(() => {
    if (tokenMetadata) {
      // Check if existing token is stale
      const timeUntilRefresh = getTimeUntilRefresh(tokenMetadata.expiresAt);

      if (timeUntilRefresh <= 0) {
        // Token is stale, refresh immediately
        fetchToken();
      } else if (autoRefresh) {
        // Schedule refresh for existing token
        scheduleRefresh(tokenMetadata.expiresAt);
      }
    } else {
      // No token, fetch initial token
      fetchToken();
    }

    // Cleanup on unmount
    return () => {
      clearRefreshTimer();
    };
  }, []); // Only run on mount/unmount

  return {
    accessToken: tokenMetadata?.token || null,
    isLoading,
    error,
    expiresAt: tokenMetadata?.expiresAt || null,
    refresh: fetchToken,
  };
}
