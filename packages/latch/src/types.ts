/**
 * Cloud environment types for Azure AD
 */
export type LatchCloud = 'commercial' | 'gcc-high' | 'dod';

/**
 * Client certificate configuration for confidential clients
 * Alternative to client_secret, preferred for IL4/IL5 environments
 */
export interface ClientCertificate {
  /** PEM-encoded private key */
  privateKey: string;

  /** SHA-1 thumbprint of the certificate (for x5t header) */
  thumbprint: string;

  /** Optional certificate chain in base64 format */
  x5c?: string[];

  /** Optional key ID (kid) for multi-certificate scenarios */
  kid?: string;
}

/**
 * Token cache configuration for OBO flows
 */
export interface TokenCacheOptions {
  /** Enable token caching (default: true) */
  enabled?: boolean;

  /** Expire cached tokens N seconds early to avoid expiration race conditions (default: 300 = 5 minutes) */
  ttlBufferSeconds?: number;

  /** Maximum number of cached tokens before LRU eviction (default: 1000) */
  maxCacheSize?: number;
}

/**
 * Latch configuration
 */
export interface LatchConfig {
  /** Azure AD Client ID from app registration */
  clientId: string;

  /** Azure AD Tenant ID */
  tenantId: string;

  /**
   * Azure AD Client Secret (optional)
   * If provided, uses confidential client flow with client_secret.
   * If omitted, uses public client flow with PKCE.
   */
  clientSecret?: string;

  /**
   * Client certificate for confidential client (alternative to clientSecret)
   * Preferred for IL4/IL5 environments
   */
  clientCertificate?: ClientCertificate;

  /** Cloud environment */
  cloud: LatchCloud;

  /** OAuth scopes (e.g., 'openid profile User.Read') */
  scopes?: string[];

  /** Redirect URI (must match app registration) */
  redirectUri?: string;

  /** Cookie encryption secret (32+ bytes recommended) */
  cookieSecret?: string;

  /** Enable debug logging (never logs tokens) */
  debug?: boolean;

  /** Token cache configuration for OBO flows */
  oboCache?: TokenCacheOptions;

  /** Allowed audiences for incoming bearer tokens (your API's identifiers) */
  allowedAudiences?: string[];
}

/**
 * User information from ID token
 */
export interface LatchUser {
  /** User's object ID */
  sub: string;

  /** User's email */
  email?: string;

  /** User's display name */
  name?: string;

  /** User's preferred username */
  preferred_username?: string;

  /** Token issuance time */
  iat: number;

  /** Token expiration time */
  exp: number;
}

/**
 * OAuth token response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

/**
 * On-Behalf-Of token request
 */
export interface OBOTokenRequest {
  /** Incoming user bearer token (from Authorization header) */
  userAssertion: string;

  /** Your API's Azure AD client ID */
  clientId: string;

  /** Azure AD tenant ID */
  tenantId: string;

  /** Cloud environment */
  cloud: LatchCloud;

  /** Client authentication credentials */
  clientAuth: {
    /** Client secret (confidential client) */
    clientSecret?: string;

    /** Client certificate (alternative to secret, preferred for IL4/IL5) */
    certificate?: ClientCertificate;
  };

  /** Requested scopes for downstream API (e.g., ["api://downstream/.default"]) */
  scopes?: string[];

  /** Resource identifier (v1 endpoint compatibility, prefer scopes) */
  resource?: string;

  /** Claims for CAE (Continuous Access Evaluation) challenge round-trip */
  claims?: string;

  /** Additional allowed audiences for incoming token validation (e.g., ["api://your-api"]) */
  allowedAudiences?: string[];

  /** Required authorized party (azp claim) to prevent token forwarding from unexpected clients */
  requiredAzp?: string;

  /** Token cache options (overrides config default) */
  cacheOptions?: TokenCacheOptions;
}

/**
 * On-Behalf-Of token response
 */
