import { LatchError } from '../types';

/**
 * Seal (encrypt) data using AES-GCM with automatic cookie size validation
 * Returns base64url-encoded string: iv.authTag.ciphertext
 * 
 * ⚠️ **Browser Cookie Limit:** 4096 bytes per cookie
 * 
 * This function warns if encrypted data approaches browser cookie limits.
 * 
 * @param data - Data to encrypt (will be JSON.stringify'd)
 * @param secret - Encryption secret (32+ bytes recommended)
 * @returns Base64url-encoded encrypted string
 * 
 * @throws {LatchError} LATCH_ENCRYPTION_FAILED if encryption fails
 * @throws {LatchError} LATCH_INVALID_PARAMETER if data exceeds 4KB when encrypted
 * 
 * @example
 * ```typescript
 * // ✅ GOOD: Small user object (~300 bytes encrypted)
 * const sealed = await seal(user, config.cookieSecret);
 * 
 * // ⚠️ WARNING: Large refresh token (~2700 bytes encrypted)
 * const sealed = await seal({ refreshToken, expiresAt }, config.cookieSecret);
 * 
 * // ❌ BAD: Everything in one cookie (exceeds 4KB!)
 * const sealed = await seal(
 *   { user, accessToken, refreshToken, expiresAt },
 *   secret
 * ); // Throws: Cookie too large (6000 bytes)
 * ```
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

    const sealed = base64UrlEncode(combined);
    
    // Cookie size validation
    const sizeBytes = sealed.length;
    const COOKIE_SIZE_LIMIT = 4096;
    const COOKIE_SIZE_WARNING = 3500;
    
    if (sizeBytes > COOKIE_SIZE_LIMIT) {
      throw new LatchError(
        'LATCH_INVALID_PARAMETER',
        `[Latch] Cookie too large: ${sizeBytes} bytes (browser limit: ${COOKIE_SIZE_LIMIT} bytes).\n\n` +
        `Common causes:\n` +
        `  • Storing access tokens in cookies (don't do this!)\n` +
        `  • Storing multiple tokens in one cookie\n` +
        `  • Storing large user objects\n\n` +
        `Solution: Split data across multiple cookies:\n` +
        `  • COOKIE_NAMES.ID_TOKEN - User object only\n` +
        `  • COOKIE_NAMES.REFRESH_TOKEN - Refresh token only\n` +
        `  • Don't store access tokens in cookies\n\n` +
        `See: https://github.com/lance0/latch#cookie-storage-pattern`
      );
    }
    
    if (sizeBytes > COOKIE_SIZE_WARNING) {
      console.warn(
        `[Latch] Warning: Encrypted data is ${sizeBytes} bytes (cookie limit: ${COOKIE_SIZE_LIMIT} bytes).\n` +
        `This is close to the browser cookie size limit. Consider splitting into separate cookies.`
      );
    }

    return sealed;
  } catch (error) {
    if (error instanceof LatchError) {
      throw error;
    }
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
 * Uses Buffer for Node.js compatibility (Next.js server runtime)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = Buffer.from(buffer).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode (RFC 4648)
 * Uses Buffer for Node.js compatibility (Next.js server runtime)
 */
function base64UrlDecode(str: string): Uint8Array {
  // Restore padding
  const pad = str.length % 4;
  const padded = str + (pad ? '='.repeat(4 - pad) : '');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}
