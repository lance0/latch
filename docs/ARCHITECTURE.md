# Latch Architecture

This document describes the technical implementation of Latch's authentication flows.

## System Architecture

```
┌─────────────────┐
│  Next.js Client │
│  (Browser)      │
└────────┬────────┘
         │
         │ 1. GET /api/latch/start
         ▼
┌─────────────────┐
│  Latch Routes   │
│  (Next.js API)  │
└────────┬────────┘
         │
         │ 2. Redirect to Azure AD
         ▼
┌─────────────────┐
│   Azure AD      │
│  (GCC-High)     │
└────────┬────────┘
         │
         │ 3. User authenticates
         │ 4. Redirect to /callback
         ▼
┌─────────────────┐
│  /api/latch/    │
│  callback       │
└────────┬────────┘
         │
         │ 5. Exchange code for tokens
         │ 6. Store refresh token (encrypted)
         ▼
┌─────────────────┐
│  HttpOnly       │
│  Cookies        │
└─────────────────┘
```

## PKCE Flow (RFC 7636)

### Step 1: Start

**Request:** `GET /api/latch/start?returnTo=/dashboard`

**Actions:**
1. Generate code verifier (32 random bytes → base64url)
2. Generate code challenge: `BASE64URL(SHA256(verifier))`
3. Generate state (32 random bytes → base64url)
4. Generate nonce (32 random bytes → base64url)
5. Encrypt and store PKCE data in cookie:
   ```json
   {
     "codeVerifier": "...",
     "state": "...",
     "nonce": "...",
     "returnTo": "/dashboard"
   }
   ```
6. Redirect to Azure AD authorize endpoint

**Azure AD URL:**
```
https://login.microsoftonline.us/{tenant}/oauth2/v2.0/authorize?
  client_id={clientId}
  &response_type=code
  &redirect_uri={redirectUri}
  &scope=openid%20profile%20User.Read
  &state={state}
  &nonce={nonce}
  &code_challenge={challenge}
  &code_challenge_method=S256
  &response_mode=query
```

### Step 2: Callback

**Request:** `GET /api/latch/callback?code=...&state=...`

**Actions:**
1. Validate state parameter matches cookie
2. Retrieve PKCE data from cookie
3. Exchange authorization code for tokens:
   ```http
   POST https://login.microsoftonline.us/{tenant}/oauth2/v2.0/token
   Content-Type: application/x-www-form-urlencoded

   client_id={clientId}
   &scope=openid profile offline_access User.Read
   &code={code}
   &redirect_uri={redirectUri}
   &grant_type=authorization_code
   &code_verifier={codeVerifier}
   ```
4. Verify ID token (JWKS, nonce, audience, expiration)
5. Encrypt and store refresh token in cookie
6. Encrypt and store user info (from ID token) in cookie
7. Delete PKCE cookie
8. Redirect to `returnTo` URL

**Cookies set:**
- `latch_rt`: Encrypted refresh token
- `latch_id`: Encrypted ID token claims (user info)

### Step 3: Access Protected Resources

**Secure Proxy Mode (Default):**

Client → `/api/me` → Latch gets refresh token → Refreshes access token → Calls Graph → Returns data

**Direct Token Mode:**

Client → `/api/latch/refresh` → Returns access token → Client calls Graph directly

## Cookie Encryption (AES-GCM)

### Seal (Encrypt)

```typescript
function seal(data, secret):
  1. JSON.stringify(data)
  2. Derive AES-256 key from secret (PBKDF2, 100k iterations)
  3. Generate random IV (12 bytes)
  4. Encrypt with AES-GCM (256-bit key, 128-bit auth tag)
  5. Return: base64url(IV || authTag || ciphertext)
```

### Unseal (Decrypt)

```typescript
function unseal(sealed, secret):
  1. base64url decode
  2. Extract IV (12 bytes), authTag (16 bytes), ciphertext
  3. Derive same AES-256 key from secret
  4. Decrypt and verify auth tag
  5. JSON.parse(plaintext)
```

**Why AES-GCM?**
- Authenticated encryption (prevents tampering)
- Built into Web Crypto API
- FIPS-approved
- Faster than AES-CBC + HMAC

## Token Validation

### ID Token Verification

1. Fetch JWKS from Azure AD:
   ```
   https://login.microsoftonline.us/{tenant}/discovery/v2.0/keys
   ```

2. Verify JWT signature using `jose`:
   - Algorithm: RS256
   - Key: Retrieved from JWKS
   - Audience: `{clientId}`
   - Issuer: `https://login.microsoftonline.us/{tenant}/v2.0`

3. Validate claims:
   - `aud` matches `clientId`
   - `nonce` matches expected nonce
   - `exp` > current time (with 60s tolerance)
   - `iat` < current time

4. Extract user info:
   - `sub`: User's object ID
   - `email`: User's email
   - `name`: Display name
   - `preferred_username`: UPN

### Refresh Token Flow

**Request:** `POST /api/latch/refresh`

