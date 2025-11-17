import { cookies } from 'next/headers';
import { LatchUser, TokenResponse, LatchError, RefreshTokenData, LatchSession } from './types';
import { unseal } from './crypto/seal';
import { COOKIE_NAMES } from './config';

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

/**
 * Get the current user session in Server Actions or Server Components
 * 
 * This function reads the session from cookies and validates it. Use this in Server Actions
 * or Server Components to check if a user is authenticated.
 * 
 * **Important:** Requires LATCH_COOKIE_SECRET environment variable.
 * 
 * @param cookieSecret - Cookie encryption secret (from getLatchConfig().cookieSecret)
 * @returns LatchSession with user object if authenticated, null if not
 * 
 * @example
 * ```typescript
 * // In a Server Action
 * 'use server';
 * 
 * import { getServerSession } from '@lance0/latch';
 * 
 * export async function getProfile() {
 *   const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
 *   
 *   if (!session.isAuthenticated) {
 *     throw new Error('Not authenticated');
 *   }
 *   
 *   return session.user;
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // In a Server Component
 * import { getServerSession } from '@lance0/latch';
 * 
 * export default async function ProfilePage() {
 *   const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
 *   
 *   if (!session.isAuthenticated) {
 *     redirect('/api/latch/start');
 *   }
 *   
 *   return <div>Welcome {session.user.name}!</div>;
 * }
 * ```
 */
export async function getServerSession(cookieSecret: string): Promise<LatchSession> {
  try {
    const cookieStore = await cookies();
    
    // Get ID token and refresh token from cookies
    const idTokenCookie = cookieStore.get(COOKIE_NAMES.ID_TOKEN);
    const refreshTokenCookie = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN);

    if (!idTokenCookie || !refreshTokenCookie) {
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    const user = await unseal<LatchUser>(idTokenCookie.value, cookieSecret);
    const refreshTokenData = await unseal<RefreshTokenData>(
      refreshTokenCookie.value,
      cookieSecret
    );

    // Check if refresh token is expired (7-day session lifetime)
    const now = Date.now();
    if (refreshTokenData.expiresAt < now) {
      return {
        user: null,
        isAuthenticated: false,
      };
    }

    return {
      user,
      isAuthenticated: true,
    };
  } catch (error) {
    // If decryption fails or any error, return unauthenticated
    return {
      user: null,
      isAuthenticated: false,
    };
  }
}

/**
 * Require authentication in Server Actions or Server Components
 * 
 * Throws an error if user is not authenticated. Use this as a guard at the start
 * of Server Actions that require authentication.
 * 
 * @param cookieSecret - Cookie encryption secret (from getLatchConfig().cookieSecret)
 * @returns LatchUser object (guaranteed to exist)
 * @throws {LatchError} if user is not authenticated
 * 
 * @example
 * ```typescript
 * // In a Server Action
 * 'use server';
 * 
 * import { requireAuth } from '@lance0/latch';
 * 
 * export async function deleteAccount() {
 *   const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
 *   
 *   // user is guaranteed to exist here
 *   await db.user.delete({ where: { id: user.sub } });
 *   
 *   return { success: true };
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // In a Server Action with custom error
 * 'use server';
 * 
 * import { requireAuth } from '@lance0/latch';
 * 
 * export async function updateProfile(formData: FormData) {
 *   const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
 *   
 *   const name = formData.get('name') as string;
 *   await db.user.update({
 *     where: { id: user.sub },
 *     data: { name }
 *   });
 *   
 *   return { success: true };
 * }
 * ```
 */
export async function requireAuth(cookieSecret: string): Promise<LatchUser> {
  const session = await getServerSession(cookieSecret);
  
  if (!session.isAuthenticated || !session.user) {
    throw new LatchError(
      'LATCH_UNAUTHORIZED',
      '[Latch] Authentication required.\n\n' +
      'This Server Action requires an authenticated user.\n\n' +
      'Make sure the user is signed in before calling this action.\n' +
      'You can check authentication status using getServerSession() first.'
    );
  }
  
  return session.user;
}

