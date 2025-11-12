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
- **Token confusion attacks** - Strict issuer validation, tenant/cloud verification (v0.4.1+)

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
   - **Issuer validation** - Prevents token confusion attacks (v0.4.1+)
   - **Tenant validation** - Ensures token is from expected tenant (v0.4.1+)
   - **Cloud validation** - Prevents commercial/government cloud mismatch (v0.4.1+)
   - Clock skew tolerance: configurable (default: 60 seconds)

5. **Token Confusion Attack Prevention (v0.4.1+)**
   
   Token confusion attacks occur when an application accepts tokens from unintended issuers or tenants.
   
   **Attack Scenarios:**
   - Multi-tenant application accepts token from wrong tenant
   - Application misconfigured for wrong cloud (commercial vs government)
   - Attacker obtains valid token from different tenant and replays it
   
   **Latch Protections:**
   - Strict issuer validation against expected tenant and cloud
   - Automatic detection of cloud mismatches (`.com` vs `.us`)
   - Clear error messages indicating the specific mismatch
   - Configurable via `validateIssuer()` helper function
   
   **Example:**
   ```typescript
   // Automatic validation in verifyIdToken()
   const user = await verifyIdToken(
     tokens.id_token,
     endpoints.jwksUri,
     config.clientId,
     pkceData.nonce,
     {
       tenantId: config.tenantId,  // Validates token from correct tenant
       cloud: config.cloud,         // Validates token from correct cloud
     }
   );
   
   // Manual validation for custom scenarios
   import { validateIssuer } from '@lance0/latch';
   validateIssuer(payload.iss, expectedTenantId, expectedCloud);
   ```
   
   **Best Practices:**
   - Always pass `tenantId` and `cloud` options to `verifyIdToken()`
   - Use `validateIssuer()` when manually validating tokens
   - Never trust token claims without verifying issuer first
   - Log and alert on issuer validation failures (potential attack)

6. **Return URL Validation**
   - Same-origin enforcement
   - No cross-origin redirects
   - Protocol validation (blocks javascript:, data:, etc.)

### What We DON'T Do

To maintain transparency and audit-ability:

- **No token logging** - Tokens never appear in console logs, even in debug mode
- **No automatic token refresh in browser** - Client must call `/api/latch/refresh` explicitly
- **No localStorage** - All sensitive data in HttpOnly cookies
- **No session management** - Stateless; relies on Azure AD sessions

## Compliance Considerations

**Important:** Latch provides authentication patterns aligned with Azure Government security requirements, but **does not certify IL4/IL5 compliance**. Compliance is a system-wide concern that requires proper security controls, policies, and procedures across your entire application, infrastructure, and organization.

### What Latch Provides

Latch implements authentication security best practices suitable for government environments:

- ✅ **Government cloud endpoint configuration** - Native support for GCC-High (IL4) and DoD (IL5)
- ✅ **Secure token handling** - HttpOnly cookies, server-side storage, no localStorage
- ✅ **Industry-standard cryptography** - AES-GCM-256 encryption, PKCE S256 flow (RFC 7636)
- ✅ **OAuth 2.0 best practices** - State/nonce validation, secure redirects, scope validation
- ✅ **Audit-friendly logging** - Structured debug logs with token redaction

### Your Compliance Responsibilities

Latch handles **authentication** (proving who the user is). You are responsible for:

- **Authorization** - Implementing role-based access control (RBAC) and attribute-based access control (ABAC)
- **FIPS 140-2 compliance** - Running Node.js with `--force-fips` flag if required (see FIPS section below)
- **Audit logging** - Recording authentication events per your ATO requirements (login, logout, token refresh)
- **Data residency** - Ensuring data stays within authorized regions (application data, not auth tokens)
- **Network controls** - Firewalls, VPNs, private endpoints as required by your environment
- **Security assessment** - Reviewing Latch's security model against your threat model
- **Vulnerability management** - Monitoring for security updates and applying patches
- **Configuration security** - Protecting `LATCH_COOKIE_SECRET` and other secrets

### FIPS 140-2 Support

For DoD IL5 and some IL4 environments, FIPS-validated cryptography is required:

**How to enable FIPS mode:**
```bash
node --force-fips your-app.js
```

**What this does:**
- Forces Node.js to use OpenSSL's FIPS-validated module
- Latch's AES-GCM, SHA-256, and PBKDF2 operations will use FIPS implementations
- Requires OpenSSL compiled with FIPS support in your environment

**Testing FIPS mode:**
```bash
node --force-fips -e "console.log(require('crypto').getFips())"
# Should output: 1
```

**Note:** FIPS compliance requires a FIPS-validated OpenSSL module in your environment (Azure App Service, Azure Container Apps, or custom Docker image with FIPS OpenSSL).

### IL4/IL5 Guidance

If deploying to GCC-High (IL4) or DoD (IL5) environments:

1. **Use correct cloud configuration:**
   ```bash
   LATCH_CLOUD=gcc-high  # or dod
   ```

2. **Ensure Azure AD tenant is in government cloud** - Register apps at portal.azure.us, not portal.azure.com

3. **Review data flow** - Tokens flow between your app and Azure AD's government endpoints only

4. **Document authentication architecture** - Include Latch's security model in your SSP (System Security Plan)

5. **Security assessment** - Have your security team review the threat model and security features documented in this file

6. **Ongoing maintenance** - Subscribe to security advisories and apply updates promptly

### Compliance Resources

- [Azure Government Compliance](https://learn.microsoft.com/en-us/azure/compliance/)
- [NIST 800-53 Controls](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [FedRAMP Security Controls](https://www.fedramp.gov/documents/)

**Latch is a building block, not a complete compliance solution.** Consult your security team and compliance officers to ensure your complete system meets your authorization requirements.

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, email: **lance@lance0.com**

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

**Last updated:** 2025-10-23
