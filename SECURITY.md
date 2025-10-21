# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Model

### Threat Model

Latch is designed to protect against:

- **CSRF attacks** - State parameter validation, SameSite cookies
- **XSS token theft** - HttpOnly cookies, server-side tokens in default mode
- **Open redirect** - Return URL whitelist with same-origin validation
- **Token replay** - Nonce validation, single-use authorization codes
- **Scope escalation** - Cloud-aware scope validation
- **Cookie tampering** - AES-GCM authenticated encryption
- **Token exposure** - Refresh tokens never sent to client; access tokens only in Direct Token mode

### Security Features

1. **PKCE S256 Required**
   - No fallback to less secure flows
   - Code verifier: 32 bytes random (43 base64url chars)
   - Challenge method: SHA-256

2. **Encrypted Cookie Storage**
   - Algorithm: AES-GCM-256
   - Key derivation: PBKDF2 (100,000 iterations)
   - IV: Random 96 bits per encryption
   - Authentication: 128-bit auth tag

3. **Cookie Security**
   - `HttpOnly`: true (not accessible to JavaScript)
   - `Secure`: true in production (HTTPS only)
   - `SameSite`: Lax (CSRF protection)
   - `Path`: /
   - `MaxAge`: 7 days (refresh token), 10 minutes (PKCE data)

4. **ID Token Validation**
   - JWKS verification via `jose` library
   - Audience claim validation
   - Nonce validation
   - Expiration check
   - Clock skew tolerance: 60 seconds

5. **Return URL Validation**
   - Same-origin enforcement
   - No cross-origin redirects
   - Protocol validation (blocks javascript:, data:, etc.)

### What We DON'T Do

To maintain transparency and audit-ability:

- **No token logging** - Tokens never appear in console logs, even in debug mode
- **No automatic token refresh in browser** - Client must call `/api/latch/refresh` explicitly
- **No localStorage** - All sensitive data in HttpOnly cookies
- **No session management** - Stateless; relies on Azure AD sessions

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, email: `security@latch.dev` (or the maintainer directly)

Include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### Response SLA

- **Critical vulnerabilities:** Response within 24 hours, fix within 7 days
- **High-priority vulnerabilities:** Response within 3 days, fix within 14 days
- **Medium/Low vulnerabilities:** Response within 7 days, fix in next minor release

### Disclosure Policy

We follow **coordinated disclosure**:

1. Researcher reports vulnerability privately
2. We confirm and develop a fix
3. Fix is released in a security patch
4. 30 days after patch release, we publish an advisory
5. Researcher receives credit in SECURITY.md and release notes (if desired)

## Security Checklist for Production

Before deploying Latch in production:

- [ ] `LATCH_COOKIE_SECRET` is 32+ bytes and randomly generated
- [ ] `NODE_ENV=production` (enables Secure cookies)
- [ ] HTTPS is enforced (Latch will not work over HTTP in production)
- [ ] Azure AD app registration has correct redirect URI
- [ ] Cloud configuration matches Azure AD tenant (commercial vs GCC-High vs DoD)
- [ ] Scopes use correct Graph endpoint (.com vs .us)
- [ ] `LATCH_DEBUG=false` in production
- [ ] Content Security Policy configured (if applicable)
- [ ] FIPS mode enabled if required (`node --force-fips`, IL4+)

## Security Reviews

### Internal Testing

- All crypto functions have unit tests
- PKCE implementation tested against RFC 7636 test vectors
- State/nonce validation tested for bypasses
- Return URL validation tested for open redirect vectors

### External Reviews

- **v0.1**: No external review yet (seeking reviewers)
- **v1.0**: Third-party security review planned

## Known Limitations

1. **ID Token Validation**
   - We trust the `jose` library for JWKS validation
   - No certificate pinning (relies on Azure AD's PKI)

2. **Refresh Token Rotation**
   - Azure AD may or may not issue new refresh tokens
   - We handle both cases but don't enforce rotation

3. **Session Invalidation**
   - Logout clears cookies but doesn't revoke tokens at Azure AD
   - Tokens remain valid until expiration

4. **FIPS Compliance**
   - Node.js crypto can be FIPS-compliant when run with `--force-fips`
   - We do not enforce FIPS mode ourselves

## Security Hall of Fame

Thank you to the following researchers for responsibly disclosing vulnerabilities:

_(None yet — be the first!)_

---

**Last updated:** 2025-10-21
