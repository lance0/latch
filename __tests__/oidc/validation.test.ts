import { describe, it, expect } from 'vitest';
import { validateState, validateReturnUrl } from '@/lib/latch/oidc/validation';
import { LatchError } from '@/lib/latch/types';

describe('OIDC Validation', () => {
  describe('validateState', () => {
    it('should validate matching states', () => {
      const state = 'test-state-12345';

      expect(() => validateState(state, state)).not.toThrow();
    });

    it('should throw on missing state', () => {
      expect(() => validateState(null, 'expected-state')).toThrow(LatchError);
      expect(() => validateState(null, 'expected-state')).toThrow('State parameter is missing');
    });

    it('should throw on mismatched states', () => {
      expect(() => validateState('received-state', 'expected-state')).toThrow(LatchError);
      expect(() => validateState('received-state', 'expected-state')).toThrow(
        'State parameter does not match'
      );
    });
  });

  describe('validateReturnUrl', () => {
    const baseUrl = 'https://example.com';

    it('should return / for null returnTo', () => {
      const result = validateReturnUrl(null, baseUrl);
      expect(result).toBe('/');
    });

    it('should return / for undefined returnTo', () => {
      const result = validateReturnUrl(undefined, baseUrl);
      expect(result).toBe('/');
    });

    it('should validate same-origin URLs', () => {
      const returnTo = 'https://example.com/dashboard';
      const result = validateReturnUrl(returnTo, baseUrl);

      expect(result).toBe('/dashboard');
    });

    it('should handle URLs with query parameters', () => {
      const returnTo = 'https://example.com/dashboard?tab=settings&id=123';
      const result = validateReturnUrl(returnTo, baseUrl);

      expect(result).toBe('/dashboard?tab=settings&id=123');
    });

    it('should handle relative URLs', () => {
      const returnTo = '/dashboard';
      const result = validateReturnUrl(returnTo, baseUrl);

      expect(result).toBe('/dashboard');
    });

    it('should reject cross-origin URLs', () => {
      const returnTo = 'https://evil.com/phishing';

      expect(() => validateReturnUrl(returnTo, baseUrl)).toThrow(LatchError);
      expect(() => validateReturnUrl(returnTo, baseUrl)).toThrow('Invalid return URL');
    });

    it('should reject javascript: URLs', () => {
      const returnTo = 'javascript:alert(1)';

      expect(() => validateReturnUrl(returnTo, baseUrl)).toThrow(LatchError);
    });

    it('should handle URLs with fragments', () => {
      const returnTo = 'https://example.com/page#section';
      const result = validateReturnUrl(returnTo, baseUrl);

      // Fragments are not included in pathname + search
      expect(result).toBe('/page');
    });

    it('should normalize paths', () => {
      const returnTo = 'https://example.com///dashboard//';
      const result = validateReturnUrl(returnTo, baseUrl);

      expect(result).toBe('///dashboard//');
    });
  });
});
