# @latch/core

**Modern OIDC authentication for Next.js and secure clouds**

Latch is a lightweight, security-minded authentication library for Next.js that implements OpenID Connect the right way — PKCE, refresh tokens, cookie sealing — and works in Azure Government clouds out of the box.

## Features

- ✅ **PKCE S256** (no client secrets needed)
- ✅ **HttpOnly encrypted cookies** (AES-GCM)
- ✅ **Azure Government cloud support** (GCC-High, DoD)
- ✅ **Next.js 15 App Router** native
- ✅ **TypeScript-first** with full IntelliSense
- ✅ **Audit-friendly** and transparent
- ✅ **Two modes:** Secure Proxy (default) or Direct Token

## Installation

```bash
pnpm add @latch/core
# or
npm install @latch/core
# or
yarn add @latch/core
```

## Quick Start

### 1. Configure environment variables

Create a `.env.local` file:

```env
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=$(openssl rand -base64 32)
```

**Cloud options:**
- `commercial` - Azure Commercial (`login.microsoftonline.com`)
- `gcc-high` - Azure Government GCC-High (`login.microsoftonline.us`)
- `dod` - Azure Government DoD (`login.microsoftonline.us` with DoD Graph)

### 2. Create API routes

Latch requires these API routes in your Next.js app:

```typescript
// app/api/latch/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getLatchConfig,
  getAzureEndpoints,
  validateScopes,
  COOKIE_NAMES,
  COOKIE_OPTIONS,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateNonce,
  seal,
  validateReturnUrl,
  LatchError,
  type PKCEData,
} from '@latch/core';

export async function GET(request: NextRequest) {
  const config = getLatchConfig();
  const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const nonce = generateNonce();

  // Store PKCE data
  const pkceData: PKCEData = { codeVerifier, state, nonce, returnTo: '/' };
  const sealedPkce = await seal(pkceData, config.cookieSecret!);

  // Build authorization URL
  const authUrl = new URL(endpoints.authorizeUrl);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', config.redirectUri!);
  authUrl.searchParams.set('scope', config.scopes?.join(' ') || '');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(COOKIE_NAMES.PKCE_DATA, sealedPkce, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 10,
  });

  return response;
}
```

> See the [example app](../../apps/example-app) for complete API route implementations.

### 3. Wrap your app with LatchProvider

```tsx
// app/layout.tsx
import { LatchProvider } from '@latch/core/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LatchProvider>{children}</LatchProvider>
      </body>
    </html>
  );
}
```

### 4. Use authentication in your components

```tsx
'use client';

import { useLatch } from '@latch/core/react';

export default function Home() {
  const { user, isAuthenticated, signIn, signOut } = useLatch();

  if (!isAuthenticated) {
    return <button onClick={() => signIn()}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### 5. Protect routes

```tsx
import { LatchGuard } from '@latch/core/react';

export default function Dashboard() {
  return (
    <LatchGuard>
      <DashboardContent />
    </LatchGuard>
  );
}
```

## Authentication Modes

### Secure Proxy Mode (Default)

Access tokens **never reach the browser**. All API calls are proxied through Next.js API routes.

```tsx
// app/api/me/route.ts
export async function GET(request: NextRequest) {
  const config = getLatchConfig();
  const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
  const tokens = await refreshAccessToken(...);

  // Call Graph API - token never exposed to client
  const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  return response.json();
}
```

### Direct Token Mode

Short-lived access token returned to client memory.

```tsx
'use client';

import { useAccessToken } from '@latch/core/react';

export function UserProfile() {
  const { accessToken, expiresAt } = useAccessToken();

  const fetchProfile = async () => {
    const response = await fetch('https://graph.microsoft.us/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.json();
  };
}
```

## Documentation

- **[API Reference](../../docs/API_REFERENCE.md)** - Complete API documentation
- **[Authentication Modes](../../docs/AUTHENTICATION_MODES.md)** - Secure Proxy vs Direct Token
- **[Troubleshooting](../../TROUBLESHOOTING.md)** - Solutions to common issues

## License

Apache License 2.0 - see [LICENSE](../../LICENSE)
