import { getAzureEndpoints } from '../config';
import { LatchCloud, TokenResponse, LatchError } from '../types';

/**
 * Exchange authorization code for tokens
 * Supports both public client (PKCE) and confidential client (client_secret) flows
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
