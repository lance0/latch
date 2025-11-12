'use server';

import { requireAuth } from '@lance0/latch';
import { revalidatePath } from 'next/cache';

/**
 * Update user display name (example mutation with form data)
 * 
 * This demonstrates:
 * - Using requireAuth() to protect mutations
 * - Processing FormData from forms
 * - Returning success/error responses
 * - Cache revalidation after mutations
 */
export async function updateDisplayName(formData: FormData) {
  try {
    const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
    
    const newName = formData.get('name') as string;
    
    if (!newName || newName.trim().length === 0) {
      return {
        success: false,
        error: 'Name is required',
      };
    }
    
    if (newName.length > 100) {
      return {
        success: false,
        error: 'Name must be less than 100 characters',
      };
    }
    
    // In production, you would update your database here
    // await db.user.update({
    //   where: { id: user.sub },
    //   data: { displayName: newName.trim() }
    // });
    
    console.log(`[Server Action] User ${user.sub} updated name to: ${newName}`);
    
    // Revalidate any pages that display the user's name
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/server-actions-demo');
    
    return {
      success: true,
      message: 'Display name updated successfully',
      newName: newName.trim(),
    };
  } catch (error) {
    console.error('[Server Action] Error updating display name:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update display name',
    };
  }
}

/**
 * Update user email preferences (example of validating input)
 * 
 * This demonstrates:
 * - Input validation in Server Actions
 * - Structured return types
 * - Error handling patterns
 */
export async function updateEmailPreferences(preferences: {
  marketing: boolean;
  security: boolean;
  product: boolean;
}) {
  try {
    const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
    
    // Validate input
    if (typeof preferences.marketing !== 'boolean' ||
        typeof preferences.security !== 'boolean' ||
        typeof preferences.product !== 'boolean') {
      return {
        success: false,
        error: 'Invalid preferences format',
      };
    }
    
    // In production, update database
    // await db.emailPreferences.upsert({
    //   where: { userId: user.sub },
    //   create: { userId: user.sub, ...preferences },
    //   update: preferences
    // });
    
    console.log(`[Server Action] User ${user.sub} updated email preferences:`, preferences);
    
    return {
      success: true,
      message: 'Email preferences updated',
      preferences,
    };
  } catch (error) {
    console.error('[Server Action] Error updating email preferences:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update preferences',
    };
  }
}

/**
 * Delete user account (example of dangerous operation with confirmation)
 * 
 * This demonstrates:
 * - Requiring explicit confirmation
 * - Dangerous operations with extra validation
 * - Logging for audit trails
 */
export async function deleteAccount(confirmation: string) {
  try {
    const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
    
    // Require explicit confirmation
    if (confirmation !== 'DELETE') {
      return {
        success: false,
        error: 'Please type DELETE to confirm account deletion',
      };
    }
    
    // In production:
    // 1. Delete user data from database
    // 2. Revoke all sessions
    // 3. Send confirmation email
    // 4. Log to audit trail
    
    console.log(`[Server Action] User ${user.sub} initiated account deletion`);
    console.log('[Server Action] THIS IS A DEMO - Account not actually deleted');
    
    return {
      success: true,
      message: 'Account deletion initiated (demo mode)',
    };
  } catch (error) {
    console.error('[Server Action] Error deleting account:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account',
    };
  }
}
