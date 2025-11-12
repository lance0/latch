# Migrating from MSAL to Latch

This guide helps you migrate from Microsoft Authentication Library (MSAL) for React/Browser to Latch for Next.js applications.

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

✅ **Next.js Applications:**
- Built for Next.js App Router
- Server-side token handling
- No client-side token exposure by default

✅ **Simplified Architecture:**
- No need for MSAL configuration objects
- No token cache management
- No interaction required handling

✅ **Government Cloud:**
- One environment variable (`LATCH_CLOUD=gcc-high`)
- vs. MSAL's complex authority URLs

✅ **Security:**
- Tokens stored in HttpOnly cookies (not localStorage)
- Automatic PKCE (no manual configuration)
- Server-side token refresh

✅ **Developer Experience:**
- Environment variable configuration
- React hooks out of the box
- Server Actions support

### When to Stay with MSAL

❌ **Browser-only (SPA) applications:**
- No Next.js server component
- Pure client-side React

❌ **Complex scenarios:**
- B2C authentication
- Multi-tenant with custom domains
- Certificate-based auth for service principals

❌ **Non-Next.js frameworks:**
- Angular, Vue, vanilla JavaScript
- MSAL has SDKs for these, Latch doesn't

---

## Key Differences

| Feature | MSAL Browser/React | Latch |
|---------|-------------------|-------|
| **Framework** | Any browser framework | Next.js only |
| **Token Storage** | SessionStorage/LocalStorage | HttpOnly cookies |
| **Configuration** | JavaScript config object | Environment variables |
| **PKCE** | Manual (`cacheLocation`) | Always automatic |
| **Token Refresh** | Client-side with redirect | Server-side automatic |
| **Popup vs Redirect** | Both supported | Redirect only |
| **Government Cloud** | Manual authority URLs | `LATCH_CLOUD=gcc-high` |
| **Server Integration** | Additional setup needed | Built-in |

---

## Migration Steps

### Step 1: Install Latch

```bash
npm uninstall @azure/msal-browser @azure/msal-react
npm install @lance0/latch
```

### Step 2: Replace MSAL Configuration

**Before (MSAL):**
```typescript
// msal-config.ts
import { Configuration, PublicClientApplication } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri: 'http://localhost:3000',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
```

**After (Latch):**
```env
# .env.local
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=commercial
LATCH_SCOPES=openid profile email User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=$(openssl rand -base64 32)
```

Copy API routes from [example app](../apps/example-app/app/api/latch/).

### Step 3: Update Root Layout

**Before (MSAL):**
```typescript
'use client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './msal-config';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MsalProvider instance={msalInstance}>
          {children}
        </MsalProvider>
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

### Step 4: Update Authentication Components

**Before (MSAL):**
```typescript
'use client';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

export default function LoginButton() {
  const { instance, accounts, inProgress } = useMsal();
  
  const handleLogin = () => {
    instance.loginRedirect({
      scopes: ['User.Read'],
    });
  };
  
  const handleLogout = () => {
    instance.logoutRedirect();
  };
  
  if (inProgress !== InteractionStatus.None) {
    return <div>Loading...</div>;
  }
  
  if (accounts.length > 0) {
    return (
      <div>
        <p>Welcome {accounts[0].name}</p>
        <button onClick={handleLogout}>Sign Out</button>
      </div>
    );
  }
  
  return <button onClick={handleLogin}>Sign In</button>;
}
```

**After (Latch):**
```typescript
'use client';
import { useLatch } from '@lance0/latch/react';

export default function LoginButton() {
  const { user, isLoading, signIn, signOut } = useLatch();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (user) {
    return (
      <div>
        <p>Welcome {user.name}</p>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    );
  }
  
  return <button onClick={() => signIn()}>Sign In</button>;
}
```

### Step 5: Update Token Acquisition

**Before (MSAL - Acquiring Tokens):**
```typescript
'use client';
import { useMsal } from '@azure/msal-react';

