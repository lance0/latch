/**
 * Generate PKCE code verifier and challenge (S256 method)
 * RFC 7636: https://tools.ietf.org/html/rfc7636
 */

/**
 * Generate a random code verifier
 * Length: 43-128 characters
 * Characters: A-Z, a-z, 0-9, -, ., _, ~
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32); // 32 bytes = 43 base64url chars
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate S256 code challenge from verifier
 * challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64url encode (RFC 4648)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
