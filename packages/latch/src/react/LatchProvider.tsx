'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { LatchUser, LatchSession } from '../types';

interface LatchContextValue {
  user: LatchUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  signIn: (returnTo?: string) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const LatchContext = createContext<LatchContextValue | null>(null);

interface LatchProviderProps {
  children: React.ReactNode;
}

export function LatchProvider({ children }: LatchProviderProps) {
  const [user, setUser] = useState<LatchUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch session on mount
  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/latch/session');
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const session: LatchSession = await response.json();
      setUser(session.user);
      setIsAuthenticated(session.isAuthenticated);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Auto-refresh session before token expiry
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Token expiry is in seconds (Unix timestamp), convert to milliseconds
    const tokenExpiry = user.exp * 1000;
    const refreshBuffer = 5 * 60 * 1000; // Refresh 5 minutes before expiry
    const refreshAt = tokenExpiry - refreshBuffer;
    const timeUntilRefresh = refreshAt - Date.now();

    // If token expires in less than 5 minutes, refresh immediately
    if (timeUntilRefresh <= 0) {
      fetchSession();
      return;
    }

    // Set timer to refresh before expiry
    const timer = setTimeout(() => {
      fetchSession();
    }, timeUntilRefresh);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, fetchSession]);

  const signIn = useCallback((returnTo?: string) => {
    const params = new URLSearchParams();
    if (returnTo) {
      params.set('returnTo', returnTo);
    }
    window.location.href = `/api/latch/start?${params.toString()}`;
  }, []);

  const signOut = useCallback(() => {
    window.location.href = '/api/latch/logout';
  }, []);

  const refresh = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  const value: LatchContextValue = {
    user,
    isAuthenticated,
    isLoading,
    error,
    signIn,
    signOut,
    refresh,
  };

  return <LatchContext.Provider value={value}>{children}</LatchContext.Provider>;
}

/**
 * Hook to access Latch authentication state and methods
 */
export function useLatch() {
  const context = useContext(LatchContext);
  if (!context) {
    throw new Error('useLatch must be used within a LatchProvider');
  }
  return context;
}