export default function UserProfile() {
  const { instance, accounts } = useMsal();
  const [profile, setProfile] = useState(null);
  
  useEffect(() => {
    if (accounts.length > 0) {
      const request = {
        scopes: ['User.Read'],
        account: accounts[0],
      };
      
      instance.acquireTokenSilent(request)
        .then(response => {
          // Call Graph API
          return fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${response.accessToken}` }
          });
        })
        .then(res => res.json())
        .then(setProfile)
        .catch(error => {
          if (error.name === 'InteractionRequiredAuthError') {
            instance.acquireTokenRedirect(request);
          }
        });
    }
  }, [accounts, instance]);
  
  return <div>{profile?.displayName}</div>;
}
```

**After (Latch - Secure Proxy):**
```typescript
'use client';
import { useLatch } from '@lance0/latch/react';

export default function UserProfile() {
  const { user } = useLatch();
  const [profile, setProfile] = useState(null);
  
  useEffect(() => {
    if (user) {
      // Call your API route (server-side token handling)
      fetch('/api/me')
        .then(res => res.json())
        .then(setProfile);
    }
  }, [user]);
  
  return <div>{profile?.displayName}</div>;
}

// app/api/me/route.ts (server-side)
import { getLatchConfig, refreshAccessToken, unseal, COOKIE_NAMES } from '@lance0/latch';

export async function GET(request: Request) {
  const config = getLatchConfig();
  const rtCookie = request.cookies.get(COOKIE_NAMES.REFRESH_TOKEN);
  const rtData = await unseal(rtCookie.value, config.cookieSecret!);
  
  const tokens = await refreshAccessToken(
    rtData.refreshToken,
    config.clientId,
    config.tenantId,
    config.cloud,
    ['User.Read']
  );
  
  // Token never exposed to client
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  
  return Response.json(await response.json());
}
```

---

## Code Comparison

### Initialization

**MSAL:**
```typescript
const msalConfig = {
  auth: {
    clientId: '...',
    authority: '...',
    redirectUri: '...',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    allowNativeBroker: false,
  }
};

const pca = new PublicClientApplication(msalConfig);
await pca.initialize();
```

**Latch:**
```env
LATCH_CLIENT_ID=...
LATCH_TENANT_ID=...
LATCH_CLOUD=commercial
```

No initialization needed!

### Login

**MSAL:**
```typescript
// Redirect flow
instance.loginRedirect({
  scopes: ['User.Read'],
  redirectStartPage: '/dashboard',
});

// Popup flow
instance.loginPopup({
  scopes: ['User.Read'],
}).then(result => {
  console.log(result.accessToken);
});
```

**Latch:**
```typescript
// Redirect only (more secure)
signIn('/dashboard'); // returnTo parameter
```

### Logout

**MSAL:**
```typescript
instance.logoutRedirect({
  postLogoutRedirectUri: '/',
});
```

**Latch:**
```typescript
signOut(); // Automatically redirects to Azure AD logout
```

### Getting Current User

**MSAL:**
```typescript
const accounts = instance.getAllAccounts();
const currentAccount = accounts[0];
console.log(currentAccount.name);
```

**Latch:**
```typescript
const { user } = useLatch();
console.log(user?.name);
```

---

## Feature Mapping

### Core Features

| MSAL | Latch | Notes |
|------|-------|-------|
| `loginRedirect()` | `signIn()` | Latch uses redirect only |
| `loginPopup()` | Not supported | Redirect more secure |
| `logoutRedirect()` | `signOut()` | Same behavior |
| `getAllAccounts()` | `useLatch()` returns `user` | Single account only |
| `acquireTokenSilent()` | `/api/latch/refresh` | Server-side |
| `acquireTokenRedirect()` | Automatic | Handled by Latch |

### Configuration

| MSAL | Latch | Notes |
|------|-------|-------|
| `auth.clientId` | `LATCH_CLIENT_ID` | Env var |
| `auth.authority` | `LATCH_TENANT_ID` + `LATCH_CLOUD` | Auto-configured |
| `auth.redirectUri` | `LATCH_REDIRECT_URI` | Env var |
| `cache.cacheLocation` | N/A (cookies) | Automatic |
| `scopes` parameter | `LATCH_SCOPES` | Env var |

### Account Information

| MSAL `account` | Latch `user` |
|----------------|--------------|
| `account.name` | `user.name` |
| `account.username` | `user.preferred_username` |
| `account.localAccountId` | `user.sub` |
| `account.homeAccountId` | `user.sub` |

---

## Azure Government Support

### MSAL (verbose configuration):

```typescript
const msalConfig = {
  auth: {
    clientId: '...',
    authority: 'https://login.microsoftonline.us/tenant-id',
    knownAuthorities: ['login.microsoftonline.us'],
  },
  // Configure token endpoint manually
  // Configure Graph endpoint in every API call
};

// Every Graph call needs custom endpoint
fetch('https://graph.microsoft.us/v1.0/me', { ... });
```

### Latch (one line):

```env
LATCH_CLOUD=gcc-high
```

All endpoints automatically configured, including Graph API.

---

## Common Migration Issues

### Issue 1: Token Exposure

**Problem:** MSAL exposes tokens to client-side code

```typescript
// MSAL - tokens in client JavaScript
const response = await instance.acquireTokenSilent(request);
console.log(response.accessToken); // Exposed to client!
```

**Solution:** Use Latch's Secure Proxy pattern (server-side tokens)

```typescript
// Latch - tokens stay on server
const response = await fetch('/api/me'); // Server handles tokens
```

### Issue 2: Interaction Required Errors

**Problem:** MSAL requires handling interaction errors manually

```typescript
instance.acquireTokenSilent(request)
  .catch(error => {
    if (error.name === 'InteractionRequiredAuthError') {
      instance.acquireTokenRedirect(request);
    }
  });
```

**Solution:** Latch handles this automatically - just refresh the token

```typescript
// Latch handles token refresh automatically
const response = await fetch('/api/latch/refresh', { method: 'POST' });
```

### Issue 3: Account Selection

**Problem:** MSAL supports multiple accounts, need to select one

```typescript
const accounts = instance.getAllAccounts();
const currentAccount = accounts.find(a => a.homeAccountId === savedId);
```

**Solution:** Latch uses single account model (simpler)

```typescript
const { user } = useLatch(); // Always the current user
```

### Issue 4: Token Caching

**Problem:** MSAL requires managing token cache

```typescript
// Manually check cache, handle refresh, etc.
instance.acquireTokenSilent()
  .catch(error => {
    // Handle cache miss, token expired, etc.
  });
```

**Solution:** Latch handles caching automatically via cookies

```typescript
// No cache management needed - automatic!
```

---

## Security Improvements

### MSAL Security Concerns

❌ **Tokens in localStorage/sessionStorage:**
- Vulnerable to XSS attacks
- Accessible to any JavaScript code

❌ **Client-side token refresh:**
- Tokens exposed during network requests
- Visible in browser DevTools

❌ **Manual PKCE configuration:**
- Easy to misconfigure
- Must specify `cacheLocation: 'sessionStorage'` for PKCE

### Latch Security Benefits

✅ **HttpOnly cookies:**
- Not accessible to JavaScript
- XSS protection built-in

✅ **Server-side tokens:**
- Tokens never sent to client
- No exposure in DevTools

✅ **Automatic PKCE:**
- Always enabled (S256)
- No configuration needed

✅ **Token confusion prevention:**
- Strict issuer validation (v0.4.1+)
- Tenant verification

---

## Performance Comparison

| Metric | MSAL | Latch |
|--------|------|-------|
| **Initial Setup** | ~45 minutes | ~10 minutes |
| **Bundle Size** | ~80KB (msal-browser + msal-react) | ~30KB |
| **Token Acquisition** | Client-side (redirect may be needed) | Server-side (seamless) |
| **Storage** | LocalStorage/SessionStorage | HttpOnly cookies |
| **Security** | Client-side tokens | Server-side tokens |

---

## Migration Checklist

- [ ] Install `@lance0/latch` and remove MSAL packages
- [ ] Create `.env.local` with Latch configuration
- [ ] Copy Latch API routes from example app
- [ ] Replace `MsalProvider` with `LatchProvider`
- [ ] Replace `useMsal()` with `useLatch()` in components
- [ ] Move token acquisition to server-side API routes
- [ ] Remove MSAL configuration files
- [ ] Remove `acquireTokenSilent/Redirect` calls
- [ ] Test authentication flow
- [ ] Test token refresh for API calls
- [ ] Update documentation

---

## Why Choose Latch Over MSAL?

### For Next.js Applications

| Requirement | MSAL | Latch |
|-------------|------|-------|
| **Server-side rendering** | Complex integration | Native support |
| **API Routes** | Manual token passing | Built-in helpers |
| **Server Actions** | Not supported | Native `requireAuth()` |
| **Cookie security** | Manual implementation | Built-in |
| **Government cloud** | Complex configuration | One env var |

### Developer Experience

**MSAL Complexity:**
```typescript
// 100+ lines of configuration
// Error handling for interaction required
// Manual token refresh
// Account selection logic
// Cache management
// Security concerns (localStorage)
```

**Latch Simplicity:**
```env
# 6 environment variables
# Everything else automatic
```

---

## Need Help?

- [Latch Documentation](../README.md)
- [Example Apps](../apps/)
- [Server Actions Guide](./SERVER_ACTIONS.md)
- [MSAL to Latch Quick Reference](#quick-reference)
- [GitHub Issues](https://github.com/lance0/latch/issues)

---

## Quick Reference

### MSAL to Latch API Mapping

```typescript
// MSAL → Latch

// Login
instance.loginRedirect(request) → signIn(returnTo)

// Logout
instance.logoutRedirect() → signOut()

// Get user
instance.getAllAccounts()[0] → useLatch().user

// Get token (client-side)
instance.acquireTokenSilent(request) → fetch('/api/latch/refresh')

// Check if authenticated
accounts.length > 0 → isAuthenticated

// Loading state
inProgress !== InteractionStatus.None → isLoading

// User name
accounts[0].name → user.name

// User email
accounts[0].username → user.email || user.preferred_username
```

---

## Complete Example

See [example-commercial](../apps/example-commercial/) for a complete Next.js application with Latch, demonstrating all features including token acquisition, Graph API calls, and Server Actions.
