/**
 * Cloud environment types for Azure AD
 */
export type LatchCloud = 'commercial' | 'gcc-high' | 'dod';

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
  | 'LATCH_DECRYPTION_FAILED';

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
  authorizeUrl: string;
  tokenUrl: string;
  logoutUrl: string;
  jwksUri: string;
}
