# Latch

**Modern OIDC for Next.js and Secure Clouds**

Latch is a lightweight, security-minded authentication library for Next.js that implements OpenID Connect the right way — PKCE, refresh tokens, cookie sealing — and works in Azure Government clouds out of the box.

## Monorepo Structure

This repository uses pnpm workspaces and Turborepo:

```
latch/
├── packages/
│   ├── latch/          # @latch/core - Core authentication library
│   └── latch-cli/      # @latch/cli - CLI tools (init wizard, secret generator)
├── apps/
│   └── example-app/    # Example Next.js application
├── docs/               # Documentation
└── ROADMAP.md         # Development roadmap
```

## Features

- ✅ **PKCE S256** (no client secrets needed)
- ✅ **HttpOnly encrypted cookies** (AES-GCM)
- ✅ **Azure Government cloud support** (GCC-High, DoD)
- ✅ **Next.js 15 App Router** native
- ✅ **TypeScript-first** with full IntelliSense
- ✅ **Audit-friendly** and transparent
- ✅ **Two modes:** Secure Proxy (default) or Direct Token

## Quick Start (Using the Package)

### 1. Install dependencies

```bash
pnpm add @latch/core
# or
npm install @latch/core
```

### 2. Or Clone and Develop Locally

```bash
git clone https://github.com/lance0/latch.git
cd latch
pnpm install
pnpm build
```

### 2. Use CLI to Initialize (Recommended)

The fastest way to get started is with the CLI wizard:

```bash
npx @latch/cli init
```

This will:
- Prompt you for Azure AD credentials (Client ID, Tenant ID)
- Select your cloud environment (Commercial, GCC-High, DoD)
- Generate a secure cookie secret automatically
- Create a `.env.local` file with all configuration

**Or generate just a secret:**

```bash
npx @latch/cli generate-secret
```

See [@latch/cli documentation](./packages/latch-cli/README.md) for more details.

### 3. Or Configure Manually

Copy `.env.example` to `.env.local` and fill in your Azure AD configuration:

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

**Authentication modes:**

Latch supports two authentication modes:

- **Public Client (PKCE)** - No client secret needed. Omit `LATCH_CLIENT_SECRET` from `.env.local`. Use for SPA app registrations or when you prefer not to manage secrets.
- **Confidential Client** - Uses client secret. Add `LATCH_CLIENT_SECRET=your-secret` to `.env.local`. Use for Web app registrations (most common for Next.js).

Both modes are equally secure. See [Authentication Setup Guide](./docs/AUTHENTICATION_SETUP.md) for detailed comparison and Azure AD configuration steps.

### 4. Wrap your app with LatchProvider

```tsx
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

### 5. Use authentication in your components

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

### 6. Protect routes

**Option A: Component-level protection**

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

**Option B: Middleware protection**

Edit `middleware.ts` to add protected routes:

```typescript
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

## Authentication Modes

### Secure Proxy Mode (Default)

Access tokens **never reach the browser**. All API calls are proxied through Next.js API routes.

**Example: Calling Microsoft Graph**

```tsx
// app/api/me/route.ts
export async function GET(request: NextRequest) {
  const config = getLatchConfig();
  const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

  // Get refresh token, exchange for access token (server-side only)
  const refreshTokenCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
  const refreshTokenData = await unseal(refreshTokenCookie.value, config.cookieSecret);
  const tokens = await refreshAccessToken(...);

  // Call Graph API - token never exposed to client
  const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  return response.json();
}
```

### Direct Token Mode

Short-lived access token returned to client memory. Use for read-only operations or when proxy overhead is prohibitive.

```tsx
'use client';

import { useAccessToken } from '@/lib/latch';

export function UserProfile() {
  const { accessToken } = useAccessToken();

  const fetchProfile = async () => {
    const response = await fetch('https://graph.microsoft.us/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.json();
  };
}
```

**⚠️ Security Note:** Direct Token mode exposes access tokens to client JavaScript. Only use for non-sensitive operations.

## API Routes

Latch provides these authentication endpoints:

- `GET /api/latch/start` - Initiates PKCE flow
- `GET /api/latch/callback` - Handles OAuth callback
- `POST /api/latch/refresh` - Refreshes access token
- `GET /api/latch/logout` - Clears session and redirects to Azure AD logout
- `GET /api/latch/session` - Returns current user session

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

## Development

```bash
# Start development server
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build
```

## Documentation

### 📚 Guides

- **[Authentication Setup](./docs/AUTHENTICATION_SETUP.md)** - Choose your authentication mode
  - Public Client (PKCE) vs Confidential Client (client_secret)
  - Azure AD app registration setup for each mode
  - Complete configuration examples
  - Migration guide between modes
  - Troubleshooting common errors

- **[Authentication Modes](./docs/AUTHENTICATION_MODES.md)** - Complete comparison of Secure Proxy vs Direct Token modes
  - Security trade-offs
  - Performance comparison
  - When to use each mode
  - Migration guide
  - Hybrid approach

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation
  - All React hooks (`useLatch`, `useAccessToken`)
  - Components (`LatchProvider`, `LatchGuard`)
  - Configuration utilities
  - Error handling
  - Types reference

- **[Troubleshooting](./TROUBLESHOOTING.md)** - Solutions to common issues
  - Configuration errors
  - OAuth flow problems
  - Token issues
  - Cloud-specific problems
  - Debugging tips

### ⚙️ Configuration Templates

Cloud-specific `.env` templates with checklists:

- **[`.env.commercial`](./.env.commercial)** - Azure Commercial Cloud
- **[`.env.gcc-high`](./.env.gcc-high)** - Azure Government GCC-High (IL4)
- **[`.env.dod`](./.env.dod)** - Azure Government DoD (IL5, FIPS required)

### 🔐 Security & Architecture

- **[SECURITY.md](./SECURITY.md)** - Security policies and vulnerability reporting
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical implementation details

## License

Apache License 2.0 - see [LICENSE](./LICENSE)

## Contributing

Contributions welcome! Please read the security policies before submitting PRs involving authentication flows.

---

**Latch** — secure, minimal, open-source authentication for the clouds that can't afford mistakes.