**Actions:**
1. Get refresh token from cookie
2. Call Azure AD token endpoint:
   ```http
   POST https://login.microsoftonline.us/{tenant}/oauth2/v2.0/token

   client_id={clientId}
   &scope=openid profile offline_access User.Read
   &refresh_token={refreshToken}
   &grant_type=refresh_token
   ```
3. If new refresh token issued, update cookie
4. Return access token (Direct Token mode) or use server-side (Secure Proxy mode)

## Cloud-Specific Endpoints

| Cloud      | Login Base URL                   | Graph Base URL               |
|------------|----------------------------------|------------------------------|
| Commercial | login.microsoftonline.com        | graph.microsoft.com          |
| GCC-High   | login.microsoftonline.us         | graph.microsoft.us           |
| DoD        | login.microsoftonline.us         | dod-graph.microsoft.us       |

**Scope Validation:**

- Blocks `.com` Graph scopes when `cloud=gcc-high` or `cloud=dod`
- Blocks `.us` Graph scopes when `cloud=commercial`
- Prevents accidental cross-cloud scope mismatches

## Middleware

**Route Protection:**

```typescript
export function middleware(request: NextRequest) {
  const hasRefreshToken = request.cookies.has('latch_rt');

  if (!hasRefreshToken) {
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(`/api/latch/start?returnTo=${returnTo}`);
  }

  return NextResponse.next();
}
```

**Matcher Configuration:**

```typescript
export const config = {
  matcher: ['/dashboard/:path*']
};
```

Only runs on matched routes, ignoring:
- `/api/latch/*` (infinite redirect prevention)
- `/_next/*` (Next.js internals)
- Static files

## Error Handling

### Error Codes

- `LATCH_CONFIG_MISSING` - Environment variables not set
- `LATCH_CLOUD_MISMATCH` - Scope uses wrong cloud endpoint
- `LATCH_STATE_MISMATCH` - CSRF attempt or cookie loss
- `LATCH_PKCE_MISSING` - Cookie expired or cleared
- `LATCH_TOKEN_EXCHANGE_FAILED` - Azure AD rejected code
- `LATCH_TOKEN_REFRESH_FAILED` - Refresh token expired/revoked
- `LATCH_INVALID_RETURN_URL` - Open redirect attempt
- `LATCH_ID_TOKEN_INVALID` - JWT verification failed

### Debug Mode

Set `LATCH_DEBUG=true` to enable verbose logging:

```
[Latch] Starting OAuth flow: { cloud: 'gcc-high', ... }
[Latch] OAuth callback successful: { user: 'john@example.us', returnTo: '/dashboard' }
[Latch] Token refreshed successfully
```

**What is NOT logged:**
- Access tokens
- Refresh tokens
- Code verifiers
- Cookie secrets

## Security Properties

### Confidentiality

- Refresh tokens: Encrypted at rest (AES-GCM), never exposed to client
- Access tokens: Server-side only (Secure Proxy mode) or short-lived in memory (Direct Token mode)
- ID tokens: Encrypted in cookie (contains user info, not credentials)

### Integrity

- Cookie tampering detected via AES-GCM auth tag
- State parameter prevents CSRF
- Nonce prevents token replay

### Availability

- No server-side session storage (stateless)
- Cookies survive page refreshes
- Automatic token refresh (Direct Token mode)

## Performance Considerations

### Cookie Size

- `latch_rt`: ~500 bytes (encrypted refresh token)
- `latch_id`: ~800 bytes (encrypted user info)
- `latch_pkce`: ~400 bytes (temporary, 10 min TTL)

Total: ~1.7 KB (well under 4 KB browser limit)

### Latency

- **Initial sign-in:** 2 redirects (start → Azure AD → callback)
- **Refresh:** 1 round-trip to Azure AD token endpoint (~200ms)
- **Session check:** Read cookie + decrypt (~5ms)

### Caching

- JWKS: Cached by `jose` library (default 60s TTL)
- Access tokens: Not cached by Latch (short TTL, better security)

## Deployment Considerations

### HTTPS Requirement

- `Secure` cookies only work over HTTPS
- Local development: HTTP allowed (`NODE_ENV=development`)
- Production: HTTPS enforced automatically

### FIPS Mode

For IL4/IL5 compliance:

```bash
node --force-fips server.js
```

Latch uses Node.js native crypto, which becomes FIPS-compliant in this mode.

### Scaling

- **Stateless:** No shared session store needed
- **Horizontal scaling:** Works out of the box (cookies carry all state)
- **CDN-friendly:** Static assets cacheable, auth routes bypass CDN

## Testing

### Unit Tests

- Crypto: Seal/unseal, PKCE generation, random generation
- Validation: State, nonce, return URL, scope validation
- Config: Endpoint generation, cloud mapping

### Integration Tests (Future)

- Mock OIDC server
- Full auth flow (start → callback → refresh → logout)
- Cookie lifecycle

### Security Tests (Future)

- CSRF attack simulation
- Cookie tampering detection
- Open redirect prevention
- Token exposure checks

---

**Version:** 0.1.0
**Last updated:** 2025-10-21
