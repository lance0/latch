# Latch Example Applications

This directory contains example Next.js applications demonstrating Latch authentication for different Azure cloud environments.

## Available Examples

### 1. [example-app](./example-app/) - Generic Example
General-purpose example that works with any cloud. Uses environment variables to configure the cloud environment dynamically.

**Use when:**
- Learning Latch for the first time
- Need flexibility to switch between clouds
- Prototyping or development

### 2. [example-commercial](./example-commercial/) - Azure Commercial Cloud
Pre-configured for **Azure Commercial Cloud** (`login.microsoftonline.com`).

**Use when:**
- Deploying to standard Azure (commercial cloud)
- Using Microsoft 365 (not GCC)
- General business applications
- No government compliance requirements

### 3. [example-gcc-high](./example-gcc-high/) - Azure Government (GCC-High)
Pre-configured for **Azure Government GCC-High** (`login.microsoftonline.us`).

**Use when:**
- Deploying to Azure Government
- IL4 (DoD Impact Level 4) compliance required
- Using Microsoft 365 GCC-High licenses
- Government or defense contractors
- FedRAMP High compliance needed

## Quick Comparison

| Feature | Generic | Commercial | GCC-High |
|---------|---------|------------|----------|
| **Cloud** | Configurable | Commercial | GCC-High (IL4) |
| **Login Endpoint** | Dynamic | `login.microsoftonline.com` | `login.microsoftonline.us` |
| **Graph API** | Dynamic | `graph.microsoft.com` | `graph.microsoft.us` |
| **Portal** | Both | portal.azure.com | portal.azure.us |
| **Compliance** | N/A | General | IL4 / FedRAMP High |
| **Best For** | Learning | Production (commercial) | Government production |
| **Preset Config** | ❌ | ✅ | ✅ |

## Getting Started

### 1. Choose Your Cloud Environment

- **Not sure?** Start with [example-app](./example-app/)
- **Standard Azure?** Use [example-commercial](./example-commercial/)
- **Government?** Use [example-gcc-high](./example-gcc-high/)

### 2. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 3. Configure Your Example

Each example has its own `.env.example` file. Copy it and fill in your Azure AD details:

```bash
cd example-commercial  # or example-gcc-high
cp .env.example .env.local
# Edit .env.local with your Azure AD configuration
```

### 4. Run the Example

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Key Differences Between Clouds

### Azure Commercial Cloud

**Characteristics:**
- Standard Azure subscription
- Global infrastructure
- Multi-tenant by default
- Regular Microsoft 365 licenses
- Accessible via portal.azure.com

**Endpoints:**
- Login: `https://login.microsoftonline.com`
- Graph: `https://graph.microsoft.com`
- Management: `https://management.azure.com`

**Use Cases:**
- Enterprise applications
- SaaS products
- General business workflows
- International deployments

### Azure Government (GCC-High)

**Characteristics:**
- Azure Government subscription (separate)
- US-only infrastructure
- Government-only tenants
- Microsoft 365 GCC-High licenses required
- Accessible via portal.azure.us

**Endpoints:**
- Login: `https://login.microsoftonline.us`
- Graph: `https://graph.microsoft.us`
- Management: `https://management.usgovcloudapi.net`

**Use Cases:**
- Federal agencies
- Defense contractors
- IL4 compliance required
- FedRAMP High applications
- CUI (Controlled Unclassified Information)

**Requirements:**
- Background-screened personnel
- Physical and logical isolation
- FIPS 140-2 validated crypto
- US-based data residency

### Azure Government (DoD)

For DoD Impact Level 5, use GCC-High example but change:

```env
LATCH_CLOUD=dod
```

**Additional restrictions:**
- DoD-specific Graph endpoint: `dod-graph.microsoft.us`
- Stricter access controls
- IL5 compliance requirements
- Secret and Top Secret clearances may be required

## Common Pitfalls

### ❌ Wrong Cloud Configuration

**Problem:** Token from one cloud won't work in another

```typescript
// ❌ This will fail with token confusion error
// - App configured for commercial
// - User token from GCC-High
```

**Solution:** Latch v0.4.1+ prevents this automatically!
- Validates issuer matches expected cloud
- Clear error messages
- Prevents token confusion attacks

### ❌ Mixed Scopes

**Problem:** Using commercial Graph scopes in government cloud

```env
# ❌ WRONG for GCC-High
LATCH_SCOPES=https://graph.microsoft.com/User.Read

# ✅ CORRECT for GCC-High  
LATCH_SCOPES=User.Read  # Latch auto-expands to .us endpoint
# Or explicitly:
LATCH_SCOPES=https://graph.microsoft.us/User.Read
```

### ❌ Wrong Portal

**Problem:** Creating app registration in wrong portal

- Commercial apps: Use `portal.azure.com`
- GCC-High apps: Use `portal.azure.us`

You cannot create GCC-High apps in the commercial portal or vice versa.

### ❌ License Mismatch

**Problem:** Users have wrong license type

- Commercial apps require Microsoft 365 (commercial) licenses
- GCC-High apps require Microsoft 365 GCC-High licenses
- Users cannot authenticate if license doesn't match cloud

## Features Demonstrated

All examples include:

✅ **Authentication Flow**
- PKCE OAuth 2.0 flow
- Secure cookie storage (AES-GCM)
- Token refresh handling

✅ **Server Actions**
- `getServerSession()` - Check auth status
- `requireAuth()` - Require authentication
- Form submissions with auth

✅ **API Integration**
- Microsoft Graph API calls
- Token refresh patterns
- Secure Proxy mode (server-side tokens)

✅ **Protected Routes**
- Component-level guards
- Middleware protection
- Automatic redirects

✅ **Session Management**
- 7-day session lifetime
- Automatic refresh
- Secure logout with Azure AD SSO

## Monorepo Structure

```
apps/
├── example-app/          # Generic (configurable cloud)
│   ├── .env.example
│   ├── README.md
│   └── ...
├── example-commercial/   # Azure Commercial preset
│   ├── .env.example      # Pre-configured for commercial
│   ├── README.md
│   └── ...
├── example-gcc-high/     # Azure Government preset
│   ├── .env.example      # Pre-configured for GCC-High
│   ├── README.md
│   └── ...
└── README.md             # This file
```

## Need Help?

- **Documentation:** [Main README](../README.md)
- **Security:** [SECURITY.md](../SECURITY.md)
- **Server Actions:** [docs/SERVER_ACTIONS.md](../docs/SERVER_ACTIONS.md)
- **Issues:** [GitHub Issues](https://github.com/lance0/latch/issues)

## Contributing

When adding new features:
1. Update all three examples consistently
2. Test with both commercial and government endpoints
3. Update this README with any new differences
4. Document cloud-specific considerations
