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
- [On-Behalf-Of (OBO) Flow](#on-behalf-of-obo-flow)
  - [Core Functions](#core-functions)
    - [exchangeTokenOnBehalfOf](#exchangetokenonbehalfof)
  - [Helper Functions](#helper-functions)
    - [oboTokenForGraph](#obotokenforgraph)
    - [oboTokenForApi](#obotokenforapi)
    - [oboTokenForFunction](#obotokenforfunction)
  - [Token Validation](#token-validation)
    - [validateAccessToken](#validateaccesstoken)
    - [extractBearerToken](#extractbearertoken)
    - [isTokenExpiringSoon](#istokenexpiringsoon)
  - [CAE Helpers](#cae-continuous-access-evaluation-helpers)
    - [parseCAEChallenge](#parsecaechallenge)
    - [buildCAEChallengeHeader](#buildcaechallengeheader)
    - [isCAEError](#iscaeerror)
    - [extractClaimsFromError](#extractclaimsfromerror)
    - [withCAERetry](#withcaeretry)
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

## On-Behalf-Of (OBO) Flow

> **⚠️ Status: Beta (v0.3.0+)** - OBO functionality is production-ready but considered opt-in until core PKCE flow is GA. Import from `@lance0/latch/obo` for a lean, tree-shakeable bundle.

For a complete guide on OBO scenarios, see [ON_BEHALF_OF_FLOW.md](./ON_BEHALF_OF_FLOW.md).

**Recommended Import:**
```typescript
// Opt-in subpath export (tree-shakeable)
import { oboTokenForGraph, parseCAEChallenge } from '@lance0/latch/obo';

// Also available from main export (for backwards compatibility)
import { oboTokenForGraph } from '@lance0/latch';
```

### Core Functions

#### `exchangeTokenOnBehalfOf`

Exchange an incoming access token for a new token scoped to a different resource (middle-tier scenario).

**Import:**
```typescript
import { exchangeTokenOnBehalfOf } from '@lance0/latch';
```

**Signature:**
```typescript
function exchangeTokenOnBehalfOf(
  request: OBOTokenRequest
): Promise<OBOTokenResponse>
```

**Parameters (OBOTokenRequest):**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `userAssertion` | `string` | Yes | Incoming access token from client |
| `clientId` | `string` | Yes | Your API's client ID |
| `tenantId` | `string` | Yes | Azure AD tenant ID |
| `cloud` | `LatchCloud` | Yes | Cloud environment |
| `clientAuth` | `object` | Yes | Client secret or certificate |
| `scopes` | `string[]` | Yes | Scopes for downstream resource |
| `claims` | `string` | No | CAE claims challenge (if retrying) |
| `allowedAudiences` | `string[]` | No | Additional valid audiences |
| `requiredAzp` | `string` | No | Required authorized party (azp) |
| `cacheOptions` | `TokenCacheOptions` | No | Cache configuration override |

**Returns (OBOTokenResponse):**

```typescript
interface OBOTokenResponse {
  access_token: string;      // Token for downstream resource
  token_type: 'Bearer';
  expires_in: number;        // Seconds until expiry
  expires_at?: number;       // Unix timestamp
  scope: string;             // Granted scopes
  refresh_token?: string;    // Not typically returned for OBO
}
```

**Example (Client Secret):**

```typescript
import { exchangeTokenOnBehalfOf } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '');

  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion: bearerToken,
    clientId: process.env.LATCH_CLIENT_ID!,
    tenantId: process.env.LATCH_TENANT_ID!,
    cloud: 'gcc-high',
    clientAuth: {
      clientSecret: process.env.LATCH_CLIENT_SECRET,
    },
    scopes: ['api://downstream/.default'],
  });

  // Use oboResponse.access_token to call downstream API
  const downstreamResponse = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${oboResponse.access_token}` }
  });
}
```

**Example (Certificate - IL4/IL5):**

```typescript
import { exchangeTokenOnBehalfOf } from '@lance0/latch';

const oboResponse = await exchangeTokenOnBehalfOf({
  userAssertion: bearerToken,
  clientId: process.env.LATCH_CLIENT_ID!,
  tenantId: process.env.LATCH_TENANT_ID!,
  cloud: 'dod',
  clientAuth: {
    certificate: {
      privateKey: process.env.LATCH_CERTIFICATE_PRIVATE_KEY!,
      thumbprint: process.env.LATCH_CERTIFICATE_THUMBPRINT!,
      x5c: process.env.LATCH_CERTIFICATE_X5C, // Optional
    },
  },
  scopes: ['https://dod-graph.microsoft.us/.default'],
});
```

**Example (With CAE Claims):**

```typescript
try {
  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion: bearerToken,
    // ... other params
    claims: 'eyJhY2Nlc3NfdG9rZW4iOnsibmJmIjp7ImVzc2VudGlhbCI6dHJ1ZSwidmFsdWUiOiIxNzI...',
  });
} catch (error) {
  if (error.code === 'LATCH_OBO_CAE_REQUIRED') {
    // Return claims challenge to client
    return NextResponse.json(
      { error: 'claims_required', claims: error.details?.claims },
      { status: 401 }
    );
  }
}
```

**Throws:**
- `LATCH_OBO_INVALID_ASSERTION` - Token validation failed
- `LATCH_OBO_AUDIENCE_MISMATCH` - Token not for this API
- `LATCH_OBO_ISSUER_MISMATCH` - Token from wrong cloud/tenant
- `LATCH_OBO_EXCHANGE_FAILED` - Azure AD token exchange failed
- `LATCH_OBO_CAE_REQUIRED` - Claims challenge required
- `LATCH_OBO_MISSING_CLIENT_AUTH` - No client secret or certificate
- `LATCH_OBO_CERT_INVALID` - Certificate malformed

---

### Helper Functions

#### `oboTokenForGraph`

Convenience wrapper for calling Microsoft Graph API via OBO.

**Import:**
```typescript
import { oboTokenForGraph } from '@lance0/latch';
```

**Signature:**
```typescript
function oboTokenForGraph(
  request: NextRequest,
  options?: {
    scopes?: string[];
    claims?: string;
  }
): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `NextRequest` | Next.js request with Authorization header |
| `options.scopes` | `string[]` | Graph scopes (default: ['.default']) |
| `options.claims` | `string` | CAE claims challenge |

**Returns:** Access token string for Microsoft Graph

**Example:**

```typescript
import { oboTokenForGraph, getAzureEndpoints, getLatchConfig } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const config = getLatchConfig();
  const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

  // Get token for Graph with specific scopes
  const graphToken = await oboTokenForGraph(request, {
    scopes: ['User.Read', 'Mail.Read'],
  });

  // Call Microsoft Graph
  const graphResponse = await fetch(`${endpoints.graphBaseUrl}/v1.0/me/messages`, {
    headers: { Authorization: `Bearer ${graphToken}` }
  });

  return NextResponse.json(await graphResponse.json());
}
```

**Sovereign Cloud Support:**

Automatically uses correct Graph endpoint:
- Commercial: `https://graph.microsoft.com`
- GCC-High: `https://graph.microsoft.us`
- DoD: `https://dod-graph.microsoft.us`

---

#### `oboTokenForApi`

Get OBO token for a custom downstream API.

**Import:**
```typescript
import { oboTokenForApi } from '@lance0/latch';
```

**Signature:**
```typescript
function oboTokenForApi(
  request: NextRequest,
  options: {
    audience: string;
    scopes?: string[];
    claims?: string;
  }
): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `NextRequest` | Next.js request with Authorization header |
| `options.audience` | `string` | Downstream API's App ID URI or client ID |
| `options.scopes` | `string[]` | Scopes (default: ['audience/.default']) |
| `options.claims` | `string` | CAE claims challenge |

**Returns:** Access token string for downstream API

**Example:**

```typescript
import { oboTokenForApi } from '@lance0/latch';

export async function GET(request: NextRequest) {
  // Get token for downstream API
  const downstreamToken = await oboTokenForApi(request, {
    audience: 'api://my-downstream-api',
    scopes: ['api://my-downstream-api/.default'],
  });

  // Call downstream API
  const downstreamResponse = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${downstreamToken}` }
  });

  return NextResponse.json(await downstreamResponse.json());
}
```

**Azure AD Setup:**

1. Go to your API's App Registration → API permissions
2. Add permission → My APIs → Select downstream API
3. Choose delegated permissions
4. Grant admin consent

---

#### `oboTokenForFunction`

Get OBO token for an Azure Function with Easy Auth.

**Import:**
```typescript
import { oboTokenForFunction } from '@lance0/latch';
```

**Signature:**
```typescript
function oboTokenForFunction(
  request: NextRequest,
  options: {
    functionAppId: string;
    scopes?: string[];
    claims?: string;
  }
): Promise<string>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `NextRequest` | Next.js request with Authorization header |
| `options.functionAppId` | `string` | Function app's client ID or App ID URI |
| `options.scopes` | `string[]` | Scopes (default: ['functionAppId/.default']) |
| `options.claims` | `string` | CAE claims challenge |

**Returns:** Access token string for Azure Function

**Example:**

```typescript
import { oboTokenForFunction } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const functionToken = await oboTokenForFunction(request, {
    functionAppId: 'api://my-function-app',
  });

  const functionResponse = await fetch('https://my-func.azurewebsites.us/api/data', {
    headers: {
      Authorization: `Bearer ${functionToken}`,
      'X-ZUMO-AUTH': functionToken, // For Easy Auth
    }
  });

  return NextResponse.json(await functionResponse.json());
}
```

**Easy Auth Notes:**

- Easy Auth validates tokens with its own client ID, not your app registration
- Use the Function App's client ID as `functionAppId`
- See [ON_BEHALF_OF_FLOW.md](./ON_BEHALF_OF_FLOW.md#azure-functions-and-easy-auth) for setup

---

### Token Validation

#### `validateAccessToken`

Validate an incoming access token (verifies signature, audience, issuer, expiration).

**Import:**
```typescript
import { validateAccessToken } from '@lance0/latch';
```

**Signature:**
```typescript
function validateAccessToken(
  token: string,
  expectedClientId: string,
  expectedTenantId: string,
  expectedCloud: LatchCloud,
  options?: {
    allowedAudiences?: string[];
    requiredAzp?: string;
  }
): Promise<ValidatedAccessToken>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `string` | Access token to validate |
| `expectedClientId` | `string` | Your API's client ID |
| `expectedTenantId` | `string` | Expected tenant ID |
| `expectedCloud` | `LatchCloud` | Expected cloud environment |
| `options.allowedAudiences` | `string[]` | Additional valid audiences |
| `options.requiredAzp` | `string` | Required authorized party (prevents token forwarding) |

**Returns (ValidatedAccessToken):**

```typescript
interface ValidatedAccessToken {
  sub: string;              // User's object ID
  oid: string;              // Object ID
  tid: string;              // Tenant ID
  aud: string;              // Audience
  iss: string;              // Issuer
  azp?: string;             // Authorized party
  exp: number;              // Expiration timestamp
  nbf: number;              // Not before timestamp
  iat: number;              // Issued at timestamp
  scp?: string;             // Scopes (space-separated)
  roles?: string[];         // App roles
  [key: string]: unknown;   // Additional claims
}
```

**Example:**

```typescript
import { validateAccessToken, extractBearerToken } from '@lance0/latch';

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return NextResponse.json({ error: 'No token' }, { status: 401 });
  }

  try {
    const claims = await validateAccessToken(
      token,
      process.env.LATCH_CLIENT_ID!,
      process.env.LATCH_TENANT_ID!,
      'gcc-high',
      {
        allowedAudiences: ['api://my-api', process.env.LATCH_CLIENT_ID!],
        requiredAzp: process.env.EXPECTED_CLIENT_ID, // Prevent token forwarding
      }
    );

    console.log(`Authenticated as: ${claims.sub}`);
    console.log(`Scopes: ${claims.scp}`);

    // Process request with validated claims
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

**Throws:**
- `LATCH_OBO_INVALID_ASSERTION` - Token signature invalid or expired
- `LATCH_OBO_AUDIENCE_MISMATCH` - Token not for this API
- `LATCH_OBO_ISSUER_MISMATCH` - Token from wrong cloud/tenant

---

#### `extractBearerToken`

Extract bearer token from Authorization header.

**Import:**
```typescript
import { extractBearerToken } from '@lance0/latch';
```

**Signature:**
```typescript
function extractBearerToken(authHeader: string | null): string | null
```

**Returns:** Token string or null if not a valid Bearer token

**Example:**

```typescript
import { extractBearerToken } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  // Use token...
}
```

**Handles:**
- Missing header → `null`
- Malformed header → `null`
- Extra whitespace → Normalized
- Valid `Bearer <token>` → `<token>`

---

#### `isTokenExpiringSoon`

Check if token is expiring within a threshold.

**Import:**
```typescript
import { isTokenExpiringSoon } from '@lance0/latch';
```

**Signature:**
```typescript
function isTokenExpiringSoon(
  expiresAt: number,
  bufferSeconds?: number
): boolean
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `expiresAt` | `number` | required | Unix timestamp when token expires |
| `bufferSeconds` | `number` | `300` | Seconds before expiry to consider "expiring soon" |

**Returns:** `true` if token expires within buffer period

**Example:**

```typescript
import { isTokenExpiringSoon } from '@lance0/latch';

const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

if (isTokenExpiringSoon(expiresAt, 300)) {
  console.log('Token expires in less than 5 minutes, should refresh');
}

if (isTokenExpiringSoon(expiresAt, 600)) {
  console.log('Token expires in less than 10 minutes');
}
```

---

### CAE (Continuous Access Evaluation) Helpers

For detailed CAE handling patterns, see [ON_BEHALF_OF_FLOW.md](./ON_BEHALF_OF_FLOW.md#continuous-access-evaluation-cae).

#### `parseCAEChallenge`

Parse WWW-Authenticate header for CAE claims challenge.

**Import:**
```typescript
import { parseCAEChallenge } from '@lance0/latch';
```

**Signature:**
```typescript
function parseCAEChallenge(
  wwwAuthenticate: string | null
): CAEChallenge | null
```

**Returns (CAEChallenge):**

```typescript
interface CAEChallenge {
  claims: string;       // Base64-encoded claims JSON
  error?: string;       // Error type (usually "insufficient_claims")
  realm?: string;       // Realm (usually empty)
}
```

**Example:**

```typescript
import { parseCAEChallenge, oboTokenForGraph } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const graphToken = await oboTokenForGraph(request);

  const graphResponse = await fetch('https://graph.microsoft.us/v1.0/me', {
    headers: { Authorization: `Bearer ${graphToken}` }
  });

  if (graphResponse.status === 401) {
    const challenge = parseCAEChallenge(
      graphResponse.headers.get('www-authenticate')
    );

    if (challenge) {
      // Retry OBO with claims
      const newToken = await oboTokenForGraph(request, {
        claims: challenge.claims,
      });

      // Retry Graph call with new token
      const retryResponse = await fetch('https://graph.microsoft.us/v1.0/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
    }
  }
}
```

**Header Format:**

```
WWW-Authenticate: Bearer realm="", error="insufficient_claims", claims="eyJhY2Nlc3..."
```

Returns `null` if not a CAE challenge (no `claims` parameter).

---

#### `buildCAEChallengeHeader`

Build WWW-Authenticate header for CAE challenge (to return to client).

**Import:**
```typescript
import { buildCAEChallengeHeader } from '@lance0/latch';
```

**Signature:**
```typescript
function buildCAEChallengeHeader(
  claims: string,
  error?: string,
  realm?: string
): string
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `claims` | `string` | required | Claims string from Azure AD |
| `error` | `string` | `'insufficient_claims'` | Error type |
| `realm` | `string` | `''` | Realm |

**Returns:** Formatted WWW-Authenticate header value

**Example:**

```typescript
import { buildCAEChallengeHeader } from '@lance0/latch';

export async function GET(request: NextRequest) {
  try {
    const token = await oboTokenForGraph(request);
    // ... call Graph API
  } catch (error: any) {
    if (error.code === 'LATCH_OBO_CAE_REQUIRED') {
      return NextResponse.json(
        { error: 'claims_required', claims: error.details?.claims },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': buildCAEChallengeHeader(error.details?.claims),
          }
        }
      );
    }
  }
}
```

**Output:**

```
Bearer realm="", error="insufficient_claims", claims="eyJhY2Nlc3..."
```

---

#### `isCAEError`

Check if error is CAE-related.

**Import:**
```typescript
import { isCAEError } from '@lance0/latch';
```

**Signature:**
```typescript
function isCAEError(error: any): boolean
```

**Returns:** `true` if error is a CAE claims challenge

**Example:**

```typescript
import { isCAEError, extractClaimsFromError } from '@lance0/latch';

try {
  const token = await oboTokenForGraph(request);
  // ...
} catch (error) {
  if (isCAEError(error)) {
    const claims = extractClaimsFromError(error);

    return NextResponse.json(
      { error: 'claims_required', claims },
      { status: 401 }
    );
  }

  throw error; // Other error
}
```

**Detects:**
- `error.code === 'LATCH_OBO_CAE_REQUIRED'`
- `error.message` contains "insufficient_claims"
- `error.message` contains "claims challenge"
- `error.message` contains "interaction_required"

---

#### `extractClaimsFromError`

Extract claims string from Latch OBO error.

**Import:**
```typescript
import { extractClaimsFromError } from '@lance0/latch';
```

**Signature:**
```typescript
function extractClaimsFromError(error: any): string | null
```

**Returns:** Claims string or `null` if not a CAE error

**Example:**

```typescript
import { extractClaimsFromError, buildCAEChallengeHeader } from '@lance0/latch';

try {
  const token = await oboTokenForGraph(request);
} catch (error: any) {
  const claims = extractClaimsFromError(error);

  if (claims) {
    // Return to client for retry
    return NextResponse.json(
      { error: 'claims_required', claims },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': buildCAEChallengeHeader(claims)
        }
      }
    );
  }
}
```

---

#### `withCAERetry`

Execute operation with automatic CAE retry detection.

**Import:**
```typescript
import { withCAERetry } from '@lance0/latch';
```

**Signature:**
```typescript
function withCAERetry<T>(
  operation: () => Promise<T>,
  config?: CAERetryConfig
): Promise<T>
```

**Config (CAERetryConfig):**

```typescript
interface CAERetryConfig {
  maxRetries?: number;          // Default: 1
  throwOnFailure?: boolean;     // Default: true
}
```

**Example:**

```typescript
import { withCAERetry, oboTokenForGraph, parseCAEChallenge } from '@lance0/latch';

export async function GET(request: NextRequest) {
  try {
    const result = await withCAERetry(async () => {
      const token = await oboTokenForGraph(request);

      const response = await fetch('https://graph.microsoft.us/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const challenge = parseCAEChallenge(
          response.headers.get('www-authenticate')
        );

        if (challenge) {
          throw new Error('CAE_CHALLENGE:' + challenge.claims);
        }

        throw new Error('API error');
      }

      return response.json();
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (isCAEError(error)) {
      const claims = extractClaimsFromError(error);
      return NextResponse.json(
        { error: 'claims_required', claims },
        { status: 401 }
      );
    }
    throw error;
  }
}
```

**Important:**

This helper detects and propagates CAE challenges. The client must handle the challenge and provide a new token with claims. The helper does NOT automatically retry with claims—it's for detection only.

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
  // Configuration
  | 'LATCH_CONFIG_MISSING'
  | 'LATCH_CLIENT_ID_MISSING'
  | 'LATCH_TENANT_ID_MISSING'
  | 'LATCH_CLOUD_INVALID'
  | 'LATCH_CLOUD_MISMATCH'
  | 'LATCH_COOKIE_SECRET_MISSING'

  // PKCE Flow
  | 'LATCH_PKCE_MISSING'
  | 'LATCH_STATE_MISSING'
  | 'LATCH_STATE_MISMATCH'
  | 'LATCH_NONCE_MISSING'
  | 'LATCH_NONCE_MISMATCH'
  | 'LATCH_CODE_MISSING'

  // Token Operations
  | 'LATCH_TOKEN_EXCHANGE_FAILED'
  | 'LATCH_TOKEN_REFRESH_FAILED'
  | 'LATCH_REFRESH_TOKEN_MISSING'

  // Validation
  | 'LATCH_INVALID_RETURN_URL'
  | 'LATCH_ID_TOKEN_INVALID'

  // Encryption
  | 'LATCH_ENCRYPTION_FAILED'
  | 'LATCH_DECRYPTION_FAILED'

  // OBO Flow
  | 'LATCH_OBO_INVALID_ASSERTION'      // Incoming token validation failed
  | 'LATCH_OBO_AUDIENCE_MISMATCH'      // Token not for this API
  | 'LATCH_OBO_ISSUER_MISMATCH'        // Token from wrong cloud/tenant
  | 'LATCH_OBO_EXCHANGE_FAILED'        // Azure AD token exchange failed
  | 'LATCH_OBO_CAE_REQUIRED'           // Claims challenge required
  | 'LATCH_OBO_MISSING_CLIENT_AUTH'    // No client secret or certificate
  | 'LATCH_OBO_CERT_INVALID'           // Certificate malformed
  | 'LATCH_OBO_AZP_MISMATCH';          // Authorized party mismatch
```

### `LatchSession`

The session object returned by `getServerSession()` and `requireServerSession()`:

```typescript
interface LatchSession {
  user: LatchUser | null;         // User data from ID token (null if not authenticated)
  isAuthenticated: boolean;       // True if user has valid session
}
```

### `LatchUser`

User data from Azure AD ID token:

```typescript
interface LatchUser {
  sub: string;                    // Azure AD object ID (unique identifier)
  oid: string;                    // Same as sub (Azure AD OID claim)
  email?: string;                 // User email
  name?: string;                  // User display name
  preferred_username?: string;    // Usually the email
  iat: number;                    // Issued at timestamp
  exp: number;                    // Expiration timestamp
  // ... other Azure AD claims from ID token
}
```

## Session Usage Patterns

### ✅ Correct Usage

```typescript
// In API route or Server Component
import { getServerSession } from '@lance0/latch';

const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);

if (session.isAuthenticated && session.user) {
  // ✓ Access user properties through session.user
  console.log(session.user.sub);    // User ID
  console.log(session.user.email);  // User email
  console.log(session.user.name);   // User name
}
```

```typescript
// Using requireServerSession helper
import { requireServerSession } from '@lance0/latch';

export async function GET() {
  try {
    const session = await requireServerSession(process.env.LATCH_COOKIE_SECRET!);
    // ✓ session.user is guaranteed to exist - no null checks needed
    return Response.json({ userId: session.user.sub });
  } catch (error) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

```typescript
// Using type guard
import { getServerSession, isLatchSession } from '@lance0/latch';

const session = await getServerSession(secret);

if (isLatchSession(session)) {
  // ✓ TypeScript knows session.user is LatchUser (not null)
  console.log(session.user.sub);
}
```

### ❌ Wrong Usage

```typescript
const session = await getServerSession(secret);

// ❌ Properties are NOT on session directly - they're on session.user
if (session) {
  console.log(session.sub);       // undefined
  console.log(session.email);     // undefined
  console.log(session.idToken);   // undefined - this property doesn't exist
}
```

### Session Validation in proxy.ts

When validating sessions in Next.js 16 proxy.ts, check `session.sub`:

```typescript
// ✅ Correct - check sub claim
import { COOKIE_NAMES, unseal } from '@lance0/latch';

const cookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN)?.value;
const session = await unseal(cookie, secret) as any;

if (!session || !session.sub) {  // ✓ Check 'sub' from ID token claims
  return NextResponse.redirect(new URL('/', request.url));
}
```

```typescript
// ❌ Wrong - idToken property doesn't exist
if (!session || !session.idToken) {  // ✗ This property doesn't exist!
  return NextResponse.redirect(new URL('/', request.url));
}
```

## Cookie Names

Latch uses three encrypted cookies. Always use `COOKIE_NAMES` constants:

```typescript
import { COOKIE_NAMES } from '@lance0/latch';

// Cookie name constants
COOKIE_NAMES.ID_TOKEN       // → 'latch_id'      (User session, ~300 bytes)
COOKIE_NAMES.REFRESH_TOKEN  // → 'latch_rt'      (Refresh token, ~2700 bytes)
COOKIE_NAMES.PKCE_DATA      // → 'latch_pkce'    (OAuth flow, ~250 bytes, temporary)

// ✅ Always use constants
const cookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN);

// ❌ Never hardcode (names might change between versions)
const cookie = request.cookies.get('latch_id');
```

**Why use constants:**
- Cookie names might change between versions
- Constants ensure consistency across your codebase
- TypeScript autocomplete works better
- Prevents typos

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
