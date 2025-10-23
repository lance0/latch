import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exchangeCodeForTokens, refreshAccessToken } from '../../src/oidc/tokens';

// Mock fetch globally
global.fetch = vi.fn();

describe('Token Exchange Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeCodeForTokens', () => {
    const mockTokenResponse = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      id_token: 'mock_id_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    it('should exchange code with PKCE (public client)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await exchangeCodeForTokens(
        'auth_code',
        'code_verifier_123',
        'http://localhost:3000/callback',
        'client_id',
        'tenant_id',
        'commercial'
      );

      expect(tokens).toEqual(mockTokenResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/tenant_id/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      // Check that code_verifier was included in the request
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('code_verifier=code_verifier_123');
      expect(body).not.toContain('client_secret');
    });

    it('should exchange code with client_secret (confidential client)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await exchangeCodeForTokens(
        'auth_code',
        'code_verifier_123',
        'http://localhost:3000/callback',
        'client_id',
        'tenant_id',
        'commercial',
        'client_secret_abc'
      );

      expect(tokens).toEqual(mockTokenResponse);

      // Check that client_secret was included in the request
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('client_secret=client_secret_abc');
    });

    it('should support both PKCE and client_secret together', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await exchangeCodeForTokens(
        'auth_code',
        'code_verifier_123',
        'http://localhost:3000/callback',
        'client_id',
        'tenant_id',
        'commercial',
        'client_secret_abc'
      );

      expect(tokens).toEqual(mockTokenResponse);

      // Check that both were included
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('code_verifier=code_verifier_123');
      expect(body).toContain('client_secret=client_secret_abc');
    });

    it('should use correct endpoints for GCC-High', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      await exchangeCodeForTokens(
        'auth_code',
        'code_verifier_123',
        'http://localhost:3000/callback',
        'client_id',
        'tenant_id',
        'gcc-high',
        'client_secret_abc'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.us/tenant_id/oauth2/v2.0/token',
        expect.anything()
      );
    });

    it('should throw error on failed token exchange', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid authorization code',
      });

      await expect(
        exchangeCodeForTokens(
          'invalid_code',
          'code_verifier_123',
          'http://localhost:3000/callback',
          'client_id',
          'tenant_id',
          'commercial'
        )
      ).rejects.toThrow('Failed to exchange code for tokens');
    });
  });

  describe('refreshAccessToken', () => {
    const mockTokenResponse = {
      access_token: 'new_access_token',
      refresh_token: 'new_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    it('should refresh token with public client (no secret)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await refreshAccessToken(
        'refresh_token_123',
        'client_id',
        'tenant_id',
        'commercial',
        ['openid', 'profile', 'User.Read']
      );

      expect(tokens).toEqual(mockTokenResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/tenant_id/oauth2/v2.0/token',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=refresh_token_123');
      expect(body).not.toContain('client_secret');
    });

    it('should refresh token with confidential client (with secret)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const tokens = await refreshAccessToken(
        'refresh_token_123',
        'client_id',
        'tenant_id',
        'commercial',
        ['openid', 'profile', 'User.Read'],
        'client_secret_abc'
      );

      expect(tokens).toEqual(mockTokenResponse);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('client_secret=client_secret_abc');
    });

    it('should use default scopes when not provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      await refreshAccessToken(
        'refresh_token_123',
        'client_id',
        'tenant_id',
        'commercial'
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('scope=openid+profile+offline_access+User.Read');
    });

    it('should throw error on failed refresh', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      await expect(
        refreshAccessToken(
          'invalid_token',
          'client_id',
          'tenant_id',
          'commercial'
        )
      ).rejects.toThrow('Failed to refresh access token');
    });
  });
});
