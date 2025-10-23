/**
 * Latch - Modern OIDC for Next.js and Secure Clouds
 */

// Types
export type {
  LatchConfig,
  LatchCloud,
  LatchUser,
  LatchSession,
  LatchErrorCode,
  PKCEData,
  RefreshTokenData,
  ClientCertificate,
  TokenCacheOptions,
  OBOTokenRequest,
  OBOTokenResponse,
  ValidatedAccessToken,
} from './types';
export { LatchError } from './types';

// Config
export {
  getLatchConfig,
  getAzureEndpoints,
  validateScopes,
  buildLogoutUrl,
  COOKIE_NAMES,
  COOKIE_OPTIONS,
} from './config';

// Crypto
export { seal, unseal } from './crypto/seal';
export { generateCodeVerifier, generateCodeChallenge } from './crypto/pkce';
export { generateState, generateNonce } from './crypto/random';

// OIDC
export { exchangeCodeForTokens, refreshAccessToken } from './oidc/tokens';
export { validateState, validateReturnUrl, verifyIdToken } from './oidc/validation';

// OBO (On-Behalf-Of) Flow
export { exchangeTokenOnBehalfOf } from './oidc/obo';
export {
  oboTokenForGraph,
  oboTokenForApi,
  oboTokenForFunction,
} from './oidc/oboHelpers';
export {
  validateAccessToken,
  extractBearerToken,
  isTokenExpiringSoon,
} from './oidc/accessTokenValidation';
export {
  parseCAEChallenge,
  buildCAEChallengeHeader,
  isCAEError,
  extractClaimsFromError,
  withCAERetry,
  type CAEChallenge,
  type CAERetryConfig,
} from './oidc/caeHelper';

// Error Handling
export {
  createLatchError,
  formatErrorForLog,
  isLatchError,
  getUserSafeErrorMessage,
  validateLatchConfig,
} from './errors';