export interface OBOTokenResponse {
  /** Access token for downstream API */
  access_token: string;

  /** Token type (usually "Bearer") */
  token_type: string;

  /** Token lifetime in seconds */
  expires_in: number;

  /** Computed expiration timestamp (Date.now() + expires_in * 1000) */
  expires_at: number;

  /** Granted scopes */
  scope: string;
}

/**
 * Validated access token claims
 */
export interface ValidatedAccessToken {
  /** Subject (user ID) */
  sub: string;

  /** Tenant ID */
  tid: string;

  /** Audience (should match your API's client ID or audience URI) */
  aud: string;

  /** Issuer (Azure AD endpoint) */
  iss: string;

  /** Issued at time */
  iat: number;

  /** Expiration time */
  exp: number;

  /** Not before time */
  nbf?: number;

  /** Scopes granted */
  scp?: string;

  /** Application ID (for app-only tokens) */
  appid?: string;

  /** Authorized party (who requested the token) */
  azp?: string;

  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Latch error codes
 */
export type LatchErrorCode =
  | 'LATCH_CONFIG_MISSING'
  | 'LATCH_CLIENT_ID_MISSING'
  | 'LATCH_TENANT_ID_MISSING'
  | 'LATCH_CLOUD_INVALID'
  | 'LATCH_CLOUD_MISMATCH'
  | 'LATCH_COOKIE_SECRET_MISSING'
  | 'LATCH_PKCE_MISSING'
  | 'LATCH_STATE_MISSING'
  | 'LATCH_STATE_MISMATCH'
  | 'LATCH_NONCE_MISSING'
  | 'LATCH_NONCE_MISMATCH'
  | 'LATCH_CODE_MISSING'
  | 'LATCH_TOKEN_EXCHANGE_FAILED'
  | 'LATCH_TOKEN_REFRESH_FAILED'
  | 'LATCH_INVALID_RETURN_URL'
  | 'LATCH_ID_TOKEN_INVALID'
  | 'LATCH_REFRESH_TOKEN_MISSING'
  | 'LATCH_ENCRYPTION_FAILED'
  | 'LATCH_DECRYPTION_FAILED'
  | 'LATCH_OBO_INVALID_ASSERTION'
  | 'LATCH_INVALID_PARAMETER'
  | 'LATCH_OBO_AUDIENCE_MISMATCH'
  | 'LATCH_OBO_TENANT_MISMATCH'
  | 'LATCH_OBO_ISSUER_MISMATCH'
  | 'LATCH_OBO_EXCHANGE_FAILED'
  | 'LATCH_OBO_CAE_REQUIRED'
  | 'LATCH_OBO_TOKEN_EXPIRED'
  | 'LATCH_OBO_INVALID_CONFIG';

/**
 * Latch error
 */
export class LatchError extends Error {
  constructor(
    public code: LatchErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LatchError';
  }
}

/**
 * Internal cookie data structures
 */
export interface PKCEData {
  codeVerifier: string;
  state: string;
  nonce: string;
  returnTo?: string;
}

export interface RefreshTokenData {
  refreshToken: string;
  expiresAt: number;
}

/**
 * Session data returned from /api/latch/session
 */
export interface LatchSession {
  user: LatchUser | null;
  isAuthenticated: boolean;
}

/**
 * Azure AD endpoints configuration
 */
export interface AzureEndpoints {
  loginBaseUrl: string;
  graphBaseUrl: string;
  /** OAuth 2.0 authorization endpoint - use this to start the OAuth flow */
  authorizeUrl: string;
  tokenUrl: string;
  logoutUrl: string;
  jwksUri: string;
}

/**
 * @deprecated Use `authorizeUrl` instead
 * Common mistake: accessing .authorization instead of .authorizeUrl
 */
export type AzureEndpointsWithDeprecated = AzureEndpoints & {
  /** @deprecated Use authorizeUrl instead */
  authorization?: never;
};
