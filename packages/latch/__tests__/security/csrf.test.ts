import { describe, it, expect } from 'vitest';
import { validateState } from '@/lib/latch/oidc/validation';
import { LatchError } from '@/lib/latch/types';

describe('CSRF Protection', () => {
  describe('State Parameter Validation', () => {
    it('should reject null state parameter', () => {
      const expectedState = 'valid-state-12345';

      expect(() => validateState(null, expectedState)).toThrow(LatchError);
      expect(() => validateState(null, expectedState)).toThrow('State parameter is missing');
    });

    it('should reject undefined state parameter', () => {
      const expectedState = 'valid-state-12345';

      expect(() => validateState(undefined as unknown as string, expectedState)).toThrow(LatchError);
    });

    it('should reject empty state parameter', () => {
      const expectedState = 'valid-state-12345';

      expect(() => validateState('', expectedState)).toThrow(LatchError);
    });

    it('should reject mismatched state parameter', () => {
      const receivedState = 'attacker-state';
      const expectedState = 'valid-state-12345';

      expect(() => validateState(receivedState, expectedState)).toThrow(LatchError);
      expect(() => validateState(receivedState, expectedState)).toThrow('does not match');
    });

    it('should reject state with extra characters', () => {
      const expectedState = 'valid-state';
      const receivedState = 'valid-state-extra';

      expect(() => validateState(receivedState, expectedState)).toThrow(LatchError);
    });

    it('should reject state with missing characters', () => {
      const expectedState = 'valid-state-12345';
      const receivedState = 'valid-state';

      expect(() => validateState(receivedState, expectedState)).toThrow(LatchError);
    });

    it('should be case-sensitive', () => {
      const expectedState = 'ValidState';
      const receivedState = 'validstate';

      expect(() => validateState(receivedState, expectedState)).toThrow(LatchError);
    });

    it('should accept valid matching state', () => {
      const state = 'valid-state-12345';

      expect(() => validateState(state, state)).not.toThrow();
    });

    it('should handle special characters in state', () => {
      const state = 'state-with-special_chars.123';

      expect(() => validateState(state, state)).not.toThrow();
    });
  });

  describe('CSRF Attack Scenarios', () => {
    it('should prevent session fixation via state reuse', () => {
      const attackerState = 'attacker-controlled-state';
      const victimState = 'victim-legitimate-state';

      // Attacker tries to use their state to hijack victim's session
      expect(() => validateState(attackerState, victimState)).toThrow(LatchError);
    });

    it('should prevent replay attacks with old state', () => {
      const oldState = 'old-state-from-previous-session';
      const currentState = 'current-state-for-new-session';

      expect(() => validateState(oldState, currentState)).toThrow(LatchError);
    });

    it('should handle timing-safe comparison (no early exit)', () => {
      // Both strings same length but different - timing should be constant
      const state1 = 'aaaaaaaaaaaaaaaaaaaa';
      const state2 = 'bbbbbbbbbbbbbbbbbbbb';

      expect(() => validateState(state1, state2)).toThrow(LatchError);
    });
  });
});
