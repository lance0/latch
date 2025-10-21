# Troubleshooting Guide

This guide covers common issues you might encounter when using Latch and how to resolve them.

## Table of Contents

1. [Configuration Errors](#configuration-errors)
2. [OAuth Flow Issues](#oauth-flow-issues)
3. [Token Problems](#token-problems)
4. [Cookie Issues](#cookie-issues)
5. [Cloud-Specific Problems](#cloud-specific-problems)
6. [Development vs Production](#development-vs-production)
7. [Debugging Tips](#debugging-tips)

---

## Configuration Errors

### Error: `LATCH_CLIENT_ID_MISSING`

**Symptoms:**
- Application crashes on startup
- Error message about missing Client ID

**Solution:**
```bash
# 1. Go to Azure Portal → App Registrations
# 2. Copy the "Application (client) ID" (UUID format)
# 3. Add to .env

LATCH_CLIENT_ID=00000000-0000-0000-0000-000000000000
```

**Common mistakes:**
- Using Object ID instead of Application ID
- Missing hyphens in the UUID
- Extra spaces or quotes

---

### Error: `LATCH_CLOUD_INVALID`

**Symptoms:**
- Error: "LATCH_CLOUD must be one of: commercial, gcc-high, dod"
- Application won't start

**Solution:**
```bash
# Valid options (case-sensitive):
LATCH_CLOUD=commercial   # Azure Public Cloud
LATCH_CLOUD=gcc-high     # Azure Government GCC-High
LATCH_CLOUD=dod         # Azure Government DoD
```

**Common mistakes:**
- Typos: `gcc-High` (wrong), `GCC-HIGH` (wrong)
- Using `gov` instead of `gcc-high`
- Using `government` instead of specific cloud type

**"Did you mean?" examples:**
- `gcc` → Did you mean `gcc-high`?
- `commercial-cloud` → Did you mean `commercial`?

---

### Error: `Cloud/Scope Mismatch`

**Symptoms:**
- Error mentions `.com` vs `.us` endpoints
- "Government clouds require .us endpoints"

**Solution:**
```bash
# ✅ CORRECT: Use simple scope names (recommended)
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile User.Read

# ❌ WRONG: Explicit .com URL in Gov cloud
LATCH_CLOUD=gcc-high
LATCH_SCOPES=https://graph.microsoft.com/User.Read

# ✅ CORRECT: Explicit .us URL
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile https://graph.microsoft.us/User.Read
```

**Common mistakes:**
- Copy-pasting scopes from commercial Azure docs into GCC-High
- Using `graph.microsoft.com` in any Gov cloud
- Using `graph.microsoft.us` in commercial cloud

---

### Error: `LATCH_COOKIE_SECRET_MISSING` or "too short"

**Symptoms:**
- Application crashes on startup
- Warning about weak secret in production

**Solution:**
```bash
# Generate a secure secret
openssl rand -base64 32

# Add to .env (NEVER commit to git)
LATCH_COOKIE_SECRET=your-generated-secret-here
```

**Common mistakes:**
- Using `test` or `secret` as the value
- Secret less than 32 characters
- Committing secret to git

---

## OAuth Flow Issues

### Error: "OAuth callback was called directly"

**Symptoms:**
- `LATCH_STATE_MISSING` error
- User sees error immediately after clicking sign-in

**Causes:**
1. User navigated directly to `/api/latch/callback`
2. Cookies disabled in browser
3. PKCE cookie expired (10 min timeout)

**Solution:**
```typescript
// Always start the flow from /api/latch/start
window.location.href = '/api/latch/start';

// Or use the button from LatchProvider
const { signIn } = useLatch();
signIn(); // Handles the flow correctly
```

---

### Error: `LATCH_STATE_MISMATCH` (CSRF Protection)

**Symptoms:**
- Error after redirecting back from Azure AD
- "OAuth State Mismatch" message

**Causes:**
1. CSRF attack attempt (security working correctly!)
2. Callback URL opened in different browser session
3. Cookie tampering

**Solution:**
- Start a fresh OAuth flow from `/api/latch/start`
- Clear cookies and try again
- If persistent, check for cookie domain issues

**Security note:** This error is intentional. Do not disable it.

---

### Error: `LATCH_CODE_MISSING`

**Symptoms:**
- Callback completes but no authorization code
- User may have seen Azure AD error

**Causes:**
1. User denied consent at Azure AD
2. Redirect URI mismatch
3. App not authorized in Azure AD

**Solution:**
```bash
# 1. Check redirect URI in Azure Portal matches exactly
# Azure AD → App Registrations → Authentication → Redirect URIs

# Should match:
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback

# 2. Ensure user has permission to consent
# 3. Check Azure AD logs for detailed error
```

---

### Error: `LATCH_TOKEN_EXCHANGE_FAILED`

**Symptoms:**
- Callback receives code but can't exchange for tokens
- 400 or 401 error from Azure AD

**Causes:**
1. Client ID mismatch
2. Redirect URI not registered
3. Authorization code already used
4. Azure AD outage

**Solution:**
```bash
# 1. Verify Client ID matches Azure AD exactly
LATCH_CLIENT_ID=<copy from Azure Portal>

# 2. Check redirect URI is registered
# Azure Portal → App Registrations → Authentication

# 3. Enable debug mode to see full error
LATCH_DEBUG=true

# 4. Check Azure AD service status
# https://status.azure.com
```

---

## Token Problems

### Error: `LATCH_TOKEN_REFRESH_FAILED`

**Symptoms:**
- User authenticated but tokens won't refresh
- Forced to sign in again frequently

**Causes:**
1. Refresh token expired (typically 90 days)
2. User revoked consent
3. Azure AD policy changed
4. App credentials rotated

**Solution:**
```typescript
// Redirect user to sign in again
const { signIn } = useLatch();

if (error.code === 'LATCH_TOKEN_REFRESH_FAILED') {
  signIn(); // Start fresh auth flow
}
```

**Prevention:**
- Use `offline_access` scope for long-lived refresh tokens
- Implement graceful error handling in `useAccessToken`

---

### Token expires too quickly

**Symptoms:**
- Access token expires in 1 hour (expected)
- App breaks when token expires

**Solution:**
```typescript
// Use auto-refresh (enabled by default)
const { accessToken } = useAccessToken({
  autoRefresh: true,  // Default: true
  refreshThreshold: 300, // Refresh 5 min before expiry
});

// Or use Secure Proxy mode (no tokens in browser)
// Call /api/me which handles refresh server-side
```

---

## Cookie Issues

### Cookies not persisting

**Symptoms:**
- User signs in but immediately signed out
- Cookies disappear between requests

**Causes:**
1. SameSite cookie restrictions
2. HTTPS required in production
3. Cookie domain mismatch
4. Browser blocking third-party cookies

**Solution:**
```typescript
// 1. Ensure using HTTPS in production
// Latch sets `secure: true` automatically

// 2. Check cookie settings in browser (should allow first-party)

// 3. Verify domain matches
// If using subdomain, cookies may not work

// 4. Check SameSite=Lax is supported
// Most browsers support this
```

---

### Error: `LATCH_DECRYPTION_FAILED`

**Symptoms:**
- "Failed to decrypt cookie data"
- User forced to sign in again

**Causes:**
1. Cookie tampered with (security working!)
2. `LATCH_COOKIE_SECRET` changed
3. Corrupted cookie

**Solution:**
```bash
# If you rotated the secret:
# 1. Users need to sign in again (expected)
# 2. Clear all cookies for your domain
# 3. Ensure new secret is deployed everywhere

# If unexpected:
# 1. Check for cookie tampering (security issue)
# 2. Verify secret is consistent across servers
```

---

## Cloud-Specific Problems

### GCC-High: "Tenant not found"

**Symptoms:**
- Error from Azure AD: Tenant does not exist
- 400 error during OAuth flow

**Solution:**
```bash
# Ensure you're using the GCC-High tenant ID
# NOT the commercial tenant ID

# GCC-High tenants end in .us, not .com
# Check: Azure Government Portal (https://portal.azure.us)

LATCH_CLOUD=gcc-high
LATCH_TENANT_ID=<your-gcc-high-tenant-id>
```

---

### DoD: Graph API returns 401

**Symptoms:**
- Authentication works
- Graph API calls fail with 401

**Solution:**
```bash
# DoD uses different Graph endpoint
LATCH_CLOUD=dod

# Latch automatically uses:
# https://dod-graph.microsoft.us

# Verify scopes don't have .com URLs
LATCH_SCOPES=openid profile User.Read
```

---

## Development vs Production

### Works in development, breaks in production

**Common differences:**

| Issue | Development | Production | Solution |
|-------|------------|------------|----------|
| Cookies | `secure: false` | `secure: true` | Use HTTPS in prod |
| Redirect URI | localhost:3000 | yourdomain.com | Update Azure AD + .env |
| Debug logs | Verbose | Silent | Set `LATCH_DEBUG=true` temporarily |
| Secret strength | Any | Must be strong | Use `openssl rand -base64 32` |

---

### HTTPS required errors

**Symptoms:**
- Cookies not setting in production
- "Secure cookie requires HTTPS"

**Solution:**
```bash
# Ensure your production environment uses HTTPS
# Latch automatically enables `secure` cookies when NODE_ENV=production

# If behind a proxy (Vercel, CloudFlare, etc):
# Ensure X-Forwarded-Proto header is set
```

---

## Debugging Tips

### Enable Debug Mode

```bash
# .env
LATCH_DEBUG=true
```

**What you'll see:**
```
[Latch] Configuration loaded successfully
[Latch] Cloud: gcc-high
[Latch] Scopes: openid profile User.Read
[Latch] Redirect URI: https://yourapp.com/api/latch/callback
[Latch] Token refreshed successfully
```

**Note:** Tokens are NEVER logged, even in debug mode.

---

### Check Cookies in Browser

```javascript
// In browser console:
document.cookie.split(';').filter(c => c.includes('latch'))

// Should see:
// latch_rt=<encrypted>
// latch_id=<encrypted>
```

---

### Inspect Network Requests

1. Open DevTools → Network tab
2. Filter by `/api/latch`
3. Check status codes:
   - `/api/latch/start` → 302 redirect to Azure AD
   - `/api/latch/callback` → 302 redirect to `returnTo`
   - `/api/latch/session` → 200 with user data

---

### Check Azure AD Logs

```
Azure Portal → Azure Active Directory → Sign-ins

Filter by:
- Application: <your LATCH_CLIENT_ID>
- User: <test user email>
- Date: Last hour

Look for failed sign-ins with error codes
```

---

### Common Error Code Reference

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `LATCH_CLIENT_ID_MISSING` | Missing or invalid Client ID | Check .env |
| `LATCH_CLOUD_MISMATCH` | Scope doesn't match cloud | Fix LATCH_SCOPES |
| `LATCH_STATE_MISMATCH` | CSRF protection triggered | Start fresh flow |
| `LATCH_TOKEN_EXCHANGE_FAILED` | Can't get tokens from Azure AD | Check Azure AD config |
| `LATCH_REFRESH_TOKEN_MISSING` | User not authenticated | Call signIn() |
| `LATCH_DECRYPTION_FAILED` | Cookie tampered or secret changed | Clear cookies |

---

### Test with curl

```bash
# Test session endpoint
curl -i http://localhost:3000/api/latch/session \
  -H "Cookie: latch_id=<copy from browser>"

# Should return 200 with user data or 401 if not authenticated
```

---

### Validate Configuration

```typescript
import { validateLatchConfig } from '@/lib/latch';

// Run at startup to catch config errors early
try {
  validateLatchConfig({
    clientId: process.env.LATCH_CLIENT_ID,
    tenantId: process.env.LATCH_TENANT_ID,
    cloud: process.env.LATCH_CLOUD,
    cookieSecret: process.env.LATCH_COOKIE_SECRET,
  });
  console.log('✅ Latch configuration valid');
} catch (error) {
  console.error('❌ Latch configuration error:', error.message);
  process.exit(1);
}
```

---

## Still Having Issues?

1. **Check the error code** - Latch errors include suggestions
2. **Enable debug mode** - `LATCH_DEBUG=true`
3. **Review Azure AD logs** - Portal → Sign-ins
4. **Check GitHub Issues** - https://github.com/yourusername/latch/issues
5. **Read the source** - All code is in `lib/latch/`

## Quick Fixes Checklist

- [ ] All environment variables set in `.env`
- [ ] `LATCH_CLOUD` matches your Azure environment
- [ ] `LATCH_SCOPES` don't have explicit `.com` in Gov clouds
- [ ] `LATCH_COOKIE_SECRET` is at least 32 characters
- [ ] Redirect URI registered in Azure AD
- [ ] Using HTTPS in production
- [ ] Cookies enabled in browser
- [ ] `pnpm install` run after updating dependencies
- [ ] Next.js dev server restarted after `.env` changes
