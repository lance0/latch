# Authentication Setup Guide

Latch supports two authentication modes, depending on your Azure AD app registration type.

## Quick Decision Guide

| Your App Registration | Latch Configuration | Authentication Method |
|----------------------|---------------------|----------------------|
| **Platform: Web**<br/>Has client secret | Set `LATCH_CLIENT_SECRET` | Confidential Client |
| **Platform: SPA**<br/>No client secret | Omit `LATCH_CLIENT_SECRET` | Public Client (PKCE) |

## Mode 1: Confidential Client (Most Common for Next.js)

**Use this if you have an existing "Web" app registration with a client secret.**

### Azure AD Setup

1. **Register application** at portal.azure.com (or portal.azure.us for Gov clouds)
2. **Platform type**: Web
3. **Redirect URI**: `http://localhost:3000/api/latch/callback`
4. **Certificates & secrets**:
   - Click "New client secret"
   - Copy the secret **immediately** (shown only once)
5. **Authentication settings**:
   - "Allow public client flows": **No** (default)

### Latch Configuration

```env
# .env.local
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLIENT_SECRET=your-client-secret  # Include this!
LATCH_CLOUD=commercial
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=<generate with: openssl rand -base64 32>
```

### How It Works

1. User clicks "Sign In"
2. Browser redirects to Azure AD
3. User authenticates
4. Azure AD redirects back with authorization code
5. **Server exchanges code + client_secret for tokens**
6. Tokens stored in encrypted cookies

**Security**: Client secret proves your server's identity to Azure AD.

---

## Mode 2: Public Client (PKCE)

**Use this if you prefer not to manage client secrets, or have a "SPA" app registration.**

### Azure AD Setup

1. **Register application** at portal.azure.com (or portal.azure.us)
2. **Platform type**: **Single-page application (SPA)**
   - OR: Web with "Allow public client flows" = **Yes**
3. **Redirect URI**: `http://localhost:3000/api/latch/callback`
4. **Certificates & secrets**:
   - **Do NOT create a client secret**
5. **Authentication settings**:
   - "Allow public client flows": **Yes**

### Latch Configuration

```env
# .env.local
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
# NO LATCH_CLIENT_SECRET - omit this line entirely
LATCH_CLOUD=commercial
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=<generate with: openssl rand -base64 32>
```

### How It Works

1. User clicks "Sign In"
2. Server generates random **code_verifier** (stored in cookie)
3. Server creates **code_challenge** = SHA256(code_verifier)
4. Browser redirects to Azure AD with code_challenge
5. User authenticates
6. Azure AD redirects back with authorization code
7. **Server exchanges code + code_verifier for tokens** (no secret needed)
8. Azure AD verifies SHA256(code_verifier) === code_challenge
9. Tokens stored in encrypted cookies

**Security**: PKCE proves the same server that started the flow is completing it, without needing a long-lived secret.

---

## Comparison

| Aspect | Confidential Client | Public Client (PKCE) |
|--------|---------------------|----------------------|
| **Client Secret** | Required | Not used |
| **Azure AD Platform** | Web | SPA or Web (with public flows enabled) |
| **Secret Management** | Must rotate every 6-24 months | No secrets to manage |
| **Token Endpoint Auth** | `client_id` + `client_secret` | `client_id` + PKCE `code_verifier` |
| **Security Level** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Common For** | Traditional server apps | SPAs, modern frameworks |
| **NextAuth.js Default** | ✅ Uses this | ❌ Doesn't use this |
| **Latch Default** | ✅ Supported | ✅ Supported (default) |

**Both modes are equally secure** when implemented correctly. Choose based on your operational preferences and existing Azure AD setup.

---

## Using the CLI

The CLI wizard will ask which mode you want:

```bash
npx @lance0/latch-cli init
```

You'll be prompted:
```
? Client type:
  > Public Client (PKCE) - No client secret needed. For SPA app registrations.
    Confidential Client (Client Secret) - Uses client secret. For Web app registrations.
```

**Public Client**: Creates `.env.local` without `LATCH_CLIENT_SECRET`
**Confidential Client**: Prompts for secret and includes `LATCH_CLIENT_SECRET=...`

---

## Migration Between Modes

### From PKCE → Confidential Client

1. In Azure AD, create a client secret (Certificates & secrets)
2. Add `LATCH_CLIENT_SECRET=your-secret` to `.env.local`
3. Restart your Next.js app
4. Latch automatically detects the secret and uses confidential client flow

### From Confidential Client → PKCE

1. In Azure AD:
   - Set "Allow public client flows" = **Yes** (under Authentication → Advanced settings)
   - OR: Change platform type to "Single-page application"
2. Remove `LATCH_CLIENT_SECRET` from `.env.local`
3. Restart your Next.js app
4. Latch automatically uses PKCE flow

**No code changes required** - Latch detects the mode based on presence of `LATCH_CLIENT_SECRET`.

---

## Troubleshooting

### Error: "Public clients should not send a client_secret"

**Cause**: Your Azure AD app is configured as SPA/public client, but you're providing `LATCH_CLIENT_SECRET`.

**Fix**: Either:
- Remove `LATCH_CLIENT_SECRET` from `.env.local`, OR
- Change Azure AD platform to "Web" and set "Allow public client flows" = No

