import { getAzureEndpoints } from '../config';
import { validateAccessToken } from './accessTokenValidation';
import { buildClientAuthParams } from '../crypto/clientAssertion';
import { getTokenCache, buildCacheKey } from '../cache/tokenCache';
import {
  LatchError,
  OBOTokenRequest,
  OBOTokenResponse,
  ValidatedAccessToken,
} from '../types';

/**
 * Exchange incoming bearer token for downstream API token using On-Behalf-Of (OBO) flow
 *
 * This implements the OAuth 2.0 On-Behalf-Of flow (RFC 8693) for middle-tier scenarios
 * where your API receives a user bearer token and needs to call downstream APIs on behalf of that user.
 *
 * **Flow:**
 * 1. Validate incoming user assertion (bearer token)
 * 2. Check token cache for existing downstream token
 * 3. If cache miss/expired, call Azure AD token endpoint with OBO grant
 * 4. Cache and return downstream token
 *
 * **Security:**
 * - Validates audience (token must be for your API)
 * - Validates issuer and tenant (prevents token substitution)
 * - Prevents token chaining (assertion must be original user token)
 * - Supports both client_secret and certificate authentication
 *
 * @param request - OBO token request
 * @returns OBO token response with access token for downstream API
 *
 * @throws {LatchError} LATCH_OBO_INVALID_CONFIG - Missing required configuration
 * @throws {LatchError} LATCH_OBO_INVALID_ASSERTION - Invalid incoming token
 * @throws {LatchError} LATCH_OBO_EXCHANGE_FAILED - Token exchange failed
 * @throws {LatchError} LATCH_OBO_CAE_REQUIRED - Claims challenge required
 *
 * @example
 * const oboToken = await exchangeTokenOnBehalfOf({
 *   userAssertion: bearerToken,
 *   clientId: config.clientId,
 *   tenantId: config.tenantId,
 *   cloud: config.cloud,
 *   clientAuth: { clientSecret: config.clientSecret },
 *   scopes: ['api://downstream/.default'],
 * });
 */
export async function exchangeTokenOnBehalfOf(
  request: OBOTokenRequest
): Promise<OBOTokenResponse> {
  const {
    userAssertion,
    clientId,
    tenantId,
    cloud,
    clientAuth,
    scopes,
    resource,
    claims,
  } = request;

  // Validate configuration
  if (!clientAuth.clientSecret && !clientAuth.certificate) {
    throw new LatchError(
      'LATCH_OBO_INVALID_CONFIG',
      'OBO flow requires either clientSecret or certificate for confidential client authentication'
    );
  }

  if (scopes && resource) {
    throw new LatchError(
      'LATCH_OBO_INVALID_CONFIG',
      'Cannot specify both scopes and resource. Prefer scopes for v2.0 endpoint.'
    );
  }

  if (!scopes && !resource) {
    throw new LatchError(
      'LATCH_OBO_INVALID_CONFIG',
      'Must specify either scopes or resource for downstream API'
    );
  }

  const endpoints = getAzureEndpoints(cloud, tenantId);

  // Step 1: Validate incoming user assertion
  let validatedClaims: ValidatedAccessToken;
  try {
    validatedClaims = await validateAccessToken(
      userAssertion,
      clientId,
      tenantId,
      cloud,
      {
        allowedAudiences: request.allowedAudiences,
        requiredAzp: request.requiredAzp,
      }
    );
  } catch (error) {
    if (error instanceof LatchError) {
      throw error;
    }
    throw new LatchError(
      'LATCH_OBO_INVALID_ASSERTION',
      'Failed to validate incoming bearer token',
      error
    );
  }

  // Step 2: Build cache key and check cache
  const cacheResource = resource || scopes?.join(' ') || '';
  const cacheKey = buildCacheKey(
    clientId,
    tenantId,
    validatedClaims.sub,
    cacheResource,
    scopes || [],
    claims
  );

  const cache = getTokenCache(request.cacheOptions);
  const cachedEntry = cache.get(cacheKey);

  if (cachedEntry) {
    // Cache hit - compute accurate TTL
    const now = Date.now();
    const expiresIn = Math.floor((cachedEntry.expiresAt - now) / 1000);

    return {
      access_token: cachedEntry.accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      expires_at: cachedEntry.expiresAt,
      scope: cachedEntry.scopes.join(' '),
    };
  }

  // Step 3: Cache miss - exchange token with Azure AD
  try {
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: clientId,
      assertion: userAssertion,
      requested_token_use: 'on_behalf_of',
    });

    // Add scopes or resource
    if (scopes) {
      params.append('scope', scopes.join(' '));
    } else if (resource) {
      params.append('resource', resource);
    }

    // Add CAE claims if provided
    if (claims) {
      params.append('claims', claims);
    }

    // Add client authentication (secret or certificate)
    const authParams = await buildClientAuthParams(
      clientAuth.clientSecret,
      clientAuth.certificate,
      clientId,
      endpoints.tokenUrl
    );

    // Merge auth params
    authParams.forEach((value, key) => {
      params.append(key, value);
    });

    // Call token endpoint
    const response = await fetch(endpoints.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any;

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      // Check for CAE claims challenge
      if (
        errorData.error === 'interaction_required' ||
        errorData.error === 'insufficient_claims' ||
        (errorData.claims && !claims)
      ) {
        throw new LatchError(
          'LATCH_OBO_CAE_REQUIRED',
          `Claims challenge required: ${errorData.error_description || errorData.error}. ` +
            `Retry with claims parameter: ${errorData.claims}`,
          {
            claims: errorData.claims,
            error: errorData.error,
            error_description: errorData.error_description,
          }
        );
      }

      throw new LatchError(
        'LATCH_OBO_EXCHANGE_FAILED',
        `OBO token exchange failed: ${errorData.error_description || errorData.error}`,
        errorData
      );
    }

    const tokenResponse = await response.json();

    // Step 4: Cache the token
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
    cache.set(
      cacheKey,
      tokenResponse.access_token,
      tokenResponse.expires_in,
      scopes || [],
      claims
    );

    // Step 5: Return OBO token
    return {
      access_token: tokenResponse.access_token,
      token_type: tokenResponse.token_type || 'Bearer',
      expires_in: tokenResponse.expires_in,
      expires_at: expiresAt,
      scope: tokenResponse.scope || scopes?.join(' ') || '',
    };
  } catch (error) {
    if (error instanceof LatchError) {
      throw error;
    }

    throw new LatchError(
      'LATCH_OBO_EXCHANGE_FAILED',
      'OBO token exchange failed',
      error
    );
  }
}
