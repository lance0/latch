import { LatchUser, TokenResponse, LatchError } from './types';

/**
 * Get the best available display name for a user
 * 
 * Falls back through: email → preferred_username → name → sub
 * 
 * @param user - User object from verifyIdToken()
 * @returns A display name that is always defined
 * 
 * @example
 * ```typescript
 * const displayName = getUserDisplayName(user);
 * // "john@example.com" or "john.doe" or "John Doe" or "abc-123-def"
 * ```
 */
export function getUserDisplayName(user: LatchUser): string {
  return user.email || user.preferred_username || user.name || user.sub;
}

/**
 * Get user initials for avatar display
 * 
 * @param user - User object from verifyIdToken()
 * @returns Two-letter initials (uppercase)
 * 
 * @example
 * ```typescript
 * getUserInitials(user);
 * // "JD" for "John Doe"
 * // "JE" for "john@example.com"
 * // "AB" for "abc-123-def"
 * ```
 */
export function getUserInitials(user: LatchUser): string {
  const displayName = getUserDisplayName(user);
  
  // If it's an email, use first letter + letter after @
  if (displayName.includes('@')) {
    const [localPart] = displayName.split('@');
    const firstChar = localPart?.[0] || '';
    const secondChar = localPart?.[1] || firstChar;
    return (firstChar + secondChar).toUpperCase();
  }
  
  // If it has spaces (full name), use first letter of each word
  if (displayName.includes(' ')) {
    const parts = displayName.split(' ').filter(Boolean);
    const firstChar = parts[0]?.[0] || '';
    const secondChar = parts[1]?.[0] || parts[0]?.[1] || firstChar;
    return (firstChar + secondChar).toUpperCase();
  }
  
  // Otherwise use first two characters
  const firstChar = displayName[0] || 'U';
  const secondChar = displayName[1] || firstChar;
  return (firstChar + secondChar).toUpperCase();
}

/**
 * Require ID token from token response or throw helpful error
 * 
 * @param tokens - Token response from exchangeCodeForTokens()
 * @returns ID token string (guaranteed to exist)
 * @throws {LatchError} if ID token is missing with instructions
 * 
 * @example
 * ```typescript
 * // Instead of:
 * const user = await verifyIdToken(tokens.id_token!, ...);  // ❌ Might crash
 * 
 * // Use:
 * const user = await verifyIdToken(requireIdToken(tokens), ...);  // ✅ Clear error
 * ```
 */
export function requireIdToken(tokens: TokenResponse): string {
  if (!tokens.id_token) {
    throw new LatchError(
      'LATCH_ID_TOKEN_INVALID',
      '[Latch] ID token missing from token response.\n\n' +
      'This means the "openid" scope was not requested or granted.\n\n' +
      'Fix by setting in .env.local:\n' +
      '  LATCH_SCOPES=openid profile email offline_access\n\n' +
      'Or ensure your Azure AD app registration allows these scopes.'
    );
  }
  return tokens.id_token;
}

/**
 * Require refresh token from token response or throw helpful error
 * 
 * @param tokens - Token response from exchangeCodeForTokens()
 * @returns Refresh token string (guaranteed to exist)
 * @throws {LatchError} if refresh token is missing with instructions
 * 
 * @example
 * ```typescript
 * const refreshToken = requireRefreshToken(tokens);
 * await seal({ refreshToken, expiresAt }, secret);
 * ```
 */
export function requireRefreshToken(tokens: TokenResponse): string {
  if (!tokens.refresh_token) {
    throw new LatchError(
      'LATCH_REFRESH_TOKEN_MISSING',
      '[Latch] Refresh token missing from token response.\n\n' +
      'This means the "offline_access" scope was not requested or granted.\n\n' +
      'Fix by setting in .env.local:\n' +
      '  LATCH_SCOPES=openid profile email offline_access\n\n' +
      'Or ensure your Azure AD app registration allows offline_access scope.'
    );
  }
  return tokens.refresh_token;
}

/**
 * Check if all recommended scopes are present
 * 
 * @param scopes - Array of scope strings
 * @returns Object indicating which features are available and any warnings
 * 
 * @example
 * ```typescript
 * const { hasEmail, hasRefreshToken, warnings } = checkScopes(config.scopes);
 * 
 * if (!hasEmail) {
 *   console.warn('Email will not be available in user object');
 * }
 * 
 * warnings.forEach(w => console.warn(w));
 * ```
 */
export function checkScopes(scopes: string[]): {
  hasOpenId: boolean;
  hasProfile: boolean;
  hasEmail: boolean;
  hasOfflineAccess: boolean;
  hasIdToken: boolean;
  hasRefreshToken: boolean;
  warnings: string[];
} {
  const scopeString = scopes.join(' ').toLowerCase();
  
  const hasOpenId = scopeString.includes('openid');
  const hasProfile = scopeString.includes('profile');
  const hasEmail = scopeString.includes('email');
  const hasOfflineAccess = scopeString.includes('offline_access');
  
  const warnings: string[] = [];
  
  if (!hasOpenId) {
    warnings.push('Missing "openid" scope - ID token will not be returned');
  }
  
  if (!hasProfile) {
    warnings.push('Missing "profile" scope - user.name and user.preferred_username will be undefined');
  }
  
  if (!hasEmail) {
    warnings.push('Missing "email" scope - user.email will be undefined');
  }
  
  if (!hasOfflineAccess) {
    warnings.push('Missing "offline_access" scope - refresh token will not be returned (session expires in 1 hour)');
  }
  
  return {
    hasOpenId,
    hasProfile,
    hasEmail,
    hasOfflineAccess,
    hasIdToken: hasOpenId,
    hasRefreshToken: hasOfflineAccess,
    warnings,
  };
}
