import { describe, it, expect } from 'vitest';
import { validateIssuer } from '../../src/config';
import { LatchError } from '../../src/types';

describe('Issuer Validation - Token Confusion Prevention', () => {
  const mockTenantId = '12345678-1234-1234-1234-123456789012';

  describe('Commercial Cloud', () => {
    it('should accept valid commercial v2.0 issuer', () => {
      const issuer = `https://login.microsoftonline.com/${mockTenantId}/v2.0`;
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).not.toThrow();
    });

    it('should accept valid commercial v1.0 issuer', () => {
      const issuer = `https://sts.windows.net/${mockTenantId}/`;
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).not.toThrow();
    });

    it('should reject government cloud issuer', () => {
      const issuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).toThrow(LatchError);
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).toThrow(/government/i);
    });

    it('should reject wrong tenant', () => {
      const wrongTenantId = '87654321-4321-4321-4321-210987654321';
      const issuer = `https://login.microsoftonline.com/${wrongTenantId}/v2.0`;
      
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).toThrow(LatchError);
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).toThrow(/tenant/i);
    });
  });

  describe('GCC-High Cloud', () => {
    it('should accept valid GCC-High v2.0 issuer', () => {
      const issuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      expect(() => validateIssuer(issuer, mockTenantId, 'gcc-high')).not.toThrow();
    });

    it('should accept valid GCC-High v1.0 issuer', () => {
      const issuer = `https://sts.windows.net/${mockTenantId}/`;
      expect(() => validateIssuer(issuer, mockTenantId, 'gcc-high')).not.toThrow();
    });

    it('should reject commercial cloud issuer', () => {
      const issuer = `https://login.microsoftonline.com/${mockTenantId}/v2.0`;
      
      expect(() => validateIssuer(issuer, mockTenantId, 'gcc-high')).toThrow(LatchError);
      expect(() => validateIssuer(issuer, mockTenantId, 'gcc-high')).toThrow(/commercial/i);
    });
  });

  describe('DoD Cloud', () => {
    it('should accept valid DoD v2.0 issuer', () => {
      const issuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      expect(() => validateIssuer(issuer, mockTenantId, 'dod')).not.toThrow();
    });

    it('should accept valid DoD v1.0 issuer', () => {
      const issuer = `https://sts.windows.net/${mockTenantId}/`;
      expect(() => validateIssuer(issuer, mockTenantId, 'dod')).not.toThrow();
    });

    it('should reject commercial cloud issuer', () => {
      const issuer = `https://login.microsoftonline.com/${mockTenantId}/v2.0`;
      
      expect(() => validateIssuer(issuer, mockTenantId, 'dod')).toThrow(LatchError);
      expect(() => validateIssuer(issuer, mockTenantId, 'dod')).toThrow(/commercial/i);
    });
  });

  describe('Error Cases', () => {
    it('should throw on missing issuer', () => {
      expect(() => validateIssuer(undefined, mockTenantId, 'commercial')).toThrow(LatchError);
      expect(() => validateIssuer(undefined, mockTenantId, 'commercial')).toThrow(/missing issuer/i);
    });

    it('should throw on completely invalid issuer', () => {
      const issuer = 'https://evil.com/fake/issuer';
      
      expect(() => validateIssuer(issuer, mockTenantId, 'commercial')).toThrow(LatchError);
    });

    it('should provide helpful error message for cloud mismatch', () => {
      const issuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      
      try {
        validateIssuer(issuer, mockTenantId, 'commercial');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LatchError);
        const message = (error as Error).message;
        expect(message).toContain('LATCH_CLOUD');
        expect(message).toContain('gcc-high');
      }
    });

    it('should provide helpful error message for tenant mismatch', () => {
      const wrongTenantId = '87654321-4321-4321-4321-210987654321';
      const issuer = `https://login.microsoftonline.com/${wrongTenantId}/v2.0`;
      
      try {
        validateIssuer(issuer, mockTenantId, 'commercial');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LatchError);
        const message = (error as Error).message;
        expect(message).toContain('tenant');
        expect(message).toContain(mockTenantId);
      }
    });
  });

  describe('Multi-Tenant Scenarios', () => {
    it('should prevent token from tenant A being used in tenant B', () => {
      const tenantA = '11111111-1111-1111-1111-111111111111';
      const tenantB = '22222222-2222-2222-2222-222222222222';
      
      const tokenFromTenantA = `https://login.microsoftonline.com/${tenantA}/v2.0`;
      
      // Should work for tenant A
      expect(() => validateIssuer(tokenFromTenantA, tenantA, 'commercial')).not.toThrow();
      
      // Should fail for tenant B
      expect(() => validateIssuer(tokenFromTenantA, tenantB, 'commercial')).toThrow(LatchError);
    });

    it('should prevent cross-cloud token replay', () => {
      const commercialIssuer = `https://login.microsoftonline.com/${mockTenantId}/v2.0`;
      const govIssuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      
      // Commercial token should not work for GCC-High
      expect(() => validateIssuer(commercialIssuer, mockTenantId, 'gcc-high')).toThrow(LatchError);
      
      // GCC-High token should not work for Commercial
      expect(() => validateIssuer(govIssuer, mockTenantId, 'commercial')).toThrow(LatchError);
    });
  });

  describe('Security - Token Confusion Attack Scenarios', () => {
    it('should prevent attacker token from different tenant', () => {
      const attackerTenant = '99999999-9999-9999-9999-999999999999';
      const victimTenant = '00000000-0000-0000-0000-000000000000';
      
      // Attacker obtains valid token from their tenant
      const attackerToken = `https://login.microsoftonline.com/${attackerTenant}/v2.0`;
      
      // Try to use it against victim's application
      expect(() => validateIssuer(attackerToken, victimTenant, 'commercial')).toThrow(LatchError);
    });

    it('should prevent government token being used in commercial app', () => {
      // Attacker gets token from government cloud
      const govToken = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      
      // Try to use in commercial application with same tenant ID
      expect(() => validateIssuer(govToken, mockTenantId, 'commercial')).toThrow(LatchError);
    });

    it('should log clear security warning on mismatch', () => {
      const issuer = `https://login.microsoftonline.us/${mockTenantId}/v2.0`;
      
      try {
        validateIssuer(issuer, mockTenantId, 'commercial');
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('token confusion');
        expect(message).toContain('issuer mismatch');
      }
    });
  });
});
