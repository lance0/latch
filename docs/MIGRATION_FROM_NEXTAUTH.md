# Migrating from NextAuth.js to Latch

This guide helps you migrate from NextAuth.js v4/v5 to Latch for Azure AD authentication.

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Key Differences](#key-differences)
- [Migration Steps](#migration-steps)
- [Code Comparison](#code-comparison)
- [Feature Mapping](#feature-mapping)
- [Troubleshooting](#troubleshooting)

---

## Why Migrate?

### When Latch is a Better Choice

✅ **Azure-focused applications:**
- Native Azure Government cloud support (GCC-High, DoD)
- First-class Azure AD integration
- No adapter configuration needed

✅ **Government/compliance requirements:**
- FedRAMP High / IL4 compliance patterns
- Built-in token confusion attack prevention
- Strict issuer validation

✅ **Simpler architecture:**
- No database required for sessions
- Stateless authentication
- Direct cookie encryption (no session adapter)

✅ **Next.js 15+ modern patterns:**
- Native Server Actions support
- App Router first (not Pages Router legacy)
- TypeScript-first design

### When to Stay with NextAuth.js

❌ **Multiple OAuth providers:**
- NextAuth supports 50+ providers
- Latch is Azure AD only

❌ **Database-backed sessions:**
- Need session storage in database
- Complex session data requirements

❌ **Pages Router (legacy):**
- Still using Next.js Pages Router
- Not ready to migrate to App Router

---

## Key Differences

| Feature | NextAuth.js | Latch |
|---------|-------------|-------|
| **Providers** | 50+ OAuth providers | Azure AD only |
| **Session Storage** | Database or JWT | Encrypted cookies only |
| **Configuration** | Large config object | Environment variables |
| **Azure Government** | Requires custom provider | Built-in (`LATCH_CLOUD`) |
| **Server Actions** | Requires workarounds | Native `getServerSession()` |
| **Token Storage** | Session object | Separate encrypted cookies |
| **PKCE** | Optional | Always enabled |
| **Setup Complexity** | Medium-High | Low |
| **TypeScript** | Good | Excellent |

---

## Migration Steps

### Step 1: Install Latch

```bash
npm uninstall next-auth
npm install @lance0/latch
```

### Step 2: Replace Configuration

**Before (NextAuth.js):**
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

**After (Latch):**
```env
# .env.local
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLIENT_SECRET=your-client-secret
LATCH_CLOUD=commercial
LATCH_SCOPES=openid profile email User.Read offline_access
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=$(openssl rand -base64 32)
```

Copy API routes from [example app](../apps/example-app/app/api/latch/).

### Step 3: Update Session Access

**Before (NextAuth.js):**
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/api/auth/signin');
  }
  
  return <div>Welcome {session.user?.name}</div>;
}
```

**After (Latch):**
```typescript
import { getServerSession } from '@lance0/latch';

export default async function ProfilePage() {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
  
  if (!session.isAuthenticated) {
    redirect('/api/latch/start');
  }
  
  return <div>Welcome {session.user?.name}</div>;
}
```

### Step 4: Update Client Components

**Before (NextAuth.js):**
```typescript
'use client';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function LoginButton() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  
  if (session) {
    return <button onClick={() => signOut()}>Sign Out</button>;
  }
  
  return <button onClick={() => signIn('azure-ad')}>Sign In</button>;
}
```

**After (Latch):**
```typescript
'use client';
import { useLatch } from '@lance0/latch/react';

export default function LoginButton() {
  const { user, isLoading, signIn, signOut } = useLatch();
  
  if (isLoading) return <div>Loading...</div>;
  
  if (user) {
    return <button onClick={() => signOut()}>Sign Out</button>;
  }
  
  return <button onClick={() => signIn()}>Sign In</button>;
}
```

### Step 5: Update Root Layout

**Before (NextAuth.js):**
```typescript
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

**After (Latch):**
```typescript
import { LatchProvider } from '@lance0/latch/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LatchProvider>{children}</LatchProvider>
      </body>
    </html>
  );
}
```

### Step 6: Update API Routes

**Before (NextAuth.js accessing token):**
```typescript
import { getServerSession } from "next-auth";

export async function GET(request: Request) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;
  
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  return Response.json(await response.json());
}
```

**After (Latch - Secure Proxy mode):**
```typescript
import { getLatchConfig, refreshAccessToken, unseal, COOKIE_NAMES } from '@lance0/latch';

export async function GET(request: Request) {
  const config = getLatchConfig();
  
  // Get refresh token from cookie
  const rtCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
  const rtData = await unseal(rtCookie.value, config.cookieSecret!);
  
  // Get fresh access token
  const tokens = await refreshAccessToken(
    rtData.refreshToken,
    config.clientId,
    config.tenantId,
    config.cloud,
    ['User.Read']
  );
  
  // Call API (token never exposed to client)
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  
  return Response.json(await response.json());
}
```

---

## Code Comparison

### Session Type

**NextAuth.js:**
```typescript
interface Session {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
}
```

**Latch:**
```typescript
interface LatchSession {
  user: LatchUser | null;
  isAuthenticated: boolean;
}

interface LatchUser {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  iat: number;
  exp: number;
}
```

### Middleware Protection

**NextAuth.js:**
```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*"]
};
```

**Latch:**
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from '@lance0/latch';

export async function middleware(request: NextRequest) {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);
  
  if (!session.isAuthenticated) {
    return NextResponse.redirect(new URL('/api/latch/start', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"]
};
```

### Server Actions

**NextAuth.js (requires workaround):**
```typescript
'use server';
import { getServerSession } from "next-auth";

export async function updateProfile(name: string) {
  const session = await getServerSession(); // May not work reliably
  if (!session) throw new Error('Not authenticated');
  
  // ... update logic
}
```

**Latch (native support):**
```typescript
'use server';
import { requireAuth } from '@lance0/latch';

export async function updateProfile(name: string) {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  
  // user is guaranteed to exist
  // ... update logic
}
```

---

## Feature Mapping

### Authentication

| NextAuth.js | Latch | Notes |
|-------------|-------|-------|
| `signIn('azure-ad')` | `signIn()` | No provider parameter needed |
| `signOut()` | `signOut()` | Same API |
| `useSession()` | `useLatch()` | Returns `{ user, isAuthenticated, isLoading }` |
| `getServerSession(authOptions)` | `getServerSession(cookieSecret)` | Simpler parameters |

### Session Data

| NextAuth.js | Latch |
|-------------|-------|
| `session.user.name` | `session.user?.name` |
| `session.user.email` | `session.user?.email` |
| `session.user.image` | Not included (use Graph API) |
| `session.expires` | `session.user.exp` |
| Custom data via callbacks | Use separate API routes |

### Token Access

| NextAuth.js | Latch |
|-------------|-------|
| `session.accessToken` (via callback) | Use `/api/latch/refresh` |
| `token.refreshToken` (JWT callback) | Stored in encrypted cookie (automatic) |
| Manual token refresh | `refreshAccessToken()` function |

---

## Azure Government Support

### NextAuth.js (requires custom provider):

```typescript
// Complex custom provider setup
AzureADProvider({
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  tenantId: process.env.AZURE_AD_TENANT_ID!,
  authorization: {
    url: "https://login.microsoftonline.us/.../oauth2/v2.0/authorize",
    params: { scope: "openid profile email" }
  },
  token: "https://login.microsoftonline.us/.../oauth2/v2.0/token",
  userinfo: "https://graph.microsoft.us/oidc/userinfo",
});
```

### Latch (one environment variable):

```env
LATCH_CLOUD=gcc-high
```

That's it! All endpoints automatically configured.

---

## Common Migration Issues

### Issue 1: Session Data Structure

**Problem:** NextAuth session has different structure

```typescript
// ❌ This breaks
const email = session.user.email; // NextAuth
const email = session.user.email; // Latch (user might be null!)
```

**Solution:**
```typescript
// ✅ Check authentication first
if (!session.isAuthenticated || !session.user) {
  // Handle unauthenticated
}
const email = session.user.email;
```

### Issue 2: Access Tokens

**Problem:** NextAuth exposes access tokens in session, Latch doesn't

**Solution:** Use Secure Proxy pattern or Direct Token mode

```typescript
// Option 1: Secure Proxy (recommended)
// Call your API route that uses refreshAccessToken()

// Option 2: Direct Token mode
const response = await fetch('/api/latch/refresh', { method: 'POST' });
const { access_token } = await response.json();
```

### Issue 3: Custom Session Data

**Problem:** NextAuth allows adding custom data via callbacks

```typescript
// NextAuth
callbacks: {
  async session({ session, token }) {
    session.customData = token.customData;
    return session;
  }
}
```

**Solution:** Store custom data in your database, keyed by `user.sub`

```typescript
// Latch
const customData = await db.customData.findUnique({
  where: { userId: session.user.sub }
});
```

### Issue 4: Multiple Providers

**Problem:** NextAuth supports multiple providers, Latch only supports Azure AD

**Solution:** If you need multiple providers, stay with NextAuth or use Latch alongside other solutions

---

## Migration Checklist

- [ ] Install `@lance0/latch` and uninstall `next-auth`
- [ ] Create `.env.local` with Latch configuration
- [ ] Copy API routes from example app (`/api/latch/*`)
- [ ] Replace `SessionProvider` with `LatchProvider` in layout
- [ ] Replace `useSession()` with `useLatch()` in components
- [ ] Replace `getServerSession(authOptions)` with `getServerSession(cookieSecret)`
- [ ] Update middleware if using route protection
- [ ] Replace sign-in links (`/api/auth/signin` → `/api/latch/start`)
- [ ] Test authentication flow
- [ ] Test token refresh (if using Graph API)
- [ ] Remove NextAuth.js configuration files
- [ ] Update documentation for your team

---

## Performance Comparison

| Metric | NextAuth.js | Latch |
|--------|-------------|-------|
| **Setup time** | ~30 minutes | ~10 minutes |
| **Auth request** | Database query + JWT decode | Cookie decrypt only |
| **Session check** | ~5-20ms (DB) or ~1ms (JWT) | ~0.5ms (cookie) |
| **Dependencies** | Many (database adapter, etc.) | Minimal (jose for JWKS) |
| **Bundle size** | ~50KB | ~30KB |

---

## Need Help?

- [Latch Documentation](../README.md)
- [Example Apps](../apps/)
- [Server Actions Guide](./SERVER_ACTIONS.md)
- [GitHub Issues](https://github.com/lance0/latch/issues)

---

## Complete Example

See [example-commercial](../apps/example-commercial/) for a complete working application that demonstrates all Latch features.
