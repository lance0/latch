# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Latch** is a security-first OIDC authentication library for Next.js 15+ with native support for Azure Government clouds (GCC-High, DoD). It implements OAuth 2.0 with PKCE, stores refresh tokens in encrypted HttpOnly cookies, and provides two authentication modes:

- **Secure Proxy Mode (default):** Access tokens never reach the browser; all API calls proxied server-side
- **Direct Token Mode:** Short-lived access tokens returned to client for performance-critical use cases

**Current Version:** v0.1.0-alpha (Embedded Library Architecture)
**Future:** v0.3+ will migrate to monorepo structure with `packages/latch` and `apps/*`

## Development Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server with Turbopack
pnpm build                  # Build for production
pnpm start                  # Start production server

# Quality Checks
pnpm typecheck              # Run TypeScript compiler (no emit)
pnpm lint                   # Run ESLint via next lint

# Testing
pnpm test                   # Run Vitest in watch mode
pnpm test --run             # Run tests once (CI mode)
pnpm test:ui                # Open Vitest UI
pnpm test:coverage          # Generate coverage report

# Single Test File
pnpm test __tests__/crypto/seal.test.ts
pnpm test seal              # Partial match works too
```

## Architecture

### 🔐 Core Authentication Flow

The PKCE flow is split across these layers:

1. **API Routes** (`app/api/latch/*/route.ts`) - HTTP handlers that orchestrate OAuth flow
2. **OIDC Core** (`lib/latch/oidc/`) - Token exchange, refresh, and ID token validation
3. **Crypto Utilities** (`lib/latch/crypto/`) - PKCE generation, cookie encryption, random values
4. **React Client** (`lib/latch/react/`) - Hooks and components for auth state

**Key Flow:**
```
User clicks sign-in
  → /api/latch/start (generates PKCE, redirects to Azure AD)
  → Azure AD (user authenticates)
  → /api/latch/callback (exchanges code for tokens, encrypts refresh token in cookie)
  → User redirected to returnTo URL
  → Client uses useLatch() to access session
```

### 📁 Directory Structure

```
lib/latch/
  ├── types.ts              # TypeScript types (LatchConfig, LatchUser, etc.)
  ├── config.ts             # Environment config, cloud endpoint mapping
  ├── crypto/
  │   ├── seal.ts           # AES-GCM cookie encryption/decryption
  │   ├── pkce.ts           # PKCE S256 code verifier & challenge
  │   └── random.ts         # Secure state/nonce generation
  ├── oidc/
  │   ├── tokens.ts         # Token exchange & refresh with Azure AD
  │   └── validation.ts     # State, nonce, returnTo, ID token validation
  ├── react/
  │   ├── LatchProvider.tsx # Auth context provider
  │   ├── LatchGuard.tsx    # Route protection component
  │   ├── useAccessToken.ts # Direct Token mode hook
  │   └── index.ts          # Public exports
  └── index.ts              # Library entry point

app/api/latch/
  ├── start/route.ts        # Initiates PKCE flow
  ├── callback/route.ts     # Handles OAuth callback
  ├── refresh/route.ts      # Refreshes access token
  ├── logout/route.ts       # Clears session
  └── session/route.ts      # Returns user info

app/
  ├── page.tsx              # Landing page (public)
  ├── dashboard/page.tsx    # Protected page example
  └── api/me/route.ts       # Graph API proxy example (Secure Proxy mode)

middleware.ts               # Route protection middleware
```

### 🔑 Key Concepts

**Cloud Awareness:**
- `getAzureEndpoints(cloud, tenantId)` returns correct URLs for commercial/gcc-high/dod
- `validateScopes()` prevents accidental .com Graph calls in Gov clouds
- All endpoints (authorize, token, logout, jwks) vary by cloud

**Cookie Sealing (AES-GCM):**
- `seal<T>(data, secret)` → base64url-encoded encrypted blob
- `unseal<T>(sealed, secret)` → original data
- Format: `iv.authTag.ciphertext` (12 + 16 + N bytes)
- Used for: refresh tokens, PKCE data, ID token claims

**PKCE Implementation:**
- Code verifier: 32 random bytes → base64url (43 chars)
- Code challenge: SHA-256(verifier) → base64url (43 chars)
- Follows RFC 7636 exactly (tested against reference vectors)

**ID Token Validation:**
- Uses `jose` library for JWKS verification (industry standard, audited)
- Validates: signature, audience, nonce, expiration
- JWKS cached by jose with default 60s TTL

**Cookie Names:**
- `latch_rt` - Encrypted refresh token (7 day expiry)
- `latch_pkce` - PKCE data during OAuth flow (10 min expiry)
- `latch_id` - Encrypted ID token claims (7 day expiry)

### 🧪 Testing Strategy

**Unit Tests (`__tests__/`):**
- Crypto functions (seal/unseal, PKCE, random)
- OIDC validation (state, nonce, returnTo, scopes)
- Configuration (endpoint generation, cloud mapping)

**Coverage:** Currently ~90% for core utilities, API routes untested (integration tests planned for v0.2)

**Running Specific Tests:**
```bash
pnpm test seal              # Just seal.test.ts
pnpm test crypto            # All crypto tests
pnpm test --run --reporter=verbose  # Detailed output
```

### 🔒 Security Considerations

**When Modifying:**
- **Never log tokens** - Even in debug mode (`LATCH_DEBUG=true`), tokens are redacted
- **Cookie flags are critical** - `HttpOnly`, `Secure` (production), `SameSite=Lax`
- **State/nonce must be validated** - Prevents CSRF and replay attacks
- **Return URLs must be whitelisted** - Use `validateReturnUrl()` to prevent open redirects
- **Encryption is mandatory** - Always `seal()` before setting cookies with sensitive data

**Security Invariants:**
- PKCE verifier never leaves server
- Refresh token never exposed to client JS (Secure Proxy mode)
- Access token only exposed in Direct Token mode (explicit opt-in)
- All Azure AD responses validated before trusting

### 🌐 Cloud Configuration

Set `LATCH_CLOUD` to one of:
- `commercial` → `login.microsoftonline.com` + `graph.microsoft.com`
- `gcc-high` → `login.microsoftonline.us` + `graph.microsoft.us`
- `dod` → `login.microsoftonline.us` + `dod-graph.microsoft.us`

**Scopes must match cloud:**
- Commercial: `User.Read` (no URL prefix needed)
- GCC-High/DoD: `User.Read` (Graph URL inferred from cloud setting)

**Common Misconfiguration:**
```typescript
// ❌ WRONG: .com scope in GCC-High
LATCH_CLOUD=gcc-high
LATCH_SCOPES=https://graph.microsoft.com/User.Read

// ✅ CORRECT:
LATCH_CLOUD=gcc-high
LATCH_SCOPES=User.Read
```

### 📝 Code Style

**Existing Patterns:**
- TypeScript strict mode enabled (`noUncheckedIndexedAccess`, `noUnusedLocals`, etc.)
- Error handling via `LatchError` with typed error codes
- All public APIs have JSDoc comments
- Server-side: Use `NextRequest`/`NextResponse` from `next/server`
- Client-side: Use `'use client'` directive for React components

**When Adding Features:**
- Add TypeScript types first in `lib/latch/types.ts`
- Core logic goes in `lib/latch/`, not in API routes
- API routes should be thin wrappers around core logic
- Always add unit tests for new utilities
- Update `CHANGELOG.md` with changes

### 🚫 Breaking Change Policy

**Until v1.0:**
- API can change between minor versions
- Breaking changes documented in `CHANGELOG.md`
- Migration guides required for v0.2→v0.3, v0.3→v1.0

**Post-v1.0:**
- Semantic versioning strictly enforced
- Breaking changes only in major versions
- Deprecation warnings required before removal

## Environment Variables

Required:
- `LATCH_CLIENT_ID` - Azure AD application ID
- `LATCH_TENANT_ID` - Azure AD tenant ID
- `LATCH_CLOUD` - Cloud environment (commercial|gcc-high|dod)
- `LATCH_COOKIE_SECRET` - 32+ byte secret for cookie encryption (generate with `openssl rand -base64 32`)

Optional:
- `LATCH_SCOPES` - Space-separated OAuth scopes (default: "openid profile User.Read")
- `LATCH_REDIRECT_URI` - OAuth callback URL (default: `${NEXTAUTH_URL}/api/latch/callback`)
- `LATCH_DEBUG` - Enable verbose logging (default: false)

**Example (GCC-High):**
```bash
LATCH_CLIENT_ID=00000000-0000-0000-0000-000000000000
LATCH_TENANT_ID=11111111-1111-1111-1111-111111111111
LATCH_CLOUD=gcc-high
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=your-32-byte-secret-here
LATCH_DEBUG=true
```

## Roadmap Context

**Current (v0.1):** Embedded library in Next.js app
**Next (v0.2, Weeks 9-12):** Enhanced error handling, test coverage >80%
**Future (v0.3, Weeks 13-18):** Migrate to monorepo, publish to npm, docs site
**Stable (v1.0, Weeks 19-26):** Security audit, DoD IL5 support, production-ready

See `ROADMAP.md` for detailed week-by-week plan.

## Important Files

- `SECURITY.md` - Security policies, vulnerability reporting, threat model
- `ARCHITECTURE.md` - Detailed technical implementation (PKCE flow, cookie encryption)
- `CHANGELOG.md` - Version history and breaking changes
- `ROADMAP.md` - 6-month development plan with weekly milestones
- `.env.example` - Sample environment configuration

## External Dependencies

**Runtime:**
- `jose` - ID token verification via JWKS (only external crypto dependency)
  - Why: Industry standard, used by Auth0/AWS, actively audited
  - What: JWT verification, JWKS fetching/caching, algorithm validation

**Development:**
- `vitest` - Testing framework (replaces Jest)
- `@vitest/ui` - Interactive test UI

**Why No Other Auth Libraries:**
- No NextAuth.js - Doesn't support Gov clouds natively
- No @azure/msal-browser - Complex, uses localStorage, not App Router native
- Built from scratch for transparency and Gov cloud support

## Common Gotchas

1. **Cookie encryption requires secret:** Generate with `openssl rand -base64 32`, never commit
2. **HTTPS required in production:** Secure cookies won't work over HTTP
3. **Cloud endpoints must match:** `gcc-high` requires `.us` URLs, not `.com`
4. **PKCE cookie expires in 10 minutes:** OAuth flow must complete quickly
5. **Middleware runs on every request:** Keep `getLatchSession()` calls minimal
6. **jose validates audience:** `clientId` must match Azure AD app registration

## CI/CD Notes

**GitHub Actions (future v0.2):**
- Lint → Typecheck → Test → Build (sequential)
- CodeQL security scanning
- Changesets for version management

**Pre-commit (not enforced yet):**
- Run `pnpm typecheck && pnpm lint` before pushing
- Tests should pass (`pnpm test --run`)

## Need Help?

- Review `ARCHITECTURE.md` for deep technical details
- Check `SECURITY.md` for security-related questions
- See `ROADMAP.md` for planned features and timeline
- Existing issues/patterns are the source of truth for code style
