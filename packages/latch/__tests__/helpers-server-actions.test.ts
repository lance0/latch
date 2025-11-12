import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession, requireAuth } from '../src/helpers';
import { LatchError } from '../src/types';
import { cookies } from 'next/headers';
import { unseal } from '../src/crypto/seal';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock crypto/seal
vi.mock('../src/crypto/seal', () => ({
  unseal: vi.fn(),
}));

// Mock config
vi.mock('../src/config', () => ({
  COOKIE_NAMES: {
    ID_TOKEN: 'latch_id',
    REFRESH_TOKEN: 'latch_rt',
    PKCE_DATA: 'latch_pkce',
  },
}));

const mockCookies = vi.mocked(cookies);
const mockUnseal = vi.mocked(unseal);

describe('Server Actions Helpers', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerSession', () => {
    it('should return unauthenticated session when no cookies', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any);

      const session = await getServerSession('test-secret');

      expect(session.isAuthenticated).toBe(false);
      expect(session.user).toBeNull();
    });

    it('should return authenticated session with valid cookies', async () => {
      const mockUser = {
        sub: '123',
        name: 'Test User',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockRefreshToken = {
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 86400000, // 1 day from now
      };

      mockCookies.mockResolvedValue({
        get: vi.fn()
          .mockReturnValueOnce({ value: 'sealed-id-token' })
          .mockReturnValueOnce({ value: 'sealed-refresh-token' }),
      } as any);

      mockUnseal
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockRefreshToken);

      const session = await getServerSession('test-secret');

      expect(session.isAuthenticated).toBe(true);
      expect(session.user).toEqual(mockUser);
    });

    it('should return unauthenticated when refresh token expired', async () => {
      const mockUser = {
        sub: '123',
        name: 'Test User',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockRefreshToken = {
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      };

      mockCookies.mockResolvedValue({
        get: vi.fn()
          .mockReturnValueOnce({ value: 'sealed-id-token' })
          .mockReturnValueOnce({ value: 'sealed-refresh-token' }),
      } as any);

      mockUnseal
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockRefreshToken);

      const session = await getServerSession('test-secret');

      expect(session.isAuthenticated).toBe(false);
      expect(session.user).toBeNull();
    });

    it('should return unauthenticated on decryption error', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn()
          .mockReturnValueOnce({ value: 'invalid-sealed-data' })
          .mockReturnValueOnce({ value: 'invalid-sealed-data' }),
      } as any);

      mockUnseal.mockRejectedValue(new Error('Decryption failed'));

      const session = await getServerSession('test-secret');

      expect(session.isAuthenticated).toBe(false);
      expect(session.user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        sub: '123',
        name: 'Test User',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockRefreshToken = {
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 86400000,
      };

      mockCookies.mockResolvedValue({
        get: vi.fn()
          .mockReturnValueOnce({ value: 'sealed-id-token' })
          .mockReturnValueOnce({ value: 'sealed-refresh-token' }),
      } as any);

      mockUnseal
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockRefreshToken);

      const user = await requireAuth('test-secret');

      expect(user).toEqual(mockUser);
    });

    it('should throw LatchError when not authenticated', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any);

      await expect(requireAuth('test-secret')).rejects.toThrow(LatchError);
      await expect(requireAuth('test-secret')).rejects.toThrow('Authentication required');
    });

    it('should throw with LATCH_UNAUTHORIZED code', async () => {
      mockCookies.mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any);

      try {
        await requireAuth('test-secret');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LatchError);
        expect((error as LatchError).code).toBe('LATCH_UNAUTHORIZED');
      }
    });
  });
});
