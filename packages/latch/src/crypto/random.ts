/**
 * Generate cryptographically secure random strings
 */

/**
 * Generate a random state parameter
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
  return generateRandomString(32);
}

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Base64url encode (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
