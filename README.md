# Latch

**Modern OIDC for Next.js and Secure Clouds**

Latch is a lightweight, security-minded authentication library for Next.js that implements OpenID Connect the right way — PKCE, refresh tokens, cookie sealing — and works in Azure Government clouds out of the box.

## Monorepo Structure

This repository uses pnpm workspaces and Turborepo:

```
latch/
├── packages/
│   ├── latch/               # @lance0/latch - Core authentication library
│   └── latch-cli/           # @lance0/latch-cli - CLI tools
├── apps/
│   ├── example-app/         # Generic example (configurable)
│   ├── example-commercial/  # Azure Commercial preset
│   └── example-gcc-high/    # Azure Government (GCC-High) preset
├── docs/                    # Documentation
└── ROADMAP.md              # Development roadmap
```

## Features

- ✅ **PKCE S256** (no client secrets needed)
- ✅ **HttpOnly encrypted cookies** (AES-GCM with PBKDF2 key caching)
- ✅ **Azure Government cloud support** (GCC-High, DoD)
- ✅ **Next.js 15+ App Router** native
- ✅ **Server Actions** support with `getServerSession()`, `requireAuth()`, and more
- ✅ **Automatic token refresh** - Sessions last 7 days without interruption
- ✅ **Enhanced CLI** - Scaffold proxy.ts, auth wrappers, and routes
- ✅ **Token confusion attack prevention** - Strict issuer/tenant validation
- ✅ **TypeScript-first** with full IntelliSense and type guards
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

# Cookie secret - choose ONE method:
LATCH_COOKIE_SECRET=$(openssl rand -base64 32)              # ✅ Most systems
# LATCH_COOKIE_SECRET=$(npx @lance0/latch-cli generate-secret)  # ✅ Cross-platform
```

**⚠️ Cookie Secret Generation:**
```bash
# Method 1: OpenSSL (Linux/Mac/WSL)
echo "LATCH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env.local

# Method 2: CLI tool (Cross-platform)
npx @lance0/latch-cli generate-secret >> .env.local

# Method 3: Manual (if above fail)
# Generate a 32+ character random string and paste it
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

### 6. Create app-specific auth helpers (Recommended Pattern)

**Don't use Latch helpers directly in every route.** Instead, create a wrapper with your application logic:

```typescript
// lib/auth.ts - Your application's auth helpers
import { getServerSession } from '@lance0/latch';
import { cache } from 'react';

/**
 * Get current user with app-specific logic
 * Cached per-request to avoid duplicate operations
 */
export const getCurrentUser = cache(async () => {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);

  if (!session.isAuthenticated || !session.user) {
    return null;
  }

  // Your app logic: database sync, roles, permissions, etc.
  const user = await db.user.upsert({
    where: { azureId: session.user.sub },
    create: {
      azureId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
    },
    update: {
      email: session.user.email,
      name: session.user.name,
    },
  });

  return user;
});

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}
```

**Why wrap Latch helpers?**
- ✅ Centralized authentication logic
- ✅ Database user sync in one place (JIT provisioning)
- ✅ Request-level caching with React `cache()`
- ✅ App-specific fields (roles, permissions, etc.)
- ✅ Easier to test and maintain

**Generate with CLI:**
```bash
npx @lance0/latch-cli scaffold --type wrapper
```

### 7. Use authentication in your components

```tsx
'use client';

import { useLatch } from '@lance0/latch/react';

export default function Home() {
  const { user, isAuthenticated, signIn, signOut } = useLatch();

  if (!isAuthenticated) {
    return (
      <div>
        {/* ⚠️ IMPORTANT: Use <a> tag, NOT Next.js <Link> for auth endpoints */}
        {/* <Link> causes CORS issues with /api/latch/start */}
        <a href="/api/latch/start">Sign In</a>
        {/* OR use the signIn() function: */}
        <button onClick={() => signIn()}>Sign In with Button</button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### 8. Use your wrapper in Server Actions and API routes

```typescript
// In API routes
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... your logic with database user object
}

// In Server Actions
import { requireAuth } from '@/lib/auth';

export async function updateProfile(data: FormData) {
  const user = await requireAuth(); // Throws if not authenticated
  // ... your logic
}
```

### 9. Explore example applications

Check out the pre-configured examples for your cloud:

- **[example-commercial](./apps/example-commercial/)** - Azure Commercial Cloud
- **[example-gcc-high](./apps/example-gcc-high/)** - Azure Government (GCC-High)
- **[example-app](./apps/example-app/)** - Generic (configurable)

See [apps/README.md](./apps/README.md) for detailed comparison.

## TypeScript Support

Latch is TypeScript-first with full IntelliSense support.

### Key Type Exports

```typescript
import type { 
  LatchSession,    // Session object from getServerSession()
  LatchUser,       // User data from Azure AD ID token
  LatchConfig,     // Configuration object
} from '@lance0/latch';

// Client-side hook
import { useLatch } from '@lance0/latch/react';
```

### Understanding Session Structure

```typescript
// ✅ LatchSession - What getServerSession() returns
interface LatchSession {
  isAuthenticated: boolean;      // Whether user is logged in
  user: LatchUser | null;        // User data (null if not authenticated)
}

