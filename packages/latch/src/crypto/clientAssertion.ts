import { SignJWT, importPKCS8 } from 'jose';
import { ClientCertificate } from '../types';

/**
 * Generate a client assertion JWT for certificate-based authentication
 *
 * This implements the `private_key_jwt` client authentication method
 * per RFC 7523 (JWT Profile for OAuth 2.0 Client Authentication)
 *
 * @param clientId - Azure AD client ID
 * @param tokenEndpoint - Token endpoint URL
 * @param certificate - Client certificate configuration
 * @returns Signed JWT assertion
 *
 * @example
 * const assertion = await generateClientAssertion(
 *   'your-client-id',
 *   'https://login.microsoftonline.us/tenant-id/oauth2/v2.0/token',
 *   {
 *     privateKey: process.env.CERT_PRIVATE_KEY!,
 *     thumbprint: process.env.CERT_THUMBPRINT!,
 *     x5c: [process.env.CERT_X5C!]
 *   }
 * );
 */
export async function generateClientAssertion(
  clientId: string,
  tokenEndpoint: string,
  certificate: ClientCertificate
): Promise<string> {
  // Parse private key (expects PEM format)
  const privateKey = await importPKCS8(certificate.privateKey, 'RS256');

  // Build JWT header with x5t (certificate thumbprint)
  const header: {
    alg: 'RS256';
    typ: 'JWT';
    x5t: string;
    kid?: string;
    x5c?: string[];
  } = {
    alg: 'RS256',
    typ: 'JWT',
    x5t: certificate.thumbprint, // SHA-1 thumbprint (base64url)
  };

  // Include key ID if provided (useful when multiple certs registered)
  if (certificate.kid) {
    header.kid = certificate.kid;
  }

  // Include certificate chain if provided
  if (certificate.x5c && certificate.x5c.length > 0) {
    header.x5c = certificate.x5c;
  }

  // Build JWT payload
  const now = Math.floor(Date.now() / 1000);
  const jti = generateJti(); // Unique JWT ID

  const jwt = new SignJWT({
    sub: clientId, // Subject: client ID
    aud: tokenEndpoint, // Audience: token endpoint
    jti, // JWT ID (unique identifier)
  })
    .setProtectedHeader(header)
    .setIssuer(clientId) // Issuer: client ID
    .setIssuedAt(now)
    .setExpirationTime(now + 600); // Valid for 10 minutes

  // Sign and return
  return await jwt.sign(privateKey);
}

/**
 * Generate a unique JWT ID (jti)
 *
 * Uses crypto.randomUUID() for better Node.js compatibility
 *
 * @returns Random UUID string
 */
function generateJti(): string {
  return crypto.randomUUID();
}

/**
 * Build client authentication parameters for token endpoint
 *
 * Returns either client_secret OR client_assertion based on what's provided
 *
 * @param clientSecret - Client secret (if using secret auth)
 * @param certificate - Client certificate (if using cert auth)
 * @param clientId - Azure AD client ID
 * @param tokenEndpoint - Token endpoint URL
 * @returns URL search params with auth credentials
 */
export async function buildClientAuthParams(
  clientSecret: string | undefined,
  certificate: ClientCertificate | undefined,
  clientId: string,
  tokenEndpoint: string
): Promise<URLSearchParams> {
  const params = new URLSearchParams();

  if (certificate) {
    // Certificate-based authentication (private_key_jwt)
    const assertion = await generateClientAssertion(
      clientId,
      tokenEndpoint,
      certificate
    );
    params.append('client_assertion', assertion);
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  } else if (clientSecret) {
    // Secret-based authentication
    params.append('client_secret', clientSecret);
  }
  // else: public client (no authentication)

  return params;
}
