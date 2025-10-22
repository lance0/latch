# Authentication Modes: Secure Proxy vs Direct Token

Latch supports two authentication modes, each designed for different security requirements and use cases.

## Quick Comparison

| Feature | Secure Proxy Mode | Direct Token Mode |
|---------|-------------------|-------------------|
| **Access Token Exposure** | Server-side only | Exposed to browser |
| **Security Level** | ⭐⭐⭐⭐⭐ Highest | ⭐⭐⭐ Good |
| **Performance** | Slower (proxy overhead) | Faster (direct calls) |
| **Setup Complexity** | Simple | Requires careful handling |
| **Recommended For** | Production apps | Trusted environments |
| **Token Refresh** | Automatic (server-side) | Manual via hook |
| **XSS Risk** | None (tokens never in browser) | Medium (tokens in memory) |
| **Network Hops** | 2 (client → server → API) | 1 (client → API) |

---

## Secure Proxy Mode (Default)

**Recommended for most applications.**

### How It Works

```
Browser                  Your Server                Microsoft Graph
   │                          │                            │
   │  1. GET /api/me         │                            │
   ├─────────────────────────>                            │
   │                          │                            │
   │                          │  2. Refresh token (if needed)
   │                          │                            │
   │                          │  3. GET /v1.0/me           │
   │                          ├───────────────────────────>│
   │                          │                            │
   │                          │  4. User data              │
   │                          <────────────────────────────┤
   │                          │                            │
   │  5. User data           │                            │
   <─────────────────────────┤                            │
```

### Implementation

**1. Create API Route (Server-Side)**

```typescript
// app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getLatchConfig, getAzureEndpoints } from '@/lib/latch';
import { cookies } from 'next/headers';
import { unseal } from '@/lib/latch/crypto/seal';

export async function GET(request: NextRequest) {
  const config = getLatchConfig();
  const cookieStore = cookies();

  // Get refresh token from encrypted cookie
  const refreshTokenCookie = cookieStore.get('latch_rt');
  if (!refreshTokenCookie) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const refreshTokenData = await unseal(
    refreshTokenCookie.value,
    config.cookieSecret!
  );

  // Refresh access token (server-side, never exposed)
  const tokens = await refreshAccessToken(
    refreshTokenData.refreshToken,
    config.clientId,
    config.tenantId,
    config.cloud,
    config.scopes
  );

  // Call Microsoft Graph with server-side token
  const endpoints = getAzureEndpoints(config.cloud, config.tenantId);
  const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```

**2. Call from Client**

```typescript
'use client';

export default function ProfilePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(setUser);
  }, []);

  return <div>{user?.displayName}</div>;
}
```

### Advantages

✅ **Maximum Security**
- Access tokens never touch the browser
- No XSS risk for token theft
- Refresh tokens stay encrypted server-side

✅ **Simple Client Code**
- Just call your API routes
- No token management needed
- Framework handles everything

✅ **Automatic Refresh**
- Server refreshes tokens as needed
- Client never aware of token expiry
- Zero client-side token logic

✅ **Compliance-Friendly**
- Meets strict security requirements
- Tokens never logged in client console
- Perfect for GCC-High/DoD environments

### Disadvantages

❌ **Performance Overhead**
- Extra network hop (client → server → API)
- Slightly higher latency (~100-200ms)
- More server load

❌ **Server Required**
- Can't use with static exports
- Requires server-side API routes
- Edge runtime limitations

### When to Use

- ✅ Production applications with user data
- ✅ GCC-High or DoD environments
- ✅ Apps handling sensitive information
- ✅ When compliance is critical
- ✅ Default choice for most use cases

---

## Direct Token Mode

**For performance-critical or trusted environments.**

### How It Works

```
Browser                  Your Server                Microsoft Graph
   │                          │                            │
   │  1. Get access token    │                            │
   ├─────────────────────────>                            │
   │                          │                            │
   │  2. Access token        │                            │
   <─────────────────────────┤                            │
   │                          │                            │
   │  3. GET /v1.0/me (with token)                       │
   ├─────────────────────────────────────────────────────>│
   │                          │                            │
   │  4. User data           │                            │
   <─────────────────────────────────────────────────────┤
```

### Implementation

**1. Use the Hook**

