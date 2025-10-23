# On-Behalf-Of (OBO) Flow

The On-Behalf-Of (OBO) flow enables middle-tier APIs to call downstream APIs on behalf of an authenticated user. This document explains when to use OBO, how it works, and how to implement it securely with Latch.

## Table of Contents

- [When to Use OBO](#when-to-use-obo)
- [When NOT to Use OBO](#when-not-to-use-obo)
- [Security Model](#security-model)
- [Azure AD Setup](#azure-ad-setup)
- [Implementation](#implementation)
- [CAE (Continuous Access Evaluation)](#cae-continuous-access-evaluation)
- [Azure Functions](#azure-functions)
- [Certificate Authentication](#certificate-authentication)
- [Troubleshooting](#troubleshooting)

---

## When to Use OBO

Use the On-Behalf-Of flow when:

### ✅ Middle-Tier Scenario

Your architecture involves a **middle-tier API** that receives bearer tokens from clients:

```
Client (SPA/Mobile) → Your Next.js API → Downstream API
                   [Bearer Token]      [OBO Token]
```

**Examples:**
- Single Page Application (SPA) calls your API, which needs to call Microsoft Graph
- Mobile app calls your API, which needs to call a custom downstream service
- External client calls your API, which needs to chain to Azure Functions
- Microservices architecture with user context propagation

### ✅ User Context Required

You need to call downstream APIs **on behalf of the authenticated user**, preserving their identity and permissions:

- User's data access controls must be enforced
- Audit logs must show the actual user, not your API
- Downstream API needs to know who the end user is

### ✅ Delegated Permissions

You're using **delegated permissions** (not application permissions):

- Permissions are granted on behalf of the signed-in user
- User consent or admin consent is required
- Access is limited to what the user can access

---

## When NOT to Use OBO

### ❌ Server-to-Server (No User Context)

If your API doesn't receive a user token or doesn't need user context:

```typescript
// ❌ DON'T use OBO for background jobs
// Use application permissions with client credentials flow
const appToken = await getAppOnlyToken();
```

**Use instead:**
- Client credentials grant (app-only tokens)
- Managed Identity (for Azure services)
- Service principal authentication

### ❌ Latch's Default BFF Pattern

If you're using Latch's **default server-side session pattern**, you already have refresh tokens server-side:

```typescript
// ❌ DON'T use OBO here - use refresh token instead
export async function GET(request: NextRequest) {
  const refreshToken = await getRefreshTokenFromCookie();
  const tokens = await refreshAccessToken(refreshToken, ...);

  // Call Graph with the refreshed access token
  const graphResponse = await fetch('https://graph.microsoft.us/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
}
```

**When Latch's BFF pattern is sufficient:**
- Client never gets access tokens (Secure Proxy mode)
- All API calls go through your Next.js server
- Server has refresh tokens in HttpOnly cookies
- **No OBO needed** - just refresh and call downstream APIs

### ❌ Token Chaining (Anti-Pattern)

**Never** use a downstream API's access token as the assertion for another OBO call:

```typescript
// ❌ WRONG: Using Graph token to get another token
const graphToken = await oboTokenForGraph(request);
const anotherToken = await exchangeTokenOnBehalfOf({
  userAssertion: graphToken, // ❌ Don't do this!
  ...
});
```

**Why:** Token chaining breaks the trust model. Always use the **original user's token** from the client.

---

## Security Model

### Trust Boundaries

```
┌────────────────────────────────────────────────────────┐
│ Client (User's Device)                                 │
│  - User authenticates                                  │
│  - Gets access token for YOUR API                      │
│    aud: api://your-api or your-client-id               │
└────────────────┬───────────────────────────────────────┘
                 │ Bearer <user-token-for-your-api>
                 ▼
┌────────────────────────────────────────────────────────┐
│ Your Next.js API (Middle Tier)                        │
│  - Validates incoming token (aud, iss, tid, exp)      │
│  - Checks token is FOR YOUR API                        │
│  - Exchanges for downstream token via OBO              │
└────────────────┬───────────────────────────────────────┘
                 │ OBO Exchange with Azure AD
                 │  - assertion: user-token-for-your-api
                 │  - requested_token_use: on_behalf_of
                 │  - scope: downstream-api/.default
                 ▼
┌────────────────────────────────────────────────────────┐
│ Azure AD Token Endpoint                                │
│  - Validates your API's credentials (secret/cert)      │
│  - Validates incoming assertion                        │
│  - Checks delegated permissions granted                │
│  - Issues new token for downstream API                 │
│    aud: downstream-api, sub: user-id                   │
└────────────────┬───────────────────────────────────────┘
                 │ Bearer <user-token-for-downstream>
                 ▼
┌────────────────────────────────────────────────────────┐
│ Downstream API (Graph, Custom API, Azure Function)    │
│  - Receives token scoped to its audience               │
│  - User context preserved (sub, tid, etc.)             │
│  - Enforces user's access controls                     │
└────────────────────────────────────────────────────────┘
```

### Security Guarantees

Latch OBO implementation provides:

**✅ Audience Validation**
- Incoming token **must** have `aud` matching your API's client ID or App ID URI
- Prevents tokens intended for other APIs from being accepted
- Configurable via `allowedAudiences` in `LatchConfig`

**✅ Issuer Validation**
- Token issuer must match `https://login.microsoftonline.{com|us}/{tenant-id}/v2.0`
- Prevents tokens from wrong cloud (commercial vs GCC-High vs DoD)
- Prevents tokens from wrong tenant

**✅ Tenant Validation**
- Token's `tid` claim must match your configured tenant ID
- Prevents multi-tenant token confusion attacks
- **Note:** Multi-tenant apps are NOT supported by default (by design)

**✅ Authorized Party Binding (Optional)**
- Validates `azp` claim to ensure token was issued to expected client
- Prevents token forwarding from unexpected applications
- Enable with `requiredAzp` in `OBOTokenRequest`

**✅ No Token Chaining**
- Validates that assertion is the **original user token**, not a downstream token
- Enforces proper trust boundaries

**✅ Token Caching with Isolation**
- Cached tokens are keyed by: `clientId|tenantId|userId|resource|scopes|claims`
- Prevents cross-app token reuse in multi-app processes
- Respects TTL buffer (expires 5 min early by default)

---

## Azure AD Setup

### Step 1: Register Your API

1. Go to [Azure Portal](https://portal.azure.com) → **App Registrations**
2. Create or select your API's app registration
3. Note the **Application (client) ID** - this is your `LATCH_CLIENT_ID`
4. Note the **Directory (tenant) ID** - this is your `LATCH_TENANT_ID`

### Step 2: Configure Client Secret or Certificate

#### Option A: Client Secret (Simpler)

1. Go to **Certificates & secrets** → **New client secret**
2. Copy the secret value → Set `LATCH_CLIENT_SECRET=<secret>`
3. **Note:** Secrets expire - set a reminder to rotate before expiration

#### Option B: Certificate (Preferred for IL4/IL5)

1. Generate certificate:
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365
   ```

2. Upload **cert.pem** to **Certificates & secrets** → **Upload certificate**

3. Get thumbprint and configure:
   ```bash
   export LATCH_CLIENT_CERTIFICATE_PRIVATE_KEY="$(cat key.pem)"
   export LATCH_CLIENT_CERTIFICATE_THUMBPRINT="<thumbprint-from-portal>"
   ```

4. Update `LatchConfig`:
   ```typescript
   clientCertificate: {
     privateKey: process.env.LATCH_CLIENT_CERTIFICATE_PRIVATE_KEY!,
     thumbprint: process.env.LATCH_CLIENT_CERTIFICATE_THUMBPRINT!,
   }
   ```

### Step 3: Grant Delegated Permissions

#### For Microsoft Graph:

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Choose permissions (e.g., `User.Read`, `Mail.Read`)
4. Click **Grant admin consent** (required for most scenarios)

#### For Custom Downstream API:

1. Go to **API permissions** → **Add a permission**
2. Select **My APIs** → Find your downstream API
3. Choose delegated permissions exposed by that API
4. Click **Grant admin consent**

**Important:** OBO requires **delegated permissions**, not application permissions.

### Step 4: Expose Your API (If Needed)

If external clients call your API, expose it:

1. Go to **Expose an API** → **Add a scope**
2. Set **Application ID URI**: `api://your-api-name` (or use default)
3. Add scopes your API exposes (e.g., `Read`, `Write`)
4. External clients will request tokens with audience = your App ID URI

---

## Implementation

### Basic Usage: Call Microsoft Graph

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { oboTokenForGraph } from '@lance0/latch';

export async function GET(request: NextRequest) {
  try {
    // Get OBO token for Microsoft Graph
    const graphToken = await oboTokenForGraph(request, {
      scopes: ['User.Read'] // Optional, defaults to User.Read
    });

    // Call Microsoft Graph
    const config = getLatchConfig();
    const endpoints = getAzureEndpoints(config.cloud, config.tenantId);

    const response = await fetch(`${endpoints.graphBaseUrl}/v1.0/me`, {
      headers: { Authorization: `Bearer ${graphToken}` }
    });

    return NextResponse.json(await response.json());
  } catch (error: any) {
    if (error.code === 'LATCH_OBO_INVALID_ASSERTION') {
      return NextResponse.json(
        { error: 'No valid bearer token' },
        { status: 401 }
      );
    }
    throw error;
  }
}
```

### Call Custom Downstream API

```typescript
import { oboTokenForApi } from '@lance0/latch';

export async function GET(request: NextRequest) {
  // Get OBO token for your downstream API
  const apiToken = await oboTokenForApi(request, {
    audience: 'api://my-downstream-api', // App ID URI or client ID
    scopes: ['api://my-downstream-api/.default'] // Or specific scopes
  });

  // Call downstream API
  const response = await fetch('https://my-api.example.com/data', {
    headers: { Authorization: `Bearer ${apiToken}` }
  });

  return NextResponse.json(await response.json());
}
```

### Low-Level OBO (Advanced)

For full control, use `exchangeTokenOnBehalfOf`:

```typescript
import { exchangeTokenOnBehalfOf, extractBearerToken } from '@lance0/latch';

export async function GET(request: NextRequest) {
  const userAssertion = extractBearerToken(
    request.headers.get('authorization')
  );

  if (!userAssertion) {
    return NextResponse.json({ error: 'No bearer token' }, { status: 401 });
  }

  const oboResponse = await exchangeTokenOnBehalfOf({
    userAssertion,
    clientId: config.clientId,
    tenantId: config.tenantId,
    cloud: config.cloud,
    clientAuth: {
      clientSecret: config.clientSecret,
      certificate: config.clientCertificate,
    },
    scopes: ['api://downstream/.default'],
    allowedAudiences: ['api://your-api'], // Optional additional audiences
    requiredAzp: 'client-id-of-caller', // Optional azp binding
  });

  // oboResponse contains: access_token, expires_in, expires_at, scope
  return NextResponse.json({ token: oboResponse.access_token });
}
```

---

## CAE (Continuous Access Evaluation)

Azure AD may require **claims challenges** for sensitive operations (CAE-enabled resources):

### Handling CAE Errors

```typescript
export async function GET(request: NextRequest) {
  try {
    const graphToken = await oboTokenForGraph(request);

    const response = await fetch('https://graph.microsoft.us/v1.0/me', {
      headers: { Authorization: `Bearer ${graphToken}` }
    });

    if (response.status === 401) {
      // Check for CAE claims challenge
      const wwwAuth = response.headers.get('www-authenticate');
      if (wwwAuth?.includes('insufficient_claims')) {
        // Extract claims from WWW-Authenticate header
        const claimsMatch = wwwAuth.match(/claims="([^"]+)"/);
        if (claimsMatch) {
          // Return to client to request new token with claims
          return NextResponse.json(
            { error: 'claims_challenge_required', claims: claimsMatch[1] },
            {
              status: 401,
              headers: { 'WWW-Authenticate': wwwAuth }
            }
          );
        }
      }
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    if (error.code === 'LATCH_OBO_CAE_REQUIRED') {
      // OBO exchange itself requires claims
      return NextResponse.json(
        {
          error: 'claims_challenge_required',
          claims: error.details?.claims
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': `Bearer realm="", error="insufficient_claims", claims="${error.details?.claims}"`
          }
        }
      );
    }
    throw error;
  }
}
```

### CAE Retry Flow

1. **First attempt:** OBO without claims
2. **401 response:** Azure AD returns claims challenge
3. **Client gets new token:** Client requests token with `claims` parameter
4. **Retry with claims:** OBO call includes claims

```typescript
// Retry with claims
const oboResponse = await exchangeTokenOnBehalfOf({
  userAssertion,
  claims: claimsFromChallenge, // Include claims from previous error
  // ... other params
});
```

---

## Azure Functions

### Easy Auth vs App Registration

Azure Functions can be protected two ways:

#### 1. Easy Auth (Simpler, Function App Built-in)

**Audience:** Function App's own client ID or site URL
**Setup:** Enable authentication in Function App settings

```typescript
import { oboTokenForFunction } from '@lance0/latch';

const functionToken = await oboTokenForFunction(request, {
  functionAppId: 'function-app-client-id', // From Azure portal
  functionType: 'easy-auth'
});
```

**Finding Easy Auth Audience:**
```bash
curl https://your-function.azurewebsites.us/.auth/.well-known/openid-configuration
# Look for "client_id" in response
```

#### 2. App Registration (More Control)

**Audience:** Custom App ID URI (e.g., `api://my-function`)
**Setup:** Create separate app registration for Function

```typescript
const functionToken = await oboTokenForFunction(request, {
  functionAppId: 'api://my-function',
  functionType: 'app-registration',
  scopes: ['api://my-function/.default']
});
```

### Calling the Function

```typescript
const response = await fetch('https://my-func.azurewebsites.us/api/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${functionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ data: '...' })
});
```

---

## Certificate Authentication

For IL4/IL5 environments, certificate-based authentication is preferred:

### Why Certificates?

- **No expiration rotation:** Certificates last longer than secrets (365+ days)
- **FIPS compliance:** Certificate-based auth can use FIPS-validated crypto
- **DoD requirements:** Some DoD environments require certificate auth
- **Better security posture:** Private keys never transmitted

### Setup

1. **Generate Certificate:**
   ```bash
   # Generate self-signed certificate (for testing)
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes

   # Get thumbprint
   openssl x509 -in cert.pem -fingerprint -noout | sed 's/://g' | cut -d'=' -f2
   ```

2. **Upload to Azure AD:**
   - Go to your app → **Certificates & secrets** → **Upload certificate**
   - Upload **cert.pem**

3. **Configure Latch:**
   ```typescript
   // In your Latch config
   clientCertificate: {
     privateKey: fs.readFileSync('key.pem', 'utf8'),
     thumbprint: 'ABC123...', // SHA-1 thumbprint from Azure
     x5c: [fs.readFileSync('cert.pem', 'utf8')] // Optional chain
   }
   ```

4. **OBO automatically uses certificate:**
   ```typescript
   // Latch will use certificate instead of secret
   const token = await oboTokenForGraph(request);
   ```

### Certificate Rotation

1. Generate new certificate
2. Upload to Azure AD (both old and new will work)
3. Deploy new certificate to your app
4. Remove old certificate from Azure AD after deployment

---

## Troubleshooting

### Error: "Invalid or missing bearer token"

**Code:** `LATCH_OBO_INVALID_ASSERTION`

**Causes:**
- No `Authorization` header in request
- Token signature verification failed
- Token is expired
- Token is malformed

**Solutions:**
- Ensure client sends `Authorization: Bearer <token>` header
- Check token expiration (`exp` claim)
- Verify JWKS endpoint is reachable
- Check clock skew (default tolerance: 60 seconds)

### Error: "Token audience mismatch"

**Code:** `LATCH_OBO_AUDIENCE_MISMATCH`

**Cause:** Token's `aud` claim doesn't match your API's client ID

**Solutions:**
- Client must request token with `scope=api://your-api/.default`
- Or if using client ID: `scope={your-client-id}/.default`
- Check `allowedAudiences` in config includes correct values
- Verify App ID URI in Azure AD matches what client requests

### Error: "OBO token exchange failed"

**Code:** `LATCH_OBO_EXCHANGE_FAILED`

**Common Causes:**
1. **Missing permissions:**
   - Go to Azure AD → API permissions
   - Add delegated permissions for downstream API
   - Grant admin consent

2. **Wrong client secret/certificate:**
   - Verify `LATCH_CLIENT_SECRET` is correct
   - Check certificate thumbprint matches Azure AD
   - Ensure secret hasn't expired

3. **Consent not granted:**
   - Admin must grant consent for delegated permissions
   - User consent may be required for some scopes

4. **Downstream API not configured:**
   - Ensure downstream API is registered in Azure AD
   - Verify App ID URI or client ID is correct

### Error: "Claims challenge required (CAE)"

**Code:** `LATCH_OBO_CAE_REQUIRED`

**Cause:** Azure AD requires additional claims for this operation

**Solution:**
1. Extract `claims` from error details
2. Return to client with `WWW-Authenticate` header
3. Client requests new token with `claims` parameter
4. Retry OBO with claims

See [CAE section](#cae-continuous-access-evaluation) for full implementation.

### Error: "Token from wrong tenant"

**Code:** `LATCH_OBO_TENANT_MISMATCH`

**Cause:** Token's `tid` claim doesn't match `LATCH_TENANT_ID`

**Solutions:**
- Verify `LATCH_TENANT_ID` matches your Azure AD tenant
- Check token was issued by correct tenant
- Multi-tenant apps: Not supported by default (security design)

### Performance Issues

**Symptoms:** Slow OBO token requests

**Solutions:**

1. **Enable token caching:**
   ```typescript
   // In latch config
   oboCache: {
     enabled: true,
     ttlBufferSeconds: 300, // Expire 5 min early
     maxCacheSize: 1000
   }
   ```

2. **Check cache hit rate:**
   - Same user + resource + scopes = cache hit
   - Different scopes = cache miss
   - Prefer `/.default` for broader caching

3. **Use certificate auth:**
   - Slightly faster than client secret
   - No secret rotation overhead

---

## Security Checklist

Before deploying OBO to production:

- [ ] Client secret or certificate configured (never commit secrets!)
- [ ] Delegated permissions granted in Azure AD
- [ ] Admin consent granted for all required permissions
- [ ] `allowedAudiences` configured if using App ID URI
- [ ] Token caching enabled (`oboCache`)
- [ ] CAE error handling implemented
- [ ] Proper error responses (don't leak internal details)
- [ ] HTTPS enforced (production only)
- [ ] FIPS mode enabled if required (`node --force-fips`)
- [ ] Monitor token exchange failures (logging/alerting)
- [ ] Certificate expiration monitoring (if using certs)
- [ ] Multi-tenant considerations documented (if applicable)

---

## Additional Resources

- [Microsoft OBO Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [Azure AD Token Reference](https://learn.microsoft.com/en-us/azure/active-directory/develop/access-tokens)
- [CAE Overview](https://learn.microsoft.com/en-us/azure/active-directory/conditional-access/concept-continuous-access-evaluation)
- [Latch API Reference](./API_REFERENCE.md)

---

**Questions?** Open an issue on GitHub or check the troubleshooting section above.
