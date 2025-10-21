import { describe, it, expect } from 'vitest';
import { validateScopes } from '@/lib/latch/config';
import { LatchError } from '@/lib/latch/types';

describe('Scope Escalation Protection', () => {
  describe('Cloud Endpoint Validation', () => {
    it('should reject .com Graph scopes in GCC-High cloud', () => {
      const commercialGraphScopes = [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/.default',
        'https://graph.microsoft.com/Mail.Read',
      ];

      for (const scope of commercialGraphScopes) {
        expect(() => validateScopes([scope], 'gcc-high')).toThrow(LatchError);
        expect(() => validateScopes([scope], 'gcc-high')).toThrow('commercial Graph URL');
        expect(() => validateScopes([scope], 'gcc-high')).toThrow('Cloud is set to');
      }
    });

    it('should reject .com Graph scopes in DoD cloud', () => {
      const commercialGraphScopes = [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/.default',
      ];

      for (const scope of commercialGraphScopes) {
        expect(() => validateScopes([scope], 'dod')).toThrow(LatchError);
        expect(() => validateScopes([scope], 'dod')).toThrow('commercial Graph URL');
      }
    });

    it('should reject .us Graph scopes in Commercial cloud', () => {
      const govGraphScopes = [
        'https://graph.microsoft.us/User.Read',
        'https://graph.microsoft.us/.default',
        'https://dod-graph.microsoft.us/User.Read',
      ];

      for (const scope of govGraphScopes) {
        expect(() => validateScopes([scope], 'commercial')).toThrow(LatchError);
        expect(() => validateScopes([scope], 'commercial')).toThrow('Government Graph URL');
      }
    });

    it('should accept correct Graph scopes for each cloud', () => {
      // Commercial
      expect(() => validateScopes(['User.Read'], 'commercial')).not.toThrow();
      expect(() => validateScopes(['openid', 'profile'], 'commercial')).not.toThrow();

      // GCC-High
      expect(() => validateScopes(['User.Read'], 'gcc-high')).not.toThrow();
      expect(() => validateScopes(['openid', 'profile'], 'gcc-high')).not.toThrow();

      // DoD
      expect(() => validateScopes(['User.Read'], 'dod')).not.toThrow();
      expect(() => validateScopes(['openid', 'profile'], 'dod')).not.toThrow();
    });
  });

  describe('Mixed Scope Validation', () => {
    it('should reject if any scope contains wrong endpoint', () => {
      const mixedScopes = [
        'openid',
        'profile',
        'User.Read',
        'https://graph.microsoft.com/Mail.Read', // Wrong endpoint
      ];

      expect(() => validateScopes(mixedScopes, 'gcc-high')).toThrow(LatchError);
    });

    it('should validate all scopes in array', () => {
      const allCommercial = [
        'openid',
        'profile',
        'User.Read',
        'Mail.Read',
        'Calendars.Read',
      ];

      expect(() => validateScopes(allCommercial, 'commercial')).not.toThrow();

      const allGov = [
        'openid',
        'profile',
        'User.Read',
        'Mail.Read',
      ];

      expect(() => validateScopes(allGov, 'gcc-high')).not.toThrow();
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case-insensitive for endpoint detection', () => {
      const upperCaseScopes = [
        'HTTPS://GRAPH.MICROSOFT.COM/User.Read',
      ];

      // Should still detect .com in uppercase
      expect(() => validateScopes(upperCaseScopes, 'gcc-high')).toThrow(LatchError);
    });

    it('should detect .com in various casings', () => {
      const variations = [
        'https://graph.microsoft.COM/User.Read',
        'https://GRAPH.microsoft.com/User.Read',
        'https://Graph.Microsoft.Com/User.Read',
      ];

      for (const scope of variations) {
        expect(() => validateScopes([scope], 'gcc-high')).toThrow(LatchError);
      }
    });
  });

  describe('Attack Scenarios', () => {
    it('should prevent privilege escalation via scope injection', () => {
      // Attacker tries to sneak in commercial endpoint to get unrestricted data
      const attackScopes = [
        'User.Read',
        'https://graph.microsoft.com/.default', // Escalation attempt
      ];

      expect(() => validateScopes(attackScopes, 'gcc-high')).toThrow(LatchError);
    });

    it('should prevent cloud boundary crossing', () => {
      // GCC-High app trying to access commercial Graph (data exfiltration)
      const exfiltrationScopes = [
        'https://graph.microsoft.com/Mail.ReadWrite.All',
        'https://graph.microsoft.com/Files.ReadWrite.All',
      ];

      for (const scope of exfiltrationScopes) {
        expect(() => validateScopes([scope], 'gcc-high')).toThrow(LatchError);
      }
    });

    it('should prevent DoD data access from commercial tenant', () => {
      // Commercial app trying to access DoD Graph (IL5 data)
      const dodScopes = [
        'https://dod-graph.microsoft.us/User.Read',
      ];

      expect(() => validateScopes(dodScopes, 'commercial')).toThrow(LatchError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scope array', () => {
      expect(() => validateScopes([], 'commercial')).not.toThrow();
      expect(() => validateScopes([], 'gcc-high')).not.toThrow();
      expect(() => validateScopes([], 'dod')).not.toThrow();
    });

    it('should handle scopes with extra whitespace', () => {
      const scopesWithWhitespace = [
        '  User.Read  ',
        'openid',
        ' profile ',
      ];

      // Should pass validation (whitespace handled by join)
      expect(() => validateScopes(scopesWithWhitespace, 'commercial')).not.toThrow();
    });

    it('should handle offline_access scope', () => {
      const scopesWithOfflineAccess = [
        'openid',
        'offline_access',
        'User.Read',
      ];

      expect(() => validateScopes(scopesWithOfflineAccess, 'gcc-high')).not.toThrow();
    });

    it('should handle custom application scopes', () => {
      const customScopes = [
        'api://12345678-1234-1234-1234-123456789abc/user_impersonation',
        'User.Read',
      ];

      // Custom app scopes don't contain graph.microsoft.com
      expect(() => validateScopes(customScopes, 'gcc-high')).not.toThrow();
    });
  });

  describe('Compliance Scenarios', () => {
    it('should enforce IL4 boundary (GCC-High)', () => {
      // IL4 data must not leak to commercial
      const commercialAttempt = 'https://graph.microsoft.com/User.Read';

      expect(() => validateScopes([commercialAttempt], 'gcc-high')).toThrow(LatchError);
    });

    it('should enforce IL5 boundary (DoD)', () => {
      // IL5 data is even more restricted
      const commercialAttempt = 'https://graph.microsoft.com/User.Read';

      expect(() => validateScopes([commercialAttempt], 'dod')).toThrow(LatchError);
    });

    it('should prevent accidental cloud misconfiguration', () => {
      // Developer accidentally uses wrong endpoint
      const devMistake = [
        'openid',
        'profile',
        'https://graph.microsoft.com/User.Read', // Oops, copy-pasted from docs
      ];

      expect(() => validateScopes(devMistake, 'gcc-high')).toThrow(LatchError);

      // Error message should be helpful
      try {
        validateScopes(devMistake, 'gcc-high');
      } catch (error) {
        if (error instanceof LatchError) {
          expect(error.message).toContain('commercial');
          expect(error.message).toContain('.us');
        }
      }
    });
  });
});
