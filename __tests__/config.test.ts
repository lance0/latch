import { describe, it, expect } from 'vitest';
import { getAzureEndpoints, validateScopes } from '@/lib/latch/config';
import { LatchError } from '@/lib/latch/types';

describe('Config', () => {
  describe('getAzureEndpoints', () => {
    const tenantId = 'test-tenant-id';

    it('should return commercial endpoints', () => {
      const endpoints = getAzureEndpoints('commercial', tenantId);

      expect(endpoints.loginBaseUrl).toBe('https://login.microsoftonline.com');
      expect(endpoints.graphBaseUrl).toBe('https://graph.microsoft.com');
      expect(endpoints.authorizeUrl).toContain('login.microsoftonline.com');
      expect(endpoints.tokenUrl).toContain('login.microsoftonline.com');
      expect(endpoints.logoutUrl).toContain('login.microsoftonline.com');
      expect(endpoints.jwksUri).toContain('login.microsoftonline.com');
    });

    it('should return GCC-High endpoints', () => {
      const endpoints = getAzureEndpoints('gcc-high', tenantId);

      expect(endpoints.loginBaseUrl).toBe('https://login.microsoftonline.us');
      expect(endpoints.graphBaseUrl).toBe('https://graph.microsoft.us');
      expect(endpoints.authorizeUrl).toContain('login.microsoftonline.us');
      expect(endpoints.tokenUrl).toContain('login.microsoftonline.us');
      expect(endpoints.logoutUrl).toContain('login.microsoftonline.us');
      expect(endpoints.jwksUri).toContain('login.microsoftonline.us');
    });

    it('should return DoD endpoints', () => {
      const endpoints = getAzureEndpoints('dod', tenantId);

      expect(endpoints.loginBaseUrl).toBe('https://login.microsoftonline.us');
      expect(endpoints.graphBaseUrl).toBe('https://dod-graph.microsoft.us');
      expect(endpoints.authorizeUrl).toContain('login.microsoftonline.us');
      expect(endpoints.tokenUrl).toContain('login.microsoftonline.us');
    });

    it('should include tenant ID in endpoints', () => {
      const endpoints = getAzureEndpoints('commercial', tenantId);

      expect(endpoints.authorizeUrl).toContain(tenantId);
      expect(endpoints.tokenUrl).toContain(tenantId);
      expect(endpoints.logoutUrl).toContain(tenantId);
      expect(endpoints.jwksUri).toContain(tenantId);
    });
  });

  describe('validateScopes', () => {
    it('should pass for valid commercial scopes', () => {
      const scopes = ['openid', 'profile', 'User.Read'];

      expect(() => validateScopes(scopes, 'commercial')).not.toThrow();
    });

    it('should pass for valid GCC-High scopes', () => {
      const scopes = ['openid', 'profile', 'User.Read'];

      expect(() => validateScopes(scopes, 'gcc-high')).not.toThrow();
    });

    it('should throw when using .com Graph in GCC-High', () => {
      const scopes = ['https://graph.microsoft.com/User.Read'];

      expect(() => validateScopes(scopes, 'gcc-high')).toThrow(LatchError);
      expect(() => validateScopes(scopes, 'gcc-high')).toThrow('Cloud is set to');
    });

    it('should throw when using .us Graph in commercial', () => {
      const scopes = ['https://graph.microsoft.us/User.Read'];

      expect(() => validateScopes(scopes, 'commercial')).toThrow(LatchError);
      expect(() => validateScopes(scopes, 'commercial')).toThrow('Cloud is set to');
    });

    it('should throw when using .com Graph in DoD', () => {
      const scopes = ['https://graph.microsoft.com/User.Read'];

      expect(() => validateScopes(scopes, 'dod')).toThrow(LatchError);
    });
  });
});
