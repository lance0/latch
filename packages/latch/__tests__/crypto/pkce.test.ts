import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/latch/crypto/pkce';

describe('PKCE', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a code verifier', () => {
      const verifier = generateCodeVerifier();

      expect(verifier).toBeTruthy();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });

    it('should only contain valid base64url characters', () => {
      const verifier = generateCodeVerifier();
      const validPattern = /^[A-Za-z0-9_-]+$/;

      expect(validPattern.test(verifier)).toBe(true);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from verifier', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBe(43); // SHA-256 base64url is always 43 chars
    });

    it('should generate same challenge for same verifier', async () => {
      const verifier = 'test-verifier-12345';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should only contain valid base64url characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const validPattern = /^[A-Za-z0-9_-]+$/;

      expect(validPattern.test(challenge)).toBe(true);
    });

    it('should match known test vector (RFC 7636 example)', async () => {
      // This is a deterministic test based on the RFC example
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toBe(expectedChallenge);
    });
  });
});
