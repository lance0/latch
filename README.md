# Latch

**Modern OIDC for Next.js and Secure Clouds**

Latch is a lightweight, security-minded authentication library for Next.js that implements OpenID Connect the right way — PKCE, refresh tokens, cookie sealing — and works in Azure Government clouds out of the box.

## Monorepo Structure

This repository uses pnpm workspaces and Turborepo:

```
latch/
├── packages/
│   ├── latch/          # @lance0/latch - Core authentication library
│   └── latch-cli/      # @lance0/latch-cli - CLI tools (init wizard, secret generator)
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
- ✅ **Server Actions** support with `getServerSession()` and `requireAuth()`
- ✅ **Token confusion attack prevention** - Strict issuer/tenant validation
- ✅ **TypeScript-first** with full IntelliSense
- ✅ **Audit-friendly** and transparent
- ✅ **Configurable security** - Clock skew, JWKS cache TTL
- ✅ **Two modes:** Secure Proxy (default) or Direct Token

## Quick Start (Using the Package)

### 1. Install dependencies

```bash
pnpm add @lance0/latch
# or
npm install @lance0/latch
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
npx @lance0/latch-cli init
```

This will:
- Prompt you for Azure AD credentials (Client ID, Tenant ID)
- Select your cloud environment (Commercial, GCC-High, DoD)
- Generate a secure cookie secret automatically
- Create a `.env.local` file with all configuration

**Or generate just a secret:**

```bash
npx @lance0/latch-cli generate-secret
```

See [@lance0/latch-cli documentation](./packages/latch-cli/README.md) for more details.

### 3. Or Configure Manually

Copy `.env.example` to `.env.local` and fill in your Azure AD configuration:

```env
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile User.Read

# Optional security settings
LATCH_CLOCK_SKEW_TOLERANCE=60    # seconds, default: 60
LATCH_JWKS_CACHE_TTL=3600         # seconds, default: 3600
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

### 4. Create API routes

Latch requires five API routes for authentication. Copy these from the example app:

```
app/api/latch/
├── start/route.ts       # Initiates OAuth flow
├── callback/route.ts    # Handles OAuth callback
├── session/route.ts     # Returns current user
├── refresh/route.ts     # Refreshes access token
└── logout/route.ts      # Clears session
```

**Quick setup:**
```bash
# Copy routes from example app
cp -r node_modules/@lance0/latch/../../apps/example-app/app/api/latch app/api/
```

Or see the [example app](./apps/example-app/app/api/latch/) for reference implementations.

**What each route does:**
- `start` - Generates PKCE challenge and redirects to Azure AD
- `callback` - Exchanges authorization code for tokens, sets cookies
- `session` - Returns user object from cookie (checks if authenticated)
- `refresh` - Gets fresh access token using refresh token
- `logout` - Clears cookies and signs out of Azure AD (SSO logout)

### 5. Wrap your app with LatchProvider

```tsx
import { LatchProvider } from '@lance0/latch/react';

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

### 6. Use authentication in your components

```tsx
'use client';

import { useLatch } from '@lance0/latch/react';

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

### 7. Protect routes

**Option A: Component-level protection**

```tsx
import { LatchGuard } from '@lance0/latch/react';

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

## Cookie Storage Pattern

Latch uses **three separate cookies** to store authentication data while staying under browser limits:

| Cookie | Contents | Size | Duration |
|--------|----------|------|----------|
| `latch_id` | Decoded user object (email, name, sub) | ~300 bytes | 7 days |
| `latch_rt` | Refresh token + expiry timestamp | ~2700 bytes | 7 days |
| `latch_pkce` | PKCE flow data (temporary) | ~250 bytes | 10 minutes |

**Why three cookies?** Browsers have a 4KB (4096 bytes) limit per cookie. Azure AD tokens are large (~1500-2000 bytes each), so storing everything in one cookie would exceed the limit and fail silently.

**⚠️ Common Mistake:**
```typescript
// ❌ WRONG: Everything in one cookie (exceeds 4KB!)
const sessionData = await seal({ user, accessToken, refreshToken }, secret);
response.cookies.set(COOKIE_NAMES.ID_TOKEN, sessionData, COOKIE_OPTIONS);

// ✅ CORRECT: Separate cookies (as shown in example app)
const sealedUser = await seal(user, config.cookieSecret);
response.cookies.set(COOKIE_NAMES.ID_TOKEN, sealedUser, COOKIE_OPTIONS);

const sealedRT = await seal({ refreshToken, expiresAt }, config.cookieSecret);
response.cookies.set(COOKIE_NAMES.REFRESH_TOKEN, sealedRT, COOKIE_OPTIONS);
```

**Automatic Size Validation:** Latch's `seal()` function warns at 3.5KB and errors at 4KB with helpful guidance. See the detailed JSDoc on `COOKIE_NAMES` for more information.

## Server Actions (Next.js 15+)

Latch provides helpers for using authentication with Next.js Server Actions:

```typescript
// app/actions/profile.ts
'use server';

import { requireAuth } from '@lance0/latch';

export async function getProfile() {
  const user = await requireAuth(process.env.LATCH_COOKIE_SECRET!);
  return { name: user.name, email: user.email };
}
```

**Available helpers:**
- `getServerSession(cookieSecret)` - Get current session (handles unauthenticated)
- `requireAuth(cookieSecret)` - Require authentication (throws if not authenticated)

**See the full guide:** [Server Actions Documentation](./docs/SERVER_ACTIONS.md)

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