/**
 * Get authenticated session or throw error
 * 
 * Use in API routes and Server Components when authentication is required.
 * Returns a session with guaranteed user object (TypeScript knows user is not null).
 * 
 * @param cookieSecret - The LATCH_COOKIE_SECRET value
 * @returns Authenticated session with guaranteed user object
 * @throws {LatchError} LATCH_UNAUTHORIZED if not authenticated
 * 
 * @example
 * ```typescript
 * // In API route
 * export async function GET(request: NextRequest) {
 *   try {
 *     const session = await requireServerSession(process.env.LATCH_COOKIE_SECRET!);
 *     // session.user is guaranteed to exist - no need for ! assertion
 *     return Response.json({ userId: session.user.sub });
 *   } catch (error) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 * }
 * ```
 */
export async function requireServerSession(
  cookieSecret: string
): Promise<LatchSession & { isAuthenticated: true; user: LatchUser }> {
  const session = await getServerSession(cookieSecret);

  if (!session.isAuthenticated || !session.user) {
    throw new LatchError(
      'LATCH_UNAUTHORIZED',
      'Valid session required. User must be signed in to access this resource.'
    );
  }

  return session as LatchSession & { isAuthenticated: true; user: LatchUser };
}

/**
 * Type guard to check if session is authenticated
 * 
 * Narrows TypeScript type to guarantee user exists.
 * Useful for conditional logic where you check session validity.
 * 
 * @param session - Session object to check
 * @returns True if session is authenticated with valid user
 * 
 * @example
 * ```typescript
 * const session = await getServerSession(secret);
 * 
 * if (isLatchSession(session)) {
 *   // TypeScript knows session.user is LatchUser (not null)
 *   console.log(session.user.sub);
 *   console.log(session.user.email);
 * }
 * ```
 */
export function isLatchSession(
  session: LatchSession | null
): session is LatchSession & { isAuthenticated: true; user: LatchUser } {
  return session !== null && session.isAuthenticated === true && session.user !== null;
}

/**
 * Check if Latch is properly configured
 * 
 * Useful for /api/health endpoints and startup checks.
 * Validates that all required environment variables are set.
 * 
 * @returns Object with configuration status and any errors/warnings
 * 
 * @example
 * ```typescript
 * // In /api/health route
 * export async function GET() {
 *   const health = checkLatchHealth();
 *   
 *   if (!health.configured) {
 *     return Response.json({
 *       status: 'unhealthy',
 *       latch: health
 *     }, { status: 500 });
 *   }
 *   
 *   return Response.json({ status: 'healthy' });
 * }
 * ```
 */
export function checkLatchHealth(): {
  configured: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  if (!process.env.LATCH_CLIENT_ID) {
    errors.push('LATCH_CLIENT_ID missing');
  }
  if (!process.env.LATCH_TENANT_ID) {
    errors.push('LATCH_TENANT_ID missing');
  }
  if (!process.env.LATCH_COOKIE_SECRET) {
    errors.push('LATCH_COOKIE_SECRET missing');
  } else if (process.env.LATCH_COOKIE_SECRET.length < 32) {
    warnings.push('LATCH_COOKIE_SECRET should be at least 32 characters');
  }
  if (!process.env.LATCH_CLOUD) {
    errors.push('LATCH_CLOUD missing');
  }
  if (!process.env.LATCH_SCOPES) {
    errors.push('LATCH_SCOPES missing');
  }
  if (!process.env.LATCH_REDIRECT_URI) {
    errors.push('LATCH_REDIRECT_URI missing');
  }

  // Optional but recommended
  if (!process.env.LATCH_CLIENT_SECRET) {
    warnings.push('LATCH_CLIENT_SECRET not set (using public client mode)');
  }

  return {
    configured: errors.length === 0,
    errors,
    warnings,
  };
}
