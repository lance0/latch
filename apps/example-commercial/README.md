# Latch Example - Azure Commercial Cloud

Example Next.js application demonstrating Latch authentication with **Azure Commercial Cloud**.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Azure AD

Create an app registration in the [Azure Portal](https://portal.azure.com):

1. Go to **Azure Active Directory** > **App registrations** > **New registration**
2. Name: `Latch Example Commercial`
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

Fill in your Azure AD details:

```env
LATCH_CLIENT_ID=your-client-id
LATCH_TENANT_ID=your-tenant-id
LATCH_CLOUD=commercial
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

- ✅ **Commercial Cloud** endpoints (`login.microsoftonline.com`)
- ✅ **Microsoft Graph API** integration (`graph.microsoft.com`)
- ✅ **Server Actions** examples
- ✅ **PKCE flow** with secure cookies
- ✅ **Session management** and refresh tokens
- ✅ **Protected routes** with authentication guards

## Key Differences from GCC-High

| Feature | Commercial | GCC-High |
|---------|-----------|----------|
| Login endpoint | `login.microsoftonline.com` | `login.microsoftonline.us` |
| Graph API | `graph.microsoft.com` | `graph.microsoft.us` |
| Compliance | General use | IL4 (DoD Impact Level 4) |
| Subscription | Standard Azure | Azure Government |
| User licenses | Microsoft 365 | Microsoft 365 GCC-High |

## Learn More

- [Latch Documentation](../../README.md)
- [Azure AD Documentation](https://learn.microsoft.com/en-us/azure/active-directory/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