### Error: "Clients must send a client_secret when redeeming"

**Cause**: Your Azure AD app requires a client secret, but `LATCH_CLIENT_SECRET` is not set.

**Fix**: Either:
- Add `LATCH_CLIENT_SECRET` to `.env.local` with your client secret, OR
- In Azure AD, set "Allow public client flows" = Yes

### How to check your current mode

```bash
# Check your .env.local file
cat .env.local | grep LATCH_CLIENT_SECRET

# If present → Confidential Client mode
# If absent → Public Client (PKCE) mode
```

When `LATCH_DEBUG=true`, Latch logs the mode at startup:
```
[Latch] Client type: Confidential (with client_secret)
# or
[Latch] Client type: Public (PKCE only)
```

---

## Government Clouds (GCC-High, DoD)

Both modes work identically in Azure Government clouds. The only difference is the portal URL:

- **Commercial**: portal.azure.com
- **GCC-High / DoD**: portal.azure.us

Configuration remains the same:
```env
LATCH_CLOUD=gcc-high  # or 'dod'
```

---

## Client Secret Rotation (Confidential Clients Only)

If you're using confidential client mode with `LATCH_CLIENT_SECRET`, you must rotate the secret periodically.

### Rotation Schedule

Azure AD client secrets expire after:
- **6 months** (minimum)
- **12 months** (recommended)
- **24 months** (maximum)

**Best practice**: Rotate every 6-12 months, even if Azure AD allows longer.

### Zero-Downtime Rotation Process

Azure AD allows **multiple active secrets** simultaneously. Use this for zero-downtime rotation:

#### Step 1: Create New Secret (7+ days before expiration)

1. Go to portal.azure.com → App registrations → Your app
2. Certificates & secrets → New client secret
3. Set expiration (6-12 months recommended)
4. Copy the new secret immediately

**Result**: You now have 2 active secrets - old and new.

#### Step 2: Update Production Environment

Update your production `.env.local` or secrets manager:

```env
# Replace old secret with new secret
LATCH_CLIENT_SECRET=<new-secret-value>
```

**Test thoroughly** in staging first.

#### Step 3: Deploy & Verify

1. Deploy the updated configuration
2. Monitor logs for authentication errors
3. Verify users can sign in successfully
4. Wait 24-48 hours to ensure stability

#### Step 4: Delete Old Secret

Once the new secret is verified working:

1. Return to Azure AD → Certificates & secrets
2. Delete the old expired/expiring secret
3. Keep the new secret active

### Automation Options

#### Option 1: Azure Key Vault

Store secret in Key Vault with automatic rotation:

```typescript
// Read from Key Vault instead of .env
import { SecretClient } from '@azure/keyvault-secrets';

const client = new SecretClient(vaultUrl, credential);
const secret = await client.getSecret('latch-client-secret');

process.env.LATCH_CLIENT_SECRET = secret.value;
```

#### Option 2: Calendar Reminder

Set a recurring calendar reminder 7 days before expiration:
- Title: "Rotate Latch Client Secret"
- Frequency: Every 6 months
- Include: Link to Azure AD portal

#### Option 3: Monitoring Alert

Create an Azure Monitor alert when secret expiration < 14 days.

### Emergency Rotation

If you suspect secret compromise:

1. **Immediately create new secret** in Azure AD
2. **Deploy new secret** to all environments ASAP
3. **Delete compromised secret** after deployment
4. **Monitor** for unauthorized access attempts
5. **Review** logs for suspicious activity

### Rotation Checklist

- [ ] Create new secret in Azure AD (7+ days before expiration)
- [ ] Test new secret in staging environment
- [ ] Update production `.env.local` or secrets manager
- [ ] Deploy to production
- [ ] Monitor for 24-48 hours
- [ ] Verify authentication working correctly
- [ ] Delete old secret from Azure AD
- [ ] Document rotation date
- [ ] Set calendar reminder for next rotation (6 months)

---

## Security Notes

### Confidential Client

✅ **Pros**:
- More familiar to enterprise teams
- Matches traditional OAuth 2.0 patterns
- Explicit server authentication

❌ **Cons**:
- Secrets must be rotated (Azure AD requires renewal every 6-24 months)
- Secret leakage risk (logs, environment variables, commits)
- Requires secret management infrastructure

**Secret rotation required every 6-12 months** - see section above.

### Public Client (PKCE)

✅ **Pros**:
- No secrets to manage or rotate
- No risk of secret leakage
- Follows OAuth 2.1 recommendations
- Simpler operational model
- **No rotation required** - code_verifier is generated fresh for each login

❌ **Cons**:
- Less familiar to some enterprise teams
- Not all Azure AD tooling supports it yet

**OAuth 2.1 Recommendation**: Use PKCE for all client types, including confidential clients. Latch follows this recommendation by defaulting to PKCE, while supporting client secrets for compatibility.

---

## References

- [RFC 7636 - Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth 2.1 - Authorization Code Flow](https://oauth.net/2.1/)
- [Azure AD Public vs Confidential Clients](https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-applications)
- [Microsoft: PKCE Support in Azure AD](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
