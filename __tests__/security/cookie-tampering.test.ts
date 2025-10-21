import { describe, it, expect } from 'vitest';
import { seal, unseal } from '@/lib/latch/crypto/seal';
import { LatchError } from '@/lib/latch/types';

describe('Cookie Tampering Protection', () => {
  const secret = 'test-secret-key-with-at-least-32-chars-for-security';

  describe('AES-GCM Authentication', () => {
    it('should detect tampered ciphertext', async () => {
      const data = { userId: '123', role: 'user' };
      const sealed = await seal(data, secret);

      // Tamper with the last few characters
      const tampered = sealed.slice(0, -5) + 'XXXXX';

      await expect(unseal(tampered, secret)).rejects.toThrow(LatchError);
      await expect(unseal(tampered, secret)).rejects.toThrow('Failed to decrypt data');
    });

    it('should detect tampered IV', async () => {
      const data = { userId: '123' };
      const sealed = await seal(data, secret);

      // Decode, tamper with IV (first 16 base64url chars), re-encode
      const tampered = 'AAAAAAAAAAAAAAAA' + sealed.slice(16);

      await expect(unseal(tampered, secret)).rejects.toThrow(LatchError);
    });

    it('should detect tampered auth tag', async () => {
      const data = { userId: '123' };
      const sealed = await seal(data, secret);

      // Replace middle section (where auth tag is)
      const start = sealed.slice(0, 20);
      const end = sealed.slice(40);
      const tampered = start + 'XXXXXXXXXXXXXXXXXXXX' + end;

      await expect(unseal(tampered, secret)).rejects.toThrow(LatchError);
    });

    it('should reject completely invalid base64url', async () => {
      const invalid = '!!!invalid base64url!!!';

      await expect(unseal(invalid, secret)).rejects.toThrow(LatchError);
    });

    it('should reject truncated sealed data', async () => {
      const data = { userId: '123' };
      const sealed = await seal(data, secret);

      // Truncate to insufficient length
      const truncated = sealed.slice(0, 20);

      await expect(unseal(truncated, secret)).rejects.toThrow(LatchError);
    });

    it('should reject sealed data with wrong secret', async () => {
      const data = { userId: '123', role: 'admin' };
      const sealed = await seal(data, secret);

      const wrongSecret = 'different-secret-key-attacker-doesnt-know-this';

      await expect(unseal(sealed, wrongSecret)).rejects.toThrow(LatchError);
    });
  });

  describe('Privilege Escalation Attempts', () => {
    it('should prevent role elevation via tampering', async () => {
      const userData = { userId: '123', role: 'user' };
      const sealed = await seal(userData, secret);

      // Attacker tries to modify sealed data
      // (This will fail because AES-GCM verifies integrity)
      const tamperedAttempts = [
        sealed.slice(0, -10) + 'admin12345', // Modify end
        sealed + 'extra-data', // Append data
        'prefix-' + sealed, // Prepend data
      ];

      for (const tampered of tamperedAttempts) {
        if (tampered !== sealed) { // Only test if actually different
          await expect(unseal(tampered, secret)).rejects.toThrow(LatchError);
        }
      }
    });

    it('should prevent token substitution', async () => {
      const userAToken = { userId: 'userA', token: 'tokenA' };
      const userBToken = { userId: 'userB', token: 'tokenB' };

      const sealedA = await seal(userAToken, secret);
      const sealedB = await seal(userBToken, secret);

      // Unsealing sealedB should give userB data, not userA
      const unsealedB = await unseal<typeof userBToken>(sealedB, secret);

      expect(unsealedB.userId).toBe('userB');
      expect(unsealedB.userId).not.toBe('userA');

      // Cannot mix and match parts of sealed cookies
      const mixed = sealedA.slice(0, 30) + sealedB.slice(30);
      if (mixed !== sealedA && mixed !== sealedB) {
        await expect(unseal(mixed, secret)).rejects.toThrow(LatchError);
      }
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should allow legitimate cookie reuse within expiry', async () => {
      const data = {
        userId: '123',
        expiresAt: Date.now() + 3600000 // 1 hour from now
      };
      const sealed = await seal(data, secret);

      // Multiple unseals should work (cookie can be read multiple times)
      const unseal1 = await unseal<typeof data>(sealed, secret);
      const unseal2 = await unseal<typeof data>(sealed, secret);

      expect(unseal1).toEqual(data);
      expect(unseal2).toEqual(data);
    });

    it('should handle expired tokens via application logic', async () => {
      const data = {
        userId: '123',
        expiresAt: Date.now() - 3600000 // 1 hour ago
      };
      const sealed = await seal(data, secret);

      // Unsealing works (crypto-wise), but app should check expiresAt
      const unsealed = await unseal<typeof data>(sealed, secret);

      expect(unsealed.expiresAt).toBeLessThan(Date.now());
      // Application logic should reject this as expired
    });
  });

  describe('Length Extension Attacks', () => {
    it('should prevent length extension via authenticated encryption', async () => {
      const data = { userId: '123' };
      const sealed = await seal(data, secret);

      // Try to extend the sealed data
      const extended = sealed + 'additional-malicious-data';

      await expect(unseal(extended, secret)).rejects.toThrow(LatchError);
    });

    it('should prevent bit flipping attacks', async () => {
      const data = { userId: '123', role: 'user' };
      const sealed = await seal(data, secret);

      // Convert to buffer, flip some bits, convert back
      const bytes = Buffer.from(sealed, 'base64');
      bytes[20] ^= 0xFF; // Flip all bits in byte 20
      const bitFlipped = bytes.toString('base64');

      await expect(unseal(bitFlipped, secret)).rejects.toThrow(LatchError);
    });
  });
});
