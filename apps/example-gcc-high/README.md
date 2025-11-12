# Latch Example - Azure Government Cloud (GCC-High)

Example Next.js application demonstrating Latch authentication with **Azure Government Cloud (GCC-High)**.

## Prerequisites

⚠️ **Important:** GCC-High requires:
- Azure Government subscription (separate from Commercial)
- IL4 (Impact Level 4) compliance requirements
- Microsoft 365 GCC-High licenses for users
- Cannot be mixed with Commercial cloud

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Azure AD Government

Create an app registration in the [Azure Government Portal](https://portal.azure.us):

1. Go to **Azure Active Directory** > **App registrations** > **New registration**
2. Name: `Latch Example GCC-High`
3. Supported account types: **Accounts in this organizational directory only**
4. Redirect URI: 
   - Platform: **Web**
   - URI: `http://localhost:3000/api/latch/callback`
5. Click **Register**

After registration:
- Copy the **Application (client) ID**
- Copy the **Directory (tenant) ID**
- (Optional) Create a **Client secret** under **Certificates & secrets**

### 3. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Azure Government details:

```env
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile email User.Read offline_access
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=$(openssl rand -base64 32)
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## What's Included

This example demonstrates:

- ✅ **GCC-High Cloud** endpoints (`login.microsoftonline.us`)
- ✅ **Microsoft Graph Government** (`graph.microsoft.us`)
- ✅ **Server Actions** examples
- ✅ **PKCE flow** with secure cookies
- ✅ **Session management** and refresh tokens
- ✅ **Protected routes** with authentication guards
- ✅ **IL4 compliance** patterns

## Key Differences from Commercial

| Feature | Commercial | GCC-High |
|---------|-----------|----------|
| Login endpoint | `login.microsoftonline.com` | `login.microsoftonline.us` |
| Graph API | `graph.microsoft.com` | `graph.microsoft.us` |
| Compliance | General use | IL4 (DoD Impact Level 4) |
| Subscription | Standard Azure | Azure Government |
| User licenses | Microsoft 365 | Microsoft 365 GCC-High |
| Portal | portal.azure.com | portal.azure.us |
| Tenant isolation | Multi-tenant capable | Government-only |

## GCC-High Compliance Notes

**IL4 Requirements:**
- Physical and logical isolation from commercial cloud
- Background-screened US personnel
- FIPS 140-2 validated cryptography
- FedRAMP High authorization

**Latch provides:**
- ✅ Correct government endpoints
- ✅ FIPS-compatible crypto (AES-GCM)
- ✅ Secure token handling
- ✅ Audit-friendly logging

**Your responsibilities:**
- Use IL4-compliant Azure Government subscription
- Follow DoD/NIST security controls
- Implement proper authorization logic
- Maintain audit trails and logging

## DoD (IL5) Configuration

For DoD Impact Level 5, change:

```env
LATCH_CLOUD=dod
```

DoD uses:
- Same login endpoint: `login.microsoftonline.us`
- Different Graph: `dod-graph.microsoft.us`
- Stricter compliance requirements (IL5)

## Learn More

- [Latch Documentation](../../README.md)
- [Azure Government Documentation](https://learn.microsoft.com/en-us/azure/azure-government/)
- [GCC-High Overview](https://learn.microsoft.com/en-us/office365/servicedescriptions/office-365-platform-service-description/office-365-us-government/gcc-high-and-dod)
- [FedRAMP Compliance](https://www.fedramp.gov/)
