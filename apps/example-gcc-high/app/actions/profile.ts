'use server';

import { getServerSession, requireAuth } from '@lance0/latch';

/**
 * Get the current user's profile (public Server Action)
 * 
 * This demonstrates using getServerSession() to check authentication
 * and handle both authenticated and unauthenticated cases.
 */
export async function getProfile() {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
  
  if (!session.isAuthenticated) {
    return {
      success: false,
      error: 'Not authenticated',
      user: null,
    };
  }
  
  return {
    success: true,
    user: {
      name: session.user?.name,
      email: session.user?.email,
      sub: session.user?.sub,
      preferred_username: session.user?.preferred_username,
    },
  };
}

/**
 * Get user initials (protected Server Action)
 * 
 * This demonstrates using requireAuth() to ensure authentication.
 * Will throw an error if user is not authenticated.
 */
export async function getUserInitials() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // User is guaranteed to exist here
  const displayName = user.email || user.preferred_username || user.name || user.sub;
  
  // Generate initials
  let initials = '';
  if (displayName.includes('@')) {
    const [localPart] = displayName.split('@');
    initials = (localPart?.[0] || '') + (localPart?.[1] || '');
  } else if (displayName.includes(' ')) {
    const parts = displayName.split(' ').filter(Boolean);
    initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  } else {
    initials = displayName.slice(0, 2);
  }
  
  return {
    success: true,
    initials: initials.toUpperCase(),
    displayName,
  };
}

/**
 * Check if user is admin (example authorization pattern)
 * 
 * This demonstrates checking user properties after authentication.
 */
export async function checkAdminStatus() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Example: Check if user has admin role
  // In production, you'd check against your database or a roles claim
  const isAdmin = user.email?.endsWith('@admin.example.com') ?? false;
  
  return {
    success: true,
    isAdmin,
    user: {
      sub: user.sub,
      email: user.email,
    },
  };
}
