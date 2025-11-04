import { getAzureEndpoints } from '../config';
import { LatchCloud, TokenResponse, LatchError } from '../types';

/**
 * Exchange authorization code for tokens
 * Supports both public client (PKCE) and confidential client (client_secret) flows
 * 
 * @param code - Authorization code from OAuth callback
 * @param codeVerifier - PKCE code verifier from stored PKCE data
 * @param redirectUri - Must match the redirect_uri used in authorization request
 * @param clientId - Azure AD Application (client) ID
 * @param tenantId - Azure AD Tenant ID
 * @param cloud - Azure cloud environment ('commercial', 'gcc-high', or 'dod')
 * @param clientSecret - Optional client secret for confidential client flow
 * @returns Token response with access_token, refresh_token, and id_token
 * 
 * @example
 * ```typescript
 * // In your callback route:
 * const tokens = await exchangeCodeForTokens(
 *   code,                      // from searchParams.get('code')
 *   pkceData.codeVerifier,     // from unsealed PKCE cookie
 *   config.redirectUri,        // from getLatchConfig()
 *   config.clientId,
 *   config.tenantId,
 *   config.cloud,
 *   config.clientSecret        // optional - for confidential clients
 * );
 * ```
 * 
 * @throws {LatchError} LATCH_TOKEN_EXCHANGE_FAILED if token exchange fails
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  tenantId: string,
  cloud: LatchCloud,
  clientSecret?: string
): Promise<TokenResponse> {
  // Runtime validation
  if (!code || typeof code !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'code' must be a non-empty string, got ${typeof code}`
    );
  }
  if (!codeVerifier || typeof codeVerifier !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'codeVerifier' must be a non-empty string, got ${typeof codeVerifier}`
    );
  }
  if (!redirectUri || typeof redirectUri !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'redirectUri' must be a non-empty string, got ${typeof redirectUri}`
    );
  }
  if (!clientId || typeof clientId !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'clientId' must be a non-empty string, got ${typeof clientId}`
    );
  }
  if (!tenantId || typeof tenantId !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'tenantId' must be a non-empty string, got ${typeof tenantId}`
    );
  }
  if (!cloud || typeof cloud !== 'string') {
    throw new LatchError(
      'LATCH_INVALID_PARAMETER',
      `[Latch] exchangeCodeForTokens: 'cloud' must be a non-empty string, got ${typeof cloud}`
    );
  }

  const endpoints = getAzureEndpoints(cloud, tenantId);

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'openid profile offline_access User.Read',
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  // Add authentication based on client type
  if (clientSecret) {
    // Confidential client: authenticate with client_secret
    params.append('client_secret', clientSecret);
  }

  if (codeVerifier) {
    // Public client or additional PKCE security: include code_verifier
    params.append('code_verifier', codeVerifier);
  }

  try {
    const response = await fetch(endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens: TokenResponse = await response.json();
    return tokens;
  } catch (error) {
    throw new LatchError('LATCH_TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for tokens', error);
  }
}

/**
 * Refresh access token using refresh token
 * Supports both public client and confidential client (client_secret) flows
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  tenantId: string,
  cloud: LatchCloud,
  scopes?: string[],
  clientSecret?: string
): Promise<TokenResponse> {
  const endpoints = getAzureEndpoints(cloud, tenantId);

  const scopeString = scopes?.join(' ') || 'openid profile offline_access User.Read';

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopeString,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  // Add client_secret for confidential clients
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

  try {
    const response = await fetch(endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokens: TokenResponse = await response.json();
    return tokens;
  } catch (error) {
    throw new LatchError('LATCH_TOKEN_REFRESH_FAILED', 'Failed to refresh access token', error);
  }
}
