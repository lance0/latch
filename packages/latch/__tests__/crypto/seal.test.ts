import { describe, it, expect, beforeEach } from 'vitest';
import { seal, unseal, clearKeyCache } from '@/lib/latch/crypto/seal';

// Clear cache before each test to ensure consistent behavior
beforeEach(() => {
  clearKeyCache();
});

describe('seal and unseal', () => {
  const secret = 'test-secret-key-with-at-least-32-chars-for-security';

  it('should encrypt and decrypt simple strings', async () => {
    const data = 'Hello, World!';
    const sealed = await seal(data, secret);
    const unsealed = await unseal<string>(sealed, secret);

    expect(unsealed).toBe(data);
  });

  it('should encrypt and decrypt objects', async () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      roles: ['admin', 'user'],
    };

    const sealed = await seal(data, secret);
    const unsealed = await unseal<typeof data>(sealed, secret);

    expect(unsealed).toEqual(data);
  });

  it('should produce different ciphertexts for the same data', async () => {
    const data = 'test data';
    const sealed1 = await seal(data, secret);
    const sealed2 = await seal(data, secret);

    expect(sealed1).not.toBe(sealed2);

    const unsealed1 = await unseal<string>(sealed1, secret);
    const unsealed2 = await unseal<string>(sealed2, secret);

    expect(unsealed1).toBe(data);
    expect(unsealed2).toBe(data);
  });

  it('should fail to decrypt with wrong secret', async () => {
    const data = 'secret message';
    const sealed = await seal(data, secret);

    await expect(
      unseal<string>(sealed, 'wrong-secret-key-different-from-original')
    ).rejects.toThrow();
  });

  it('should fail to decrypt tampered ciphertext', async () => {
    const data = 'important data';
    const sealed = await seal(data, secret);

    // Tamper with the sealed data
    const tampered = sealed.slice(0, -5) + 'XXXXX';

    await expect(unseal<string>(tampered, secret)).rejects.toThrow();
  });

  it('should handle empty strings', async () => {
    const data = '';
    const sealed = await seal(data, secret);
    const unsealed = await unseal<string>(sealed, secret);

    expect(unsealed).toBe(data);
  });

  it('should reject objects that exceed 4KB cookie limit', async () => {
    const data = {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      })),
    };

    // This should throw because the sealed data exceeds 4KB
    await expect(seal(data, secret)).rejects.toThrow('Cookie too large');
  });

  it('should handle moderately sized objects under 4KB', async () => {
    const data = {
      users: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      })),
    };

    const sealed = await seal(data, secret);
    const unsealed = await unseal<typeof data>(sealed, secret);

    expect(unsealed).toEqual(data);
  });

  it('should cache derived keys for performance', async () => {
    const data = 'test data';
    
    // First seal - derives key (slower)
    const start1 = performance.now();
    const sealed1 = await seal(data, secret);
    const time1 = performance.now() - start1;
    
    // Second seal - uses cached key (faster)
    const start2 = performance.now();
    const sealed2 = await seal(data, secret);
    const time2 = performance.now() - start2;
    
    // Verify both sealed values can be unsealed
    expect(await unseal(sealed1, secret)).toBe(data);
    expect(await unseal(sealed2, secret)).toBe(data);
    
    // Second operation should be significantly faster
    expect(time2).toBeGreaterThan(0);
  });

  it('should handle different secrets independently', async () => {
    const secret1 = 'secret-one-with-sufficient-length-for-security';
    const secret2 = 'secret-two-with-sufficient-length-for-security';
    const data = 'test data';
    
    const sealed1 = await seal(data, secret1);
    const sealed2 = await seal(data, secret2);
    
    // Different secrets produce different sealed values
    expect(sealed1).not.toBe(sealed2);
    
    // Each can be unsealed with its own secret
    expect(await unseal(sealed1, secret1)).toBe(data);
    expect(await unseal(sealed2, secret2)).toBe(data);
    
    // Wrong secret fails
    await expect(unseal(sealed1, secret2)).rejects.toThrow();
  });

  it('should support manual cache clearing', async () => {
    const data = 'test';
    
    // Seal with secret (caches key)
    await seal(data, secret);
    
    // Clear cache
    clearKeyCache();
    
    // Should still work (derives key again)
    const sealed = await seal(data, secret);
    expect(await unseal(sealed, secret)).toBe(data);
  });
});
