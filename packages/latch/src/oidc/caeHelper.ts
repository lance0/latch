/**
 * CAE (Continuous Access Evaluation) Helper Utilities
 *
 * Azure AD may require claims challenges for sensitive operations.
 * These utilities help handle CAE-related errors and retry logic.
 */

/**
 * Parsed CAE claims challenge
 */
export interface CAEChallenge {
  /** The raw claims string from Azure AD */
  claims: string;

  /** Error type (usually "insufficient_claims") */
  error?: string;

  /** Realm (usually empty string) */
  realm?: string;
}

/**
 * Parse WWW-Authenticate header for CAE claims challenge
 *
 * Azure AD returns CAE challenges in the WWW-Authenticate header:
 * ```
 * WWW-Authenticate: Bearer realm="", error="insufficient_claims", claims="eyJ..."
 * ```
 *
 * @param wwwAuthenticate - Value of WWW-Authenticate header
 * @returns Parsed CAE challenge or null if not a CAE challenge
 *
 * @example
 * const challenge = parseCAEChallenge(response.headers.get('www-authenticate'));
 * if (challenge) {
 *   // Retry with claims
 *   const token = await oboTokenForGraph(request, { claims: challenge.claims });
 * }
 */
export function parseCAEChallenge(wwwAuthenticate: string | null): CAEChallenge | null {
  if (!wwwAuthenticate) {
    return null;
  }

  // Check if it's a Bearer challenge
  if (!wwwAuthenticate.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  // Parse challenge parameters
  const challenge: Partial<CAEChallenge> = {};

  // Extract realm
  const realmMatch = wwwAuthenticate.match(/realm="([^"]*)"/);
  if (realmMatch) {
    challenge.realm = realmMatch[1];
  }

  // Extract error
  const errorMatch = wwwAuthenticate.match(/error="([^"]*)"/);
  if (errorMatch) {
    challenge.error = errorMatch[1];
  }

  // Extract claims (required for CAE)
  const claimsMatch = wwwAuthenticate.match(/claims="([^"]*)"/);
  if (!claimsMatch) {
    return null; // Not a CAE challenge if no claims
  }

  challenge.claims = claimsMatch[1];

  return challenge as CAEChallenge;
}

/**
 * Build WWW-Authenticate header for CAE challenge
 *
 * Use this to return a properly formatted CAE challenge to the client
 *
 * @param claims - Claims string from Azure AD
 * @param error - Error type (default: "insufficient_claims")
 * @param realm - Realm (default: "")
 * @returns Formatted WWW-Authenticate header value
 *
 * @example
 * return NextResponse.json(
 *   { error: 'claims_required' },
 *   {
 *     status: 401,
 *     headers: {
 *       'WWW-Authenticate': buildCAEChallengeHeader(claims)
 *     }
 *   }
 * );
 */
export function buildCAEChallengeHeader(
  claims: string,
  error: string = 'insufficient_claims',
  realm: string = ''
): string {
  return `Bearer realm="${realm}", error="${error}", claims="${claims}"`;
}

/**
 * Check if error is a CAE-related error
 *
 * @param error - Error to check
 * @returns True if error is CAE-related
 */
export function isCAEError(error: any): boolean {
  if (!error) return false;

  // Check Latch error code
  if (error.code === 'LATCH_OBO_CAE_REQUIRED') {
    return true;
  }

  // Check error message
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('insufficient_claims') ||
    message.includes('claims challenge') ||
    message.includes('interaction_required')
  );
}

/**
 * Extract claims from Latch OBO error
 *
 * @param error - Latch error from OBO call
 * @returns Claims string or null
 *
 * @example
 * try {
 *   const token = await oboTokenForGraph(request);
 * } catch (error) {
 *   const claims = extractClaimsFromError(error);
 *   if (claims) {
 *     // Return to client for retry
 *     return NextResponse.json(
 *       { error: 'claims_required', claims },
 *       { status: 401 }
 *     );
 *   }
 * }
 */
export function extractClaimsFromError(error: any): string | null {
  if (!error) return null;

  // Check error details
  if (error.details?.claims) {
    return error.details.claims;
  }

  // Check error message for embedded claims
  const message = error.message || '';
  const claimsMatch = message.match(/claims[=:]?\s*['"](.*?)['"]/i);
  if (claimsMatch) {
    return claimsMatch[1];
  }

  return null;
}

/**
 * Retry configuration for CAE operations
 */
export interface CAERetryConfig {
  /** Maximum number of retry attempts (default: 1) */
  maxRetries?: number;

  /** Whether to throw on final failure (default: true) */
  throwOnFailure?: boolean;
}

/**
 * Execute operation with automatic CAE retry
 *
 * This helper automatically retries operations when CAE challenges occur.
 * Useful for wrapping OBO calls that may require claims.
 *
 * **Important:** The client must handle the claims challenge and provide
 * a new token when claims are required. This helper only detects and
 * propagates the challenge.
 *
 * @param operation - Async operation to execute
 * @param config - Retry configuration
 * @returns Operation result or throws with CAE details
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   try {
 *     const result = await withCAERetry(async () => {
 *       const token = await oboTokenForGraph(request);
 *       const response = await fetch('https://graph.microsoft.us/v1.0/me', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       });
 *
 *       if (!response.ok) {
 *         const challenge = parseCAEChallenge(response.headers.get('www-authenticate'));
 *         if (challenge) {
 *           throw new Error('CAE_CHALLENGE:' + challenge.claims);
 *         }
 *         throw new Error('API error');
 *       }
 *
 *       return response.json();
 *     });
 *
 *     return NextResponse.json(result);
 *   } catch (error: any) {
 *     if (isCAEError(error)) {
 *       const claims = extractClaimsFromError(error);
 *       return NextResponse.json(
 *         { error: 'claims_required', claims },
 *         {
 *           status: 401,
 *           headers: { 'WWW-Authenticate': buildCAEChallengeHeader(claims!) }
 *         }
 *       );
 *     }
 *     throw error;
 *   }
 * }
 */
export async function withCAERetry<T>(
  operation: () => Promise<T>,
  config?: CAERetryConfig
): Promise<T> {
  const maxRetries = config?.maxRetries ?? 1;
  const throwOnFailure = config?.throwOnFailure ?? true;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // If it's a CAE error and we have retries left, propagate immediately
      // (client needs to handle and provide new token)
      if (isCAEError(error)) {
        if (throwOnFailure) {
          throw error;
        }
        return lastError;
      }

      // If not CAE error and we have retries left, try again
      if (attempt < maxRetries) {
        continue;
      }

      // No more retries
      if (throwOnFailure) {
        throw error;
      }
      return lastError;
    }
  }

  // Should not reach here, but TypeScript needs it
  if (throwOnFailure) {
    throw lastError;
  }
  return lastError;
}
