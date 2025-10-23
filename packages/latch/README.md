# @latch/core

[![npm version](https://badge.fury.io/js/@latch%2Fcore.svg)](https://www.npmjs.com/package/@latch/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

**Security-first OIDC authentication for Next.js 15+ with native Azure Government cloud support**

Latch is a lightweight authentication library built specifically for Next.js App Router with first-class support for Azure Government clouds (GCC-High, DoD). Implements PKCE S256, encrypted HttpOnly cookies, and provides both Secure Proxy and Direct Token modes.

## Features

- ✅ **Azure Government Ready** - Native GCC-High (IL4) and DoD (IL5) support
- ✅ **Next.js 15+ Optimized** - Built for App Router with React Server Components
- ✅ **Security First** - PKCE S256, AES-GCM cookies, CSRF protection, open redirect prevention
- ✅ **Dual Auth Modes** - PKCE-only (public) or client_secret (confidential)
- ✅ **Zero-Downtime Rotation** - Client secret rotation procedures included
- ✅ **Type Safe** - Full TypeScript strict mode with IntelliSense
- ✅ **Lightweight** - 61KB package, only depends on `jose`
- ✅ **Battle Tested** - 135 unit tests including security attack scenarios

## Installation

```bash
pnpm add @latch/core
# or
npm install @latch/core
# or
yarn add @latch/core
```

## Quick Start

### 1. Setup with CLI (Recommended)

```bash
npx @latch/cli init
```

The interactive wizard will:
- Prompt for Azure AD configuration (Client ID, Tenant ID, Cloud)
- Choose authentication mode (PKCE vs client_secret)
- Generate secure cookie secret
- Create `.env.local` with all required variables
- Provide tailored Azure AD app registration instructions

### 2. Manual Setup (Alternative)

Create `.env.local`:

```env
# Azure AD Configuration
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=commercial  # or gcc-high, dod

# Cookie Encryption (generate with: npx @latch/cli generate-secret)
LATCH_COOKIE_SECRET=your-base64-secret-here

# Optional: Confidential Client Mode
# LATCH_CLIENT_SECRET=your-client-secret

# Optional: Custom Configuration
# LATCH_SCOPES=openid profile User.Read
# LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
```

**Cloud Options:**
- `commercial` - Azure Commercial (`login.microsoftonline.com`)
- `gcc-high` - GCC-High IL4 (`login.microsoftonline.us`)
- `dod` - DoD IL5 (`login.microsoftonline.us` with DoD Graph)

### 3. Create API Routes

Create OAuth endpoints in your Next.js app. You can either copy the route handlers from the example app or implement them yourself.

See the [example-app](../../apps/example-app/app/api/latch) for complete reference implementations of:
- `GET /api/latch/start` - Initiates OAuth flow with PKCE
- `GET /api/latch/callback` - Handles OAuth callback
- `GET /api/latch/session` - Returns current user
- `POST /api/latch/refresh` - Refreshes access token
- `GET /api/latch/logout` - Clears session

All crypto utilities (PKCE generation, cookie sealing, state/nonce) are exported from `@latch/core`.

### 4. Add React Provider

Wrap your app in `app/layout.tsx`:

```tsx
import { LatchProvider } from '@latch/core/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LatchProvider>
          {children}
        </LatchProvider>
      </body>
    </html>
  );
}
```

### 5. Use Authentication in Components

```tsx
'use client';

import { useLatch } from '@latch/core/react';

export default function Dashboard() {
  const { user, signIn, signOut, isLoading } = useLatch();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return <button onClick={signIn}>Sign In</button>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>{user.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### 6. Protect Routes with Middleware

Create `middleware.ts`:

```tsx
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getLatchSession } from '@latch/core';

export async function middleware(request: NextRequest) {
  const session = await getLatchSession();

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
};
```

## Authentication Modes

### Secure Proxy Mode (Default)

Access tokens stay on the server. All Graph API calls proxied through Next.js routes.

```typescript
// app/api/me/route.ts
import { getAccessToken } from '@latch/core';

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Token never exposed to client
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  return Response.json(await res.json());
}
```

### Direct Token Mode (Advanced)

Short-lived access tokens sent to client with auto-refresh. Only use for performance-critical scenarios.

```typescript
'use client';

import { useAccessToken } from '@latch/core/react';

export default function Profile() {
  const { accessToken, error, expiresAt } = useAccessToken({
    autoRefresh: true,
    refreshThreshold: 300000, // 5 minutes
    retryOnFailure: true,
  });

  // Use accessToken directly from browser for Graph API calls
}
```

See [AUTHENTICATION_SETUP.md](../../docs/AUTHENTICATION_SETUP.md) for detailed comparison.

## Cloud Configuration

Latch automatically configures endpoints based on `LATCH_CLOUD`:

| Cloud | Login URL | Graph API |
|-------|-----------|-----------|
| `commercial` | `login.microsoftonline.com` | `graph.microsoft.com` |
| `gcc-high` | `login.microsoftonline.us` | `graph.microsoft.us` |
| `dod` | `login.microsoftonline.us` | `dod-graph.microsoft.us` |

No manual URL configuration needed - scopes are automatically validated against the selected cloud.

## Documentation

- [API Reference](../../docs/API_REFERENCE.md) - Complete API documentation
- [Authentication Setup](../../docs/AUTHENTICATION_SETUP.md) - PKCE vs client_secret modes
- [Troubleshooting](../../docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](../../ARCHITECTURE.md) - Technical implementation details
- [Security](../../SECURITY.md) - Threat model and security practices

## License

MIT - see [LICENSE](LICENSE) file for details

## Author

[lance0](https://github.com/lance0)

## Support

- [GitHub Issues](https://github.com/lance0/latch/issues)
- [Documentation](https://github.com/lance0/latch)
