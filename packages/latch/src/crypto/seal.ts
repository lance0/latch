import { LatchError } from '../types';

/**
 * Seal (encrypt) data using AES-GCM
 * Returns base64url-encoded string: iv.authTag.ciphertext
 */
export async function seal<T>(data: T, secret: string): Promise<string> {
  try {
    const payload = JSON.stringify(data);
    const key = await deriveKey(secret);

    // Generate random IV (96 bits / 12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoded = new TextEncoder().encode(payload);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      encoded
    );

    // Extract auth tag (last 16 bytes of ciphertext in GCM)
    const ciphertextBytes = new Uint8Array(ciphertext);
    const actualCiphertext = ciphertextBytes.slice(0, -16);
    const authTag = ciphertextBytes.slice(-16);

    // Combine: iv.authTag.ciphertext
    const combined = new Uint8Array(iv.length + authTag.length + actualCiphertext.length);
    combined.set(iv, 0);
    combined.set(authTag, iv.length);
    combined.set(actualCiphertext, iv.length + authTag.length);

    return base64UrlEncode(combined);
  } catch (error) {
    throw new LatchError('LATCH_ENCRYPTION_FAILED', 'Failed to encrypt data', error);
  }
}

/**
 * Unseal (decrypt) data using AES-GCM
 */
export async function unseal<T>(sealed: string, secret: string): Promise<T> {
  try {
    const combined = base64UrlDecode(sealed);
    const key = await deriveKey(secret);

    // Extract components
    const iv = combined.slice(0, 12);
    const authTag = combined.slice(12, 28);
    const ciphertext = combined.slice(28);

    // Reconstruct ciphertext with auth tag for Web Crypto API
    const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
    ciphertextWithTag.set(ciphertext, 0);
    ciphertextWithTag.set(authTag, ciphertext.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      ciphertextWithTag
    );

    const payload = new TextDecoder().decode(decrypted);
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new LatchError('LATCH_DECRYPTION_FAILED', 'Failed to decrypt data', error);
  }
}

/**
 * Derive AES-256 key from secret using PBKDF2
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('latch-salt'), // Static salt for deterministic key derivation
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Base64url encode (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode (RFC 4648)
 */
function base64UrlDecode(str: string): Uint8Array {
  // Restore padding
  const pad = str.length % 4;
  const padded = str + (pad ? '='.repeat(4 - pad) : '');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}