// ✅ LatchUser - Actual user data from Azure AD
interface LatchUser {
  sub: string;                   // Unique user ID (Azure AD object ID)
  email?: string;                // User's email
  name?: string;                 // Display name
  preferred_username?: string;   // Usually same as email
  // ... other Azure AD claims
}
```

**Common TypeScript patterns:**

```typescript
// ❌ Wrong - properties are on session.user, not session directly
const session = await getServerSession(secret);
if (session.isAuthenticated) {
  console.log(session.email);  // undefined!
}

// ✅ Correct - access user data through session.user
const session = await getServerSession(secret);
if (session.isAuthenticated && session.user) {
  console.log(session.user.email);  // ✓ Works
}

// ✅ Even better - use type guard or requireServerSession
import { isLatchSession, requireServerSession } from '@lance0/latch';

// Option 1: Type guard
if (isLatchSession(session)) {
  // TypeScript knows session.user exists
  console.log(session.user.email);
}

// Option 2: Require helper
const session = await requireServerSession(secret); // Throws if not authenticated
console.log(session.user.email); // TypeScript knows user exists
```

### 10. Protect routes

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
- `requireServerSession(cookieSecret)` - Get session or throw (TypeScript-friendly, guarantees user exists)
- `isLatchSession(session)` - Type guard for session validation
- `checkLatchHealth()` - Validate Latch configuration (for health checks)

**See the full guide:** [Server Actions Documentation](./docs/SERVER_ACTIONS.md) and [API Reference](./docs/API_REFERENCE.md)

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

## Common DX Issues

### "Cannot find useLatch hook"
```typescript
// ❌ Wrong import
import { useLatch } from '@lance0/latch';

// ✅ Correct import
import { useLatch } from '@lance0/latch/react';
```

### "Session properties are undefined"
```typescript
// ❌ Wrong - properties are on session.user
const session = await getServerSession(secret);
console.log(session.email); // undefined

// ✅ Correct
console.log(session.user?.email);
```

### "Link component doesn't work for sign in"
```tsx
// ❌ Wrong - causes CORS issues
import Link from 'next/link';
<Link href="/api/latch/start">Sign In</Link>

// ✅ Correct - use regular anchor tag
<a href="/api/latch/start">Sign In</a>
// OR use the signIn() function from useLatch()
```

### "Cookie secret generation fails"
```bash
# If openssl fails, use the CLI:
npx @lance0/latch-cli generate-secret

# Or manually generate a 32+ character string
```

### "Can't find TypeScript types"
All types are exported from the main package:
```typescript
import type { LatchSession, LatchUser } from '@lance0/latch';
```

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for more issues.

## Migrating to Latch

Coming from another authentication library? We've got you covered:

- **[Migrating from NextAuth.js](./docs/MIGRATION_FROM_NEXTAUTH.md)** - Step-by-step guide with code comparisons
- **[Migrating from MSAL](./docs/MIGRATION_FROM_MSAL.md)** - Move from MSAL Browser/React to Latch

### Quick Comparison

| Feature | Latch | NextAuth.js | MSAL |
|---------|-------|-------------|------|
| **Best For** | Azure AD + Next.js | Multi-provider auth | Browser/SPA apps |
| **Azure Government** | ✅ Built-in | ⚠️ Custom provider | ⚠️ Manual config |
| **Token Storage** | HttpOnly cookies | Database or JWT | LocalStorage |
| **PKCE** | ✅ Always | ✅ Optional | ⚠️ Manual config |
| **Server Actions** | ✅ Native | ⚠️ Workarounds | ❌ Client-only |
| **Setup Complexity** | Low | Medium-High | High |
| **Security** | ✅ Server-side tokens | ⚠️ Depends on config | ⚠️ Client-side tokens |
| **Next.js Integration** | ✅ Native | ✅ Good | ⚠️ Additional setup |
| **Multiple Providers** | ❌ Azure AD only | ✅ 50+ providers | ❌ Microsoft only |

**Choose Latch when:**
- Using Azure AD exclusively
- Need government cloud support
- Want server-side token security
- Building Next.js App Router apps

**Choose NextAuth.js when:**
- Need multiple OAuth providers
- Require database sessions
- Using Pages Router

**Choose MSAL when:**
- Building pure client-side SPA
- Need B2C or advanced scenarios
- Not using Next.js

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

### 🔄 Migration Guides

- **[Migrating from NextAuth.js](./docs/MIGRATION_FROM_NEXTAUTH.md)** - Complete migration guide
  - Why migrate and when to stay
  - Step-by-step migration process
  - Side-by-side code comparisons
  - Feature mapping tables
  - Troubleshooting migration issues

- **[Migrating from MSAL](./docs/MIGRATION_FROM_MSAL.md)** - MSAL Browser/React to Latch
  - Security improvements over MSAL
  - Simplified configuration
  - Token handling differences
  - Quick reference API mapping
  - Complete code examples

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