```typescript
'use client';

import { useAccessToken } from '@/lib/latch';
import { getAzureEndpoints } from '@/lib/latch';

export default function ProfilePage() {
  const { accessToken, isLoading, error, expiresAt } = useAccessToken({
    autoRefresh: true,         // Auto-refresh before expiry
    refreshThreshold: 300,     // Refresh 5 min early
    retryOnFailure: true,      // Retry with backoff
    maxRetries: 3,             // Max 3 retry attempts
    pauseWhenHidden: true,     // Pause when tab hidden
  });

  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!accessToken) return;

    const endpoints = getAzureEndpoints(
      process.env.NEXT_PUBLIC_LATCH_CLOUD!,
      process.env.NEXT_PUBLIC_LATCH_TENANT_ID!
    );

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

**2. Environment Variables (Client-Side)**

```bash
# .env.local
NEXT_PUBLIC_LATCH_CLOUD=commercial
NEXT_PUBLIC_LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111
```

### Advantages

✅ **Better Performance**
- Direct API calls, no proxy
- Lower latency (~100-200ms faster)
- Reduced server load

✅ **Works Everywhere**
- Compatible with static exports
- Can deploy to CDN
- No server-side rendering required

✅ **Offline Support**
- Tokens cached in memory
- Works without server connection
- Better for PWAs

✅ **Auto-Refresh Built-In**
- Configurable refresh threshold
- Exponential backoff retry
- Page visibility handling

### Disadvantages

❌ **Security Trade-offs**
- Tokens exposed to browser JavaScript
- XSS attacks can steal tokens
- Tokens visible in memory/debugger

❌ **More Client Logic**
- Must handle token refresh
- Error handling complexity
- Token lifecycle management

❌ **Token Lifetime**
- Access tokens expire in ~1 hour
- Must implement refresh logic
- Can't extend token lifetime

### When to Use

- ✅ Read-only operations
- ✅ Trusted internal tools
- ✅ Performance-critical dashboards
- ✅ Static site generation
- ✅ Offline-capable PWAs
- ⚠️ Only for experienced developers

---

## Security Comparison

### Token Exposure

**Secure Proxy Mode:**
```
✅ Access Token:  Server memory only
✅ Refresh Token: Encrypted HttpOnly cookie
✅ ID Token:      Encrypted HttpOnly cookie
```

**Direct Token Mode:**
```
⚠️ Access Token:  Browser memory (JavaScript)
✅ Refresh Token: Encrypted HttpOnly cookie
✅ ID Token:      Encrypted HttpOnly cookie
```

### Attack Vectors

| Attack Type | Secure Proxy | Direct Token |
|-------------|--------------|--------------|
| **XSS Token Theft** | ✅ Immune | ⚠️ Vulnerable |
| **CSRF** | ✅ Protected (state param) | ✅ Protected (state param) |
| **Token Replay** | ✅ Protected (nonce) | ✅ Protected (nonce) |
| **Man-in-the-Middle** | ✅ Protected (HTTPS) | ✅ Protected (HTTPS) |
| **Cookie Tampering** | ✅ Protected (AES-GCM) | ✅ Protected (AES-GCM) |
| **Open Redirect** | ✅ Protected (whitelist) | ✅ Protected (whitelist) |

**Key Difference:** XSS attacks can steal access tokens in Direct Token mode.

---

## Performance Comparison

### Latency

**Secure Proxy Mode:**
```
Client → Server:     50ms
Server → Graph API:  100ms
Graph API → Server:  100ms
Server → Client:     50ms
────────────────────────
Total:               300ms
```

**Direct Token Mode:**
```
Client → Graph API:  100ms
Graph API → Client:  100ms
────────────────────────
Total:               200ms
```

**Result:** Direct Token is ~100-150ms faster per request.

### Server Load

**Secure Proxy Mode:**
- Every API call hits your server
- Server must refresh tokens
- Higher CPU/memory usage

**Direct Token Mode:**
- Token refresh hits server
- API calls bypass server
- Lower server load

---

## Migration Guide

### From Secure Proxy → Direct Token

**1. Add Environment Variables**

```bash
# .env.local
NEXT_PUBLIC_LATCH_CLOUD=commercial
NEXT_PUBLIC_LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111
```

**2. Replace API Route Calls**

```typescript
// Before (Secure Proxy)
const response = await fetch('/api/me');
const user = await response.json();

// After (Direct Token)
const { accessToken } = useAccessToken();
const endpoints = getAzureEndpoints(cloud, tenantId);
const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const user = await response.json();
```

### From Direct Token → Secure Proxy

**1. Create API Routes**

```typescript
// app/api/me/route.ts
export async function GET(request: NextRequest) {
  // Use refresh token to get access token server-side
  // Call Graph API server-side
  // Return data to client
}
```

**2. Replace Direct Calls**

```typescript
// Before (Direct Token)
const { accessToken } = useAccessToken();
const response = await fetch(`${graphBaseUrl}/v1.0/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

// After (Secure Proxy)
const response = await fetch('/api/me');
```

---

## Hybrid Approach

You can use both modes in the same application!

**Example: Secure Proxy for writes, Direct Token for reads**

```typescript
'use client';

import { useAccessToken } from '@/lib/latch';

export default function Dashboard() {
  // Direct Token for fast reads
  const { accessToken } = useAccessToken();

  async function fetchProfile() {
    // Fast: Direct call with token
    const response = await fetch(`${graphBaseUrl}/v1.0/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }

  async function updateProfile(data: any) {
    // Secure: Proxy through server for writes
    const response = await fetch('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  // ...
}
```

---

## Recommendations

### Choose Secure Proxy Mode if:
- 🔒 Security is your top priority
- 🏛️ Working with GCC-High or DoD
- 📊 Handling sensitive user data
- ✅ You can accept 100-200ms extra latency
- 🎯 You're unsure which to choose

### Choose Direct Token Mode if:
- ⚡ Performance is critical (< 200ms target)
- 📱 Building a PWA with offline support
- 🔍 Only reading public data
- 🛠️ You're an experienced security engineer
- 🚀 Deploying to static hosting (Vercel, Netlify)

### Default Recommendation

**Start with Secure Proxy Mode.** You can always migrate to Direct Token later if performance becomes an issue. Security is harder to add retroactively than performance optimization.

---

## FAQ

**Q: Can I switch modes without re-authenticating users?**
A: Yes! Both modes use the same refresh token cookie. Switching modes doesn't affect authentication state.

**Q: Does Direct Token mode work with GCC-High?**
A: Yes, but be aware of compliance requirements. Some GCC-High contracts prohibit client-side token exposure.

**Q: How long do access tokens last?**
A: ~1 hour (Azure AD default). Refresh tokens last ~90 days.

**Q: Can I use Direct Token for writes?**
A: Technically yes, but not recommended. Use Secure Proxy for any write operations.

**Q: What happens if my token is stolen in Direct Token mode?**
A: Attacker has access for ~1 hour until token expires. Refresh token stays safe in HttpOnly cookie.

**Q: Is the performance difference noticeable?**
A: For most apps, no. Only matters for dashboards updating multiple times per second.
