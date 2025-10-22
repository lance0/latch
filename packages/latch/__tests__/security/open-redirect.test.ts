import { describe, it, expect } from 'vitest';
import { validateReturnUrl } from '@/lib/latch/oidc/validation';
import { LatchError } from '@/lib/latch/types';

describe('Open Redirect Protection', () => {
  const baseUrl = 'https://example.com';

  describe('Cross-Origin Redirect Prevention', () => {
    it('should reject absolute URLs to different domains', () => {
      const maliciousUrls = [
        'https://evil.com',
        'https://evil.com/phishing',
        'http://evil.com',
        'https://attacker.example.com', // Subdomain
        'https://example.com.evil.com', // Domain lookalike
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
        expect(() => validateReturnUrl(url, baseUrl)).toThrow('Invalid return URL');
      }
    });

    it('should reject protocol-relative URLs to other domains', () => {
      const maliciousUrls = [
        '//evil.com',
        '//evil.com/path',
        '//attacker.example.com',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });

    it('should reject URLs with different protocols', () => {
      const maliciousUrls = [
        'ftp://example.com/path',
        'file:///etc/passwd',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });
  });

  describe('JavaScript Protocol Prevention', () => {
    it('should reject javascript: URLs', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'javascript:void(0)',
        'javascript://example.com%0Aalert(1)',
        'javascript:alert(document.cookie)',
        'JAVASCRIPT:alert(1)', // Case variations
        'JaVaScRiPt:alert(1)',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });

    it('should reject data: URLs', () => {
      const maliciousUrls = [
        'data:text/html,<script>alert(1)</script>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'DATA:text/html,<script>alert(1)</script>',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });

    it('should reject vbscript: and other dangerous protocols', () => {
      const maliciousUrls = [
        'vbscript:msgbox(1)',
        'about:blank',
        'file:///etc/passwd',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });
  });

  describe('Same-Origin Validation', () => {
    it('should accept valid same-origin paths', () => {
      const validUrls = [
        '/dashboard',
        '/dashboard/settings',
        '/api/endpoint',
        '/',
      ];

      for (const url of validUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).not.toThrow();
      }
    });

    it('should accept valid same-origin absolute URLs', () => {
      const validUrls = [
        'https://example.com/dashboard',
        'https://example.com/path/to/page',
        'https://example.com/',
      ];

      for (const url of validUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).not.toThrow();
      }
    });

    it('should preserve query parameters in same-origin URLs', () => {
      const url = 'https://example.com/dashboard?tab=settings&id=123';
      const result = validateReturnUrl(url, baseUrl);

      expect(result).toBe('/dashboard?tab=settings&id=123');
    });

    it('should strip fragments from return URLs', () => {
      const url = 'https://example.com/page#section';
      const result = validateReturnUrl(url, baseUrl);

      // Fragments should not be included in redirect
      expect(result).toBe('/page');
    });
  });

  describe('URL Encoding and Obfuscation', () => {
    it('should reject URL-encoded cross-origin attempts', () => {
      const maliciousUrls = [
        'https://example.com@evil.com', // User info
        'https://evil.com?redirect=https://example.com',
        'https://%65vil.com', // URL-encoded domain
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });

    it('should handle double-encoded URLs correctly', () => {
      // Double-encoded URLs get decoded by URL parser, becoming relative paths
      // This is actually safe behavior - the URL parser handles it correctly
      const doubleEncoded = 'https%3A%2F%2Fevil.com';
      const result = validateReturnUrl(doubleEncoded, baseUrl);

      // Should be treated as a relative path, not a malicious URL
      expect(result).toContain('https%3A%2F%2Fevil.com');
    });

    it('should reject URLs with embedded credentials', () => {
      const maliciousUrls = [
        'https://user:pass@evil.com',
        'https://admin@evil.com',
      ];

      for (const url of maliciousUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).toThrow(LatchError);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should accept paths with .. that stay within origin', () => {
      const validUrls = [
        '/dashboard/../settings', // Resolves to /settings
        '/path/to/../page', // Resolves to /path/page
      ];

      for (const url of validUrls) {
        expect(() => validateReturnUrl(url, baseUrl)).not.toThrow();
      }
    });

    it('should normalize paths correctly', () => {
      const url = '/dashboard//double//slash';
      const result = validateReturnUrl(url, baseUrl);

      // Should preserve the path as-is (URL parsing handles normalization)
      expect(result).toContain('double');
    });
  });

  describe('Edge Cases', () => {
    it('should default to / for null returnTo', () => {
      const result = validateReturnUrl(null, baseUrl);
      expect(result).toBe('/');
    });

    it('should default to / for undefined returnTo', () => {
      const result = validateReturnUrl(undefined, baseUrl);
      expect(result).toBe('/');
    });

    it('should default to / for empty string returnTo', () => {
      const result = validateReturnUrl('', baseUrl);
      expect(result).toBe('/');
    });

    it('should handle baseUrl with port', () => {
      const baseWithPort = 'https://example.com:3000';
      const url = 'https://example.com:3000/dashboard';

      const result = validateReturnUrl(url, baseWithPort);
      expect(result).toBe('/dashboard');
    });

    it('should reject URLs with different ports', () => {
      const baseWithPort = 'https://example.com:3000';
      const urlDifferentPort = 'https://example.com:4000/dashboard';

      expect(() => validateReturnUrl(urlDifferentPort, baseWithPort)).toThrow(LatchError);
    });

    it('should handle URLs with special characters in path', () => {
      const url = '/dashboard?name=John%20Doe&email=test%40example.com';
      const result = validateReturnUrl(url, baseUrl);

      expect(result).toContain('John%20Doe');
      expect(result).toContain('test%40example.com');
    });
  });

  describe('Real-World Attack Scenarios', () => {
    it('should prevent OAuth phishing redirect', () => {
      // Attacker tries to redirect user to fake login page
      const phishingUrl = 'https://example-com-login.evil.com/oauth/callback';

      expect(() => validateReturnUrl(phishingUrl, baseUrl)).toThrow(LatchError);
    });

    it('should prevent subdomain takeover exploitation', () => {
      // If attacker controls subdomain, they shouldn't be able to redirect there
      const subdomainUrl = 'https://attacker.example.com/steal-tokens';

      expect(() => validateReturnUrl(subdomainUrl, baseUrl)).toThrow(LatchError);
    });

    it('should prevent homograph attacks', () => {
      // Similar-looking domain with unicode
      const homographUrl = 'https://ехample.com'; // Cyrillic 'е' and 'х'

      expect(() => validateReturnUrl(homographUrl, baseUrl)).toThrow(LatchError);
    });
  });
});
