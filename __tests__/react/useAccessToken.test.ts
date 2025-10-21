import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccessToken } from '@/lib/latch/react/useAccessToken';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAccessToken - Enhanced Auto-Refresh', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Token Fetching', () => {
    it('should fetch access token on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token-123',
          expires_in: 3600,
        }),
      });

      const { result } = renderHook(() => useAccessToken({ autoRefresh: false }));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.accessToken).toBe('test-token-123');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should track token expiry time', async () => {
      const expiresIn = 3600; // 1 hour
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: expiresIn,
        }),
      });

      const { result } = renderHook(() => useAccessToken({ autoRefresh: false }));

      await waitFor(() => {
        expect(result.current.expiresAt).toBeTruthy();
      });

      const expiresAt = result.current.expiresAt!;
      const now = Date.now();
      const expectedExpiry = now + expiresIn * 1000;

      // Should be within 1 second tolerance
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000);
    });

    it('should return null expiresAt when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.expiresAt).toBeNull();
      expect(result.current.accessToken).toBeNull();
    });
  });

  describe('Configuration Options', () => {
    it('should disable auto-refresh when autoRefresh is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-1',
          expires_in: 1, // Very short expiry
        }),
      });

      const { result } = renderHook(() => useAccessToken({ autoRefresh: false }));

      await waitFor(() => {
        expect(result.current.accessToken).toBe('token-1');
      });

      // Wait for token to "expire"
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should not have refreshed (still only 1 call)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should accept custom refresh threshold', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token-1',
          expires_in: 3600,
        }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, refreshThreshold: 60 })
      );

      await waitFor(() => {
        expect(result.current.accessToken).toBe('token-1');
      });

      // Verify it doesn't crash with custom threshold
      expect(result.current.error).toBeNull();
    });
  });

  describe('Manual Refresh', () => {
    it('should allow manual token refresh', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            access_token: `token-${callCount}`,
            expires_in: 3600,
          }),
        };
      });

      const { result } = renderHook(() => useAccessToken({ autoRefresh: false }));

      await waitFor(() => {
        expect(result.current.accessToken).toBe('token-1');
      });

      // Manual refresh
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.accessToken).toBe('token-2');
      });

      expect(callCount).toBe(2);
    });

    it('should clear error on successful manual refresh', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            json: async () => ({ message: 'Error' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            access_token: 'token-success',
            expires_in: 3600,
          }),
        };
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Manual refresh
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.accessToken).toBe('token-success');
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should set error state on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain('Unauthorized');
      expect(result.current.accessToken).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain('Failed to fetch access token');
    });
  });

  describe('Loading State', () => {
    it('should set isLoading during token fetch', async () => {
      let resolvePromise: (value: Response) => void;
      const promise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useAccessToken({ autoRefresh: false }));

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      } as Response);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set isLoading to false after error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Error' }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Retry Logic', () => {
    it('should not retry when retryOnFailure is false', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Error' }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: false })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Wait a bit to ensure no retries
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only have been called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure with retryOnFailure enabled', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            json: async () => ({ message: 'Temporary error' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            access_token: 'token-after-retry',
            expires_in: 3600,
          }),
        };
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: true, maxRetries: 3 })
      );

      // Should eventually succeed after retries
      await waitFor(
        () => {
          expect(result.current.accessToken).toBe('token-after-retry');
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeNull();
      expect(callCount).toBe(3);
    }, 15000);

    it('should respect maxRetries limit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Persistent error' }),
      });

      const { result } = renderHook(() =>
        useAccessToken({ autoRefresh: false, retryOnFailure: true, maxRetries: 2 })
      );

      // Wait for all retries
      await waitFor(
        () => {
          expect(mockFetch.mock.calls.length).toBe(3); // Initial + 2 retries
        },
        { timeout: 10000 }
      );

      // Should still have error
      expect(result.current.error).toBeTruthy();
    }, 15000);
  });

  describe('Cleanup', () => {
    it('should not crash on unmount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 3600,
        }),
      });

      const { result, unmount } = renderHook(() => useAccessToken({ autoRefresh: false }));

      await waitFor(() => {
        expect(result.current.accessToken).toBe('test-token');
      });

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Auto-Refresh Integration', () => {
    it('should schedule auto-refresh with default settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 600, // 10 minutes
        }),
      });

      const { result } = renderHook(() => useAccessToken({ autoRefresh: true }));

      await waitFor(() => {
        expect(result.current.accessToken).toBe('test-token');
      });

      // Verify auto-refresh is enabled (expiresAt is set)
      expect(result.current.expiresAt).toBeTruthy();
      expect(result.current.error).toBeNull();
    });
  });
});
