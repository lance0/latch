import { describe, it, expect } from 'vitest';
import { generateState, generateNonce } from '@/lib/latch/crypto/random';

describe('Random generators', () => {
  describe('generateState', () => {
    it('should generate a state parameter', () => {
      const state = generateState();

      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate unique states', () => {
      const state1 = generateState();
      const state2 = generateState();

      expect(state1).not.toBe(state2);
    });

    it('should only contain valid base64url characters', () => {
      const state = generateState();
      const validPattern = /^[A-Za-z0-9_-]+$/;

      expect(validPattern.test(state)).toBe(true);
    });
  });

  describe('generateNonce', () => {
    it('should generate a nonce', () => {
      const nonce = generateNonce();

      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
    });

    it('should only contain valid base64url characters', () => {
      const nonce = generateNonce();
      const validPattern = /^[A-Za-z0-9_-]+$/;

      expect(validPattern.test(nonce)).toBe(true);
    });
  });

  describe('entropy', () => {
    it('should generate sufficient unique values', () => {
      const states = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        states.add(generateState());
      }

      // All should be unique
      expect(states.size).toBe(iterations);
    });
  });
});
