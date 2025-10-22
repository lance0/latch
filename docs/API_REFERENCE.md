# API Reference

Complete reference for all Latch APIs, hooks, and utilities.

## Table of Contents

- [React Hooks](#react-hooks)
  - [useLatch](#uselatch)
  - [useAccessToken](#useaccesstoken)
- [React Components](#react-components)
  - [LatchProvider](#latchprovider)
  - [LatchGuard](#latchguard)
- [Configuration](#configuration)
  - [getLatchConfig](#getlatchconfig)
  - [getAzureEndpoints](#getazureendpoints)
  - [validateLatchConfig](#validatelatchconfig)
- [Error Handling](#error-handling)
  - [LatchError](#latcherror)
  - [createLatchError](#createlatcherror)
  - [formatErrorForLog](#formaterrorforlog)
  - [getUserSafeErrorMessage](#getusersafeerrormessage)
- [API Routes](#api-routes)
- [Types](#types)

---

## React Hooks

### `useLatch`

Access authentication state and sign-in/out functions.

**Import:**
```typescript
import { useLatch } from '@/lib/latch';
```

**Signature:**
```typescript
function useLatch(): {
  user: LatchUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (returnTo?: string) => void;
  signOut: (returnTo?: string) => void;
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `user` | `LatchUser \| null` | Authenticated user info or null |
| `isAuthenticated` | `boolean` | Whether user is authenticated |
| `isLoading` | `boolean` | Whether session is being loaded |
| `signIn` | `function` | Start OAuth flow (redirects to Azure AD) |
| `signOut` | `function` | Sign out and clear session |

**Example:**

```typescript
'use client';

import { useLatch } from '@/lib/latch';

export default function NavBar() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useLatch();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <button onClick={() => signIn('/dashboard')}>Sign In</button>;
  }

  return (
    <div>
      <span>Welcome, {user?.name}</span>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

**Sign In with Custom Return URL:**

```typescript
// Redirect to /dashboard after sign-in
signIn('/dashboard');

// Redirect to current page (default)
signIn();
```

**Sign Out with Custom Return URL:**

```typescript
// Redirect to home after sign-out
signOut('/');

// Redirect to current page (default)
signOut();
```

---

### `useAccessToken`

Get access token for Direct Token mode with auto-refresh.

**Import:**
```typescript
import { useAccessToken } from '@/lib/latch';
```

**Signature:**
```typescript
function useAccessToken(options?: UseAccessTokenOptions): UseAccessTokenResult
```

**Options (UseAccessTokenOptions):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoRefresh` | `boolean` | `true` | Enable automatic token refresh |
| `refreshThreshold` | `number` | `300` | Seconds before expiry to refresh |
| `retryOnFailure` | `boolean` | `true` | Retry failed refreshes with backoff |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `pauseWhenHidden` | `boolean` | `true` | Pause refresh when tab hidden |

**Returns (UseAccessTokenResult):**

| Property | Type | Description |
|----------|------|-------------|
| `accessToken` | `string \| null` | Access token or null if not available |
| `isLoading` | `boolean` | Whether token is being fetched |
| `error` | `Error \| null` | Error if fetch failed |
| `expiresAt` | `number \| null` | Unix timestamp when token expires |
| `refresh` | `function` | Manually trigger refresh |

**Example (Default Options):**

```typescript
'use client';

import { useAccessToken, getAzureEndpoints } from '@/lib/latch';

export default function ProfilePage() {
  const { accessToken, isLoading, error } = useAccessToken();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!accessToken) return;

    const endpoints = getAzureEndpoints('commercial', 'tenant-id');

    fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(res => res.json())
      .then(setUser);
  }, [accessToken]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{user?.displayName}</div>;
}
```

**Example (Custom Options):**

```typescript
const { accessToken, expiresAt, refresh } = useAccessToken({
  autoRefresh: true,
  refreshThreshold: 600,     // Refresh 10 min before expiry
  retryOnFailure: true,
  maxRetries: 5,             // More retries
  pauseWhenHidden: false,    // Keep refreshing when hidden
});

// Check time until expiry
if (expiresAt) {
  const timeUntilExpiry = expiresAt - Date.now();
  console.log(`Token expires in ${timeUntilExpiry}ms`);
}

// Manual refresh
const handleRefresh = async () => {
  await refresh();
  console.log('Token refreshed');
};
```

**Example (Disable Auto-Refresh):**

```typescript
const { accessToken, refresh } = useAccessToken({
  autoRefresh: false,  // Manual control
});

// Refresh on button click
<button onClick={refresh}>Refresh Token</button>
```

---

## React Components

### `LatchProvider`

Root provider for Latch. Must wrap your app.

**Import:**
```typescript
import { LatchProvider } from '@/lib/latch';
```

**Props:** None

**Example:**

```typescript
// app/layout.tsx
import { LatchProvider } from '@/lib/latch';

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

**What it does:**
- Fetches session on mount from `/api/latch/session`
- Provides `useLatch()` context to children
- Manages loading and authentication state

---

### `LatchGuard`

Protect routes by redirecting unauthenticated users.

**Import:**
```typescript
import { LatchGuard } from '@/lib/latch';
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content to render when authenticated |
| `fallback` | `ReactNode` | `'Loading...'` | Content while checking auth |
| `redirectTo` | `string` | `'/'` | Where to redirect if not authenticated |

**Example (Basic):**

```typescript
// app/dashboard/page.tsx
import { LatchGuard } from '@/lib/latch';

export default function DashboardPage() {
  return (
    <LatchGuard>
      <h1>Protected Dashboard</h1>
      <p>Only authenticated users see this.</p>
    </LatchGuard>
  );
}
```

**Example (Custom Fallback):**

```typescript
<LatchGuard
  fallback={<div className="spinner">Checking authentication...</div>}
>
  <Dashboard />
</LatchGuard>
```

**Example (Custom Redirect):**

```typescript
<LatchGuard redirectTo="/login">
  <AdminPanel />
</LatchGuard>
```

---

## Configuration

### `getLatchConfig`

Load and validate Latch configuration from environment variables.

**Import:**
```typescript
import { getLatchConfig } from '@/lib/latch';
```

**Signature:**
```typescript
function getLatchConfig(): LatchConfig
```

**Returns:**

```typescript
interface LatchConfig {
  clientId: string;           // Azure AD Client ID (UUID)
  tenantId: string;           // Azure AD Tenant ID (UUID)
  cloud: LatchCloud;          // 'commercial' | 'gcc-high' | 'dod'
  scopes: string[];           // OAuth scopes
  redirectUri: string;        // OAuth callback URL
  cookieSecret: string;       // Cookie encryption secret
  debug: boolean;             // Debug mode enabled
}
```

**Example:**

```typescript
// app/api/latch/start/route.ts
import { getLatchConfig } from '@/lib/latch';

export async function GET() {
  const config = getLatchConfig();

  console.log(config.cloud);        // 'commercial'
  console.log(config.clientId);     // '00000000-...'
  console.log(config.scopes);       // ['openid', 'profile', 'User.Read']

  // ...
}
```

**Throws:**
- `LatchError` with detailed message if any required env var is missing or invalid

---

### `getAzureEndpoints`

Get Azure AD and Graph API endpoints for a cloud environment.

**Import:**
```typescript
import { getAzureEndpoints } from '@/lib/latch';
```

**Signature:**
```typescript
function getAzureEndpoints(cloud: LatchCloud, tenantId: string): AzureEndpoints
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cloud` | `'commercial' \| 'gcc-high' \| 'dod'` | Cloud environment |
| `tenantId` | `string` | Azure AD Tenant ID |

**Returns:**

```typescript
interface AzureEndpoints {
  loginBaseUrl: string;    // e.g., 'https://login.microsoftonline.com'
  graphBaseUrl: string;    // e.g., 'https://graph.microsoft.com'
  authorizeUrl: string;    // Full OAuth authorize URL
  tokenUrl: string;        // Full OAuth token URL
  logoutUrl: string;       // Full OAuth logout URL
  jwksUri: string;         // JWKS keys URL
}
```

**Example:**

```typescript
import { getAzureEndpoints } from '@/lib/latch';

const endpoints = getAzureEndpoints('commercial', 'tenant-id');

console.log(endpoints.graphBaseUrl);
// → 'https://graph.microsoft.com'

// Use in fetch calls
const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

**Cloud-Specific Endpoints:**

| Cloud | Login URL | Graph URL |
|-------|-----------|-----------|
| `commercial` | `login.microsoftonline.com` | `graph.microsoft.com` |
| `gcc-high` | `login.microsoftonline.us` | `graph.microsoft.us` |
| `dod` | `login.microsoftonline.us` | `dod-graph.microsoft.us` |

---

### `validateLatchConfig`

Validate configuration before using it (useful for startup checks).

**Import:**
```typescript
import { validateLatchConfig } from '@/lib/latch';
```

**Signature:**
```typescript
function validateLatchConfig(config: {
  clientId?: string;
  tenantId?: string;
  cloud?: string;
  cookieSecret?: string;
  scopes?: string[];
}): void
```

**Example:**

```typescript
// lib/startup-check.ts
import { validateLatchConfig } from '@/lib/latch';

try {
  validateLatchConfig({
    clientId: process.env.LATCH_CLIENT_ID,
    tenantId: process.env.LATCH_TENANT_ID,
    cloud: process.env.LATCH_CLOUD,
    cookieSecret: process.env.LATCH_COOKIE_SECRET,
  });
  console.log('✅ Configuration valid');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}
```

**Validation Checks:**
- Client ID and Tenant ID are valid UUIDs
- Cloud is one of: `commercial`, `gcc-high`, `dod`
- Cookie secret is at least 32 characters
- Warns about weak secrets in production

**Throws:**
- `LatchError` with detailed suggestions if validation fails

---

## Error Handling

### `LatchError`

Custom error class for all Latch errors.

**Import:**
```typescript
import { LatchError } from '@/lib/latch';
```

**Signature:**
```typescript
class LatchError extends Error {
  constructor(
    public code: LatchErrorCode,
    message: string,
    public details?: unknown
  )
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `LatchErrorCode` | Typed error code (see Types) |
| `message` | `string` | Human-readable error message |
| `details` | `unknown` | Optional additional context |
| `name` | `'LatchError'` | Error name |

**Example:**

```typescript
import { LatchError } from '@/lib/latch';

try {
  // Some Latch operation
} catch (error) {
  if (error instanceof LatchError) {
    console.error(`Error [${error.code}]: ${error.message}`);

    if (error.code === 'LATCH_REFRESH_TOKEN_MISSING') {
      // Redirect to sign in
      window.location.href = '/api/latch/start';
    }
  }
}
```

---

### `createLatchError`

Create enhanced LatchError with actionable suggestions.

**Import:**
```typescript
import { createLatchError } from '@/lib/latch';
```

**Signature:**
```typescript
function createLatchError(
  code: LatchErrorCode,
  customMessage?: string,
  details?: unknown
): LatchError
```

**Example:**

```typescript
import { createLatchError } from '@/lib/latch';

// Use built-in suggestions
throw createLatchError('LATCH_CLIENT_ID_MISSING');

// Or provide custom message
throw createLatchError(
  'LATCH_TOKEN_EXCHANGE_FAILED',
  'Custom context: Azure AD returned 401',
  { statusCode: 401 }
);
```

**Enhanced Messages Include:**
- Step-by-step solutions
- Example configurations
- Links to documentation
- "Did you mean?" suggestions

---

### `formatErrorForLog`

Format error for logging (sanitized, no tokens).

**Import:**
```typescript
import { formatErrorForLog } from '@/lib/latch';
```

**Signature:**
```typescript
function formatErrorForLog(error: unknown): string
```

**Example:**

```typescript
import { formatErrorForLog } from '@/lib/latch';

try {
  await refreshToken();
} catch (error) {
  console.error(formatErrorForLog(error));
  // → "[LATCH_TOKEN_REFRESH_FAILED] Token refresh failed..."
}
```

---

### `getUserSafeErrorMessage`

Get user-facing error message (no sensitive data).

**Import:**
```typescript
import { getUserSafeErrorMessage } from '@/lib/latch';
```

**Signature:**
```typescript
function getUserSafeErrorMessage(error: unknown): string
```

**Example:**

```typescript
import { getUserSafeErrorMessage } from '@/lib/latch';

try {
  await signIn();
} catch (error) {
  // Show to user
  alert(getUserSafeErrorMessage(error));
  // → "Authentication error" (safe, generic)

  // Log full error internally
  console.error(error);
}
```

---

## API Routes

Latch provides these API routes automatically:

### `GET /api/latch/start`

Start OAuth flow (redirects to Azure AD).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `returnTo` | `string` | URL to redirect after sign-in (optional) |

**Example:**

```html
<a href="/api/latch/start?returnTo=/dashboard">Sign In</a>
```

**What it does:**
1. Generates PKCE code verifier and challenge
2. Generates random state and nonce
3. Stores PKCE data in encrypted cookie (10 min expiry)
4. Redirects to Azure AD authorize endpoint

---

### `GET /api/latch/callback`

OAuth callback handler (redirects after Azure AD).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `string` | Authorization code from Azure AD |
| `state` | `string` | State parameter (CSRF protection) |

**What it does:**
1. Validates state parameter (CSRF check)
2. Exchanges code for tokens using PKCE
3. Verifies ID token with JWKS
4. Stores encrypted refresh token in cookie (7 days)
5. Stores encrypted ID token claims in cookie (7 days)
6. Redirects to `returnTo` URL

---

### `POST /api/latch/refresh`

Refresh access token (for Direct Token mode).

**Returns:**

```json
{
  "access_token": "eyJ0eXAiOi...",
  "expires_in": 3599
}
```

**Example:**

```typescript
const response = await fetch('/api/latch/refresh', { method: 'POST' });
const { access_token, expires_in } = await response.json();
```

---

### `GET /api/latch/logout`

Sign out and clear session.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `returnTo` | `string` | URL to redirect after logout (optional) |

**Example:**

```html
<a href="/api/latch/logout?returnTo=/">Sign Out</a>
```

**What it does:**
1. Clears all Latch cookies
2. Redirects to Azure AD logout
3. Azure AD redirects back to `returnTo` URL

---

### `GET /api/latch/session`

Get current user session.

**Returns:**

```json
{
  "user": {
    "sub": "00000000-0000-0000-0000-000000000000",
    "email": "user@example.com",
    "name": "John Doe",
    "preferred_username": "john.doe@example.com",
    "iat": 1234567890,
    "exp": 1234571490
  },
  "isAuthenticated": true
}
```

**Or when not authenticated:**

```json
{
  "user": null,
  "isAuthenticated": false
}
```

**Example:**

```typescript
const response = await fetch('/api/latch/session');
const { user, isAuthenticated } = await response.json();

if (isAuthenticated) {
  console.log(`Logged in as ${user.email}`);
}
```

---

## Types

### `LatchCloud`

```typescript
type LatchCloud = 'commercial' | 'gcc-high' | 'dod';
```

### `LatchUser`

```typescript
interface LatchUser {
  sub: string;                    // User's object ID
  email?: string;                 // User's email
  name?: string;                  // User's display name
  preferred_username?: string;    // User's UPN
  iat: number;                    // Token issued at (Unix timestamp)
  exp: number;                    // Token expires at (Unix timestamp)
}
```

### `LatchErrorCode`

```typescript
type LatchErrorCode =
  | 'LATCH_CONFIG_MISSING'
  | 'LATCH_CLIENT_ID_MISSING'
  | 'LATCH_TENANT_ID_MISSING'
  | 'LATCH_CLOUD_INVALID'
  | 'LATCH_CLOUD_MISMATCH'
  | 'LATCH_COOKIE_SECRET_MISSING'
  | 'LATCH_PKCE_MISSING'
  | 'LATCH_STATE_MISSING'
  | 'LATCH_STATE_MISMATCH'
  | 'LATCH_NONCE_MISSING'
  | 'LATCH_NONCE_MISMATCH'
  | 'LATCH_CODE_MISSING'
  | 'LATCH_TOKEN_EXCHANGE_FAILED'
  | 'LATCH_TOKEN_REFRESH_FAILED'
  | 'LATCH_INVALID_RETURN_URL'
  | 'LATCH_ID_TOKEN_INVALID'
  | 'LATCH_REFRESH_TOKEN_MISSING'
  | 'LATCH_ENCRYPTION_FAILED'
  | 'LATCH_DECRYPTION_FAILED';
```

### `LatchSession`

```typescript
interface LatchSession {
  user: LatchUser | null;
  isAuthenticated: boolean;
}
```

### `UseAccessTokenOptions`

```typescript
interface UseAccessTokenOptions {
  autoRefresh?: boolean;        // Default: true
  refreshThreshold?: number;    // Default: 300 (seconds)
  retryOnFailure?: boolean;     // Default: true
  maxRetries?: number;          // Default: 3
  pauseWhenHidden?: boolean;    // Default: true
}
```

### `UseAccessTokenResult`

```typescript
interface UseAccessTokenResult {
  accessToken: string | null;
  isLoading: boolean;
  error: Error | null;
  expiresAt: number | null;
  refresh: () => Promise<void>;
}
```

---

## Environment Variables

### Required

```bash
LATCH_CLIENT_ID=00000000-0000-0000-0000-000000000000
LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111
LATCH_CLOUD=commercial
LATCH_COOKIE_SECRET=<32+ characters>
```

### Optional

```bash
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_DEBUG=true
```

### For Direct Token Mode (Client-Side)

```bash
NEXT_PUBLIC_LATCH_CLOUD=commercial
NEXT_PUBLIC_LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111
```

---

## Need Help?

- **Troubleshooting:** See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Authentication Modes:** See [AUTHENTICATION_MODES.md](./AUTHENTICATION_MODES.md)
- **Security:** See [SECURITY.md](../SECURITY.md)
- **Architecture:** See [ARCHITECTURE.md](../ARCHITECTURE.md)
