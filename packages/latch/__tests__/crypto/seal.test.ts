import { describe, it, expect } from 'vitest';
import { seal, unseal } from '@/lib/latch/crypto/seal';

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
});
