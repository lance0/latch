# Server Actions with Latch

Server Actions are asynchronous functions that run on the server and can be called directly from Client Components without creating API routes. This guide shows you how to use Latch authentication with Next.js 15 Server Actions.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication Helpers](#authentication-helpers)
- [Patterns](#patterns)
- [Error Handling](#error-handling)
- [When to Use Server Actions vs API Routes](#when-to-use-server-actions-vs-api-routes)
- [Security Best Practices](#security-best-practices)
- [Examples](#examples)

---

## Quick Start

### 1. Install Latch

```bash
npm install @lance0/latch@latest
```

### 2. Create a Server Action

```typescript
// app/actions/profile.ts
'use server';

import { requireAuth } from '@lance0/latch';

export async function getProfile() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  return {
    name: user.name,
    email: user.email,
  };
}
```

### 3. Call from Client Component

```typescript
// app/dashboard/page.tsx
'use client';

import { useState } from 'react';
import { getProfile } from '@/app/actions/profile';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  
  const loadProfile = async () => {
    const data = await getProfile();
    setProfile(data);
  };
  
  return (
    <button onClick={loadProfile}>Load Profile</button>
  );
}
```

---

## Authentication Helpers

Latch provides two helpers for Server Actions:

### `getServerSession(cookieSecret)`

Returns the current session. Use when you need to handle both authenticated and unauthenticated cases.

```typescript
'use server';

import { getServerSession } from '@lance0/latch';

export async function getData() {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
  
  if (!session.isAuthenticated) {
    return { data: null, error: 'Not authenticated' };
  }
  
  return { data: 'secret data', user: session.user };
}
```

**Returns:**
```typescript
{
  user: LatchUser | null,
  isAuthenticated: boolean
}
```

### `requireAuth(cookieSecret)`

Throws an error if not authenticated. Use when the action requires authentication.

```typescript
'use server';

import { requireAuth } from '@lance0/latch';

export async function deleteAccount() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // user is guaranteed to exist here
  await db.user.delete({ where: { id: user.sub } });
  
  return { success: true };
}
```

**Throws:** `LatchError` with code `LATCH_UNAUTHORIZED` if not authenticated.

---

## Patterns

### Pattern 1: Read Operations (Query Data)

Use `getServerSession()` for graceful handling:

```typescript
'use server';

import { getServerSession } from '@lance0/latch';

export async function getUserSettings() {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
  
  if (!session.isAuthenticated) {
    return { settings: null, error: 'Please sign in' };
  }
  
  const settings = await db.settings.findUnique({
    where: { userId: session.user.sub }
  });
  
  return { settings, error: null };
}
```

### Pattern 2: Write Operations (Mutations)

Use `requireAuth()` for required authentication:

```typescript
'use server';

import { requireAuth } from '@lance0/latch';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  const name = formData.get('name') as string;
  
  await db.user.update({
    where: { id: user.sub },
    data: { displayName: name }
  });
  
  // Revalidate cached pages
  revalidatePath('/profile');
  
  return { success: true };
}
```

### Pattern 3: Form Actions

Server Actions work seamlessly with form actions:

```typescript
// app/actions/settings.ts
'use server';

import { requireAuth } from '@lance0/latch';

export async function updateSettings(formData: FormData) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  const notifications = formData.get('notifications') === 'on';
  const theme = formData.get('theme') as string;
  
  await db.settings.upsert({
    where: { userId: user.sub },
    update: { notifications, theme },
    create: { userId: user.sub, notifications, theme }
  });
  
  return { success: true, message: 'Settings saved' };
}
```

```typescript
// app/settings/page.tsx
import { updateSettings } from '@/app/actions/settings';

export default function SettingsPage() {
  return (
    <form action={updateSettings}>
      <input type="checkbox" name="notifications" />
      <select name="theme">
        <option>light</option>
        <option>dark</option>
      </select>
      <button type="submit">Save</button>
    </form>
  );
}
```

### Pattern 4: Authorization Checks

Add role-based authorization after authentication:

```typescript
'use server';

import { requireAuth } from '@lance0/latch';

export async function deleteUser(userId: string) {
  const currentUser = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Check if user has admin role
  const isAdmin = await db.role.findFirst({
    where: { userId: currentUser.sub, role: 'admin' }
  });
  
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin role required');
  }
  
  await db.user.delete({ where: { id: userId } });
  
  return { success: true };
}
```

### Pattern 5: Using with `useTransition`

Show loading states while Server Actions execute:

```typescript
'use client';

import { useState, useTransition } from 'react';
import { updateProfile } from '@/app/actions/profile';

export default function ProfileForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const data = await updateProfile(formData);
      setResult(data);
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {result && <div>{result.message}</div>}
    </form>
  );
}
```

---

## Error Handling

### Handling Authentication Errors

```typescript
'use client';

import { useState } from 'react';
import { requireAuth } from '@lance0/latch';
import { deleteAccount } from '@/app/actions/account';

export default function DangerZone() {
  const [error, setError] = useState<string | null>(null);
  
  const handleDelete = async () => {
    try {
      await deleteAccount();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Authentication required')) {
          // Redirect to login
          window.location.href = '/api/latch/start';
        } else {
          setError(err.message);
        }
      }
    }
  };
  
  return (
    <div>
      <button onClick={handleDelete}>Delete Account</button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Structured Error Responses

Return structured objects instead of throwing:

```typescript
'use server';

import { requireAuth } from '@lance0/latch';

export async function updateEmail(newEmail: string) {
  try {
    const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
    
    // Validate email
    if (!newEmail.includes('@')) {
      return { success: false, error: 'Invalid email format' };
    }
    
    await db.user.update({
      where: { id: user.sub },
      data: { email: newEmail }
    });
    
    return { success: true, message: 'Email updated' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

---

## When to Use Server Actions vs API Routes

### Use Server Actions When:

✅ **Mutations from forms** - Form actions with progressive enhancement  
✅ **Simple data fetching** - Don't need request/response control  
✅ **Type-safe calls** - Want end-to-end TypeScript type safety  
✅ **Collocated with components** - Action lives near the UI that uses it  
✅ **No external clients** - Only called from your own frontend

### Use API Routes When:

✅ **RESTful APIs** - Need standard HTTP endpoints  
✅ **Webhooks** - External services call your endpoints  
✅ **Complex middleware** - Need request/response manipulation  
✅ **Rate limiting** - Need fine-grained request control  
✅ **Public APIs** - External clients need to call your API  
✅ **OAuth callbacks** - Standard OAuth flows (like Latch uses)

### Example Decision Matrix

| Feature | Server Action | API Route |
|---------|--------------|-----------|
| Update user profile | ✅ Better | ✅ Works |
| Form submission | ✅ Better | ✅ Works |
| OAuth callback | ❌ | ✅ Required |
| Webhook receiver | ❌ | ✅ Required |
| Mobile app API | ❌ | ✅ Required |
| Delete account | ✅ Better | ✅ Works |
| Get current user | ✅ Better | ✅ Works |
| Public REST API | ❌ | ✅ Required |

---

## Security Best Practices

### 1. Always Validate Authentication

```typescript
// ❌ BAD: No authentication check
'use server';
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
}

// ✅ GOOD: Require authentication
'use server';
import { requireAuth } from '@lance0/latch';

export async function deleteUser(userId: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Only allow users to delete their own account
  if (user.sub !== userId) {
    throw new Error('Unauthorized');
  }
  
  await db.user.delete({ where: { id: userId } });
}
```

### 2. Validate All Input

```typescript
'use server';

import { requireAuth } from '@lance0/latch';
import { z } from 'zod';

const UpdateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function updateProfile(data: unknown) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Validate input
  const validated = UpdateSchema.parse(data);
  
  await db.user.update({
    where: { id: user.sub },
    data: validated
  });
}
```

### 3. Use Environment Variables for Secrets

```typescript
// ❌ BAD: Hardcoded secret
const user = await requireAuth('my-secret-key');

// ✅ GOOD: Environment variable
const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
```

### 4. Rate Limit Expensive Operations

```typescript
'use server';

import { requireAuth } from '@lance0/latch';
import { rateLimit } from '@/lib/rateLimit';

export async function sendEmail(to: string, content: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Rate limit: 10 emails per hour per user
  const limited = await rateLimit(user.sub, 10, 3600);
  if (limited) {
    throw new Error('Rate limit exceeded');
  }
  
  await sendEmailService(to, content);
}
```

### 5. Log Security Events

```typescript
'use server';

import { requireAuth } from '@lance0/latch';

export async function changePassword(oldPassword: string, newPassword: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // Verify old password
  const valid = await verifyPassword(user.sub, oldPassword);
  if (!valid) {
    // Log failed attempt
    await auditLog.create({
      userId: user.sub,
      event: 'PASSWORD_CHANGE_FAILED',
      timestamp: new Date(),
    });
    throw new Error('Invalid password');
  }
  
  // Change password
  await updatePassword(user.sub, newPassword);
  
  // Log success
  await auditLog.create({
    userId: user.sub,
    event: 'PASSWORD_CHANGED',
    timestamp: new Date(),
  });
}
```

---

## Examples

### Example 1: User Profile Management

```typescript
// app/actions/profile.ts
'use server';

import { requireAuth } from '@lance0/latch';
import { revalidatePath } from 'next/cache';

export async function getProfile() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  const profile = await db.profile.findUnique({
    where: { userId: user.sub }
  });
  
  return {
    user: {
      sub: user.sub,
      name: user.name,
      email: user.email,
    },
    profile,
  };
}

export async function updateBio(bio: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  if (bio.length > 500) {
    return { success: false, error: 'Bio too long (max 500 chars)' };
  }
  
  await db.profile.upsert({
    where: { userId: user.sub },
    update: { bio },
    create: { userId: user.sub, bio }
  });
  
  revalidatePath('/profile');
  
  return { success: true };
}
```

### Example 2: File Upload

```typescript
// app/actions/upload.ts
'use server';

import { requireAuth } from '@lance0/latch';
import { put } from '@vercel/blob';

export async function uploadAvatar(formData: FormData) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  const file = formData.get('avatar') as File;
  
  if (!file) {
    return { success: false, error: 'No file provided' };
  }
  
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File too large (max 5MB)' };
  }
  
  // Upload to blob storage
  const blob = await put(`avatars/${user.sub}.jpg`, file, {
    access: 'public',
  });
  
  // Update user record
  await db.user.update({
    where: { id: user.sub },
    data: { avatarUrl: blob.url }
  });
  
  return { success: true, url: blob.url };
}
```

### Example 3: Real-time Notifications

```typescript
// app/actions/notifications.ts
'use server';

import { requireAuth } from '@lance0/latch';

export async function getUnreadCount() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  const count = await db.notification.count({
    where: {
      userId: user.sub,
      read: false
    }
  });
  
  return { count };
}

export async function markAsRead(notificationId: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  await db.notification.updateMany({
    where: {
      id: notificationId,
      userId: user.sub // Ensure ownership
    },
    data: { read: true }
  });
  
  return { success: true };
}
```

---

## See Also

- [Latch README](../README.md)
- [Authentication Setup Guide](./AUTHENTICATION_SETUP.md)
- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Example App](../apps/example-app)
- [Server Actions Demo Page](../apps/example-app/app/dashboard/server-actions-demo/page.tsx)

---

**Need Help?**

- GitHub Issues: [https://github.com/lance0/latch/issues](https://github.com/lance0/latch/issues)
- Example Code: See `apps/example-app/app/actions/` for working examples
