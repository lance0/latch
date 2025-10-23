/**
 * On-Behalf-Of (OBO) Flow - Opt-in subpath export
 *
 * Import from '@lance0/latch/obo' for a lean, tree-shakeable OBO bundle.
 *
 * **Status:** Beta (as of v0.3.0)
 *
 * @module @lance0/latch/obo
 *
 * @example
 * ```typescript
 * import { oboTokenForGraph, parseCAEChallenge } from '@lance0/latch/obo';
 *
 * export async function GET(request: NextRequest) {
 *   const graphToken = await oboTokenForGraph(request);
 *   // ...
 * }
 * ```
 */

// Core OBO function
export { exchangeTokenOnBehalfOf } from '../oidc/obo';

// Convenience helpers
export {
  oboTokenForGraph,
  oboTokenForApi,
  oboTokenForFunction,
} from '../oidc/oboHelpers';

// Token validation
export {
  validateAccessToken,
  extractBearerToken,
  isTokenExpiringSoon,
} from '../oidc/accessTokenValidation';

// CAE (Continuous Access Evaluation) helpers
export {
  parseCAEChallenge,
  buildCAEChallengeHeader,
  isCAEError,
  extractClaimsFromError,
  withCAERetry,
  type CAEChallenge,
  type CAERetryConfig,
} from '../oidc/caeHelper';

// Token cache utilities
export { getTokenCache, resetTokenCache } from '../cache/tokenCache';

// Types
export type {
  OBOTokenRequest,
  OBOTokenResponse,
  ValidatedAccessToken,
  TokenCacheOptions,
} from '../types';
