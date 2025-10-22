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
} from './types';
export { LatchError } from './types';

// Config
export {
  getLatchConfig,
  getAzureEndpoints,
  validateScopes,
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

// Error Handling
export {
  createLatchError,
  formatErrorForLog,
  isLatchError,
  getUserSafeErrorMessage,
  validateLatchConfig,
} from './errors';

// React
export { LatchProvider, useLatch, LatchGuard, useAccessToken } from './react';
