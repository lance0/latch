# Changelog

All notable changes to Latch will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-10-23

### Added
- **Monorepo Architecture**
  - Migrated to pnpm workspaces with Turborepo
  - Split into `@latch/core` and `@latch/cli` packages
  - Prepared for npm publication
  - Example app demonstrates real-world usage
- **CLI Package (`@latch/cli`)**
  - Interactive setup wizard (`latch init`)
  - Secure secret generator (`latch generate-secret`)
  - Client type selection (Public PKCE vs Confidential client_secret)
  - Azure AD app registration guidance
  - Automatic `.env.local` generation
- **Dual Authentication Modes**
  - Optional client secret support for confidential clients
  - PKCE-only mode for public clients (SPAs, mobile apps)
  - Client secret + PKCE hybrid mode (Web apps)
  - Automatic mode detection from environment variables
  - Comprehensive authentication setup guide (AUTHENTICATION_SETUP.md)
  - Zero-downtime client secret rotation procedures
  - 9 new token exchange tests
- **Comprehensive Documentation** (Week 12)
  - Authentication Modes guide (Secure Proxy vs Direct Token comparison)
  - Complete API reference with examples for all public APIs
  - Cloud-specific `.env` templates (commercial, gcc-high, dod)
  - Quick start checklists for each cloud environment
  - Compliance notes for GCC-High (IL4) and DoD (IL5)
  - FIPS mode instructions for DoD deployments
- **Enhanced Error Messages & DX** (Week 10)
  - Actionable error suggestions for all error codes
  - "Did you mean?" suggestions using Levenshtein distance
  - Startup configuration validation with detailed feedback
  - UUID validation for Client ID and Tenant ID
  - Weak secret detection in production
  - Comprehensive troubleshooting guide (TROUBLESHOOTING.md)
  - Structured debug logging with configuration summary
  - User-safe error messages (sanitized, no tokens)
  - Helper utilities: `createLatchError`, `formatErrorForLog`, `getUserSafeErrorMessage`
- **Enhanced Direct Token Mode** (Week 9)
  - Auto-refresh with configurable threshold (default: 5 minutes before expiry)
  - Exponential backoff retry logic (1s → 2s → 4s → 8s with jitter)
  - Page Visibility API support (pauses refresh when tab hidden)
  - Token expiry tracking and stale token detection
  - Configurable options (`autoRefresh`, `refreshThreshold`, `retryOnFailure`, `maxRetries`, `pauseWhenHidden`)
  - 17 new unit tests for auto-refresh behavior
- **Security Test Suite** (Week 11)
  - 66 security tests added
  - CSRF protection tests (state parameter validation)
  - Cookie tampering detection (AES-GCM integrity)
  - Open redirect prevention (return URL validation)
  - Scope escalation prevention (cloud endpoint validation)
- **CI/CD Infrastructure** (Week 11)
  - GitHub Actions workflow (lint, typecheck, test, build)
  - CodeQL security scanning (weekly + on PR)
  - Automated `pnpm audit` in CI pipeline
  - Codecov integration for coverage reports

### Changed
- README updated with comprehensive documentation section
- Error messages now include step-by-step solutions and examples
- Configuration validation happens at startup (fail fast)
- `useAccessToken` hook now returns `expiresAt` timestamp for token expiry tracking
- Scope validation is now case-insensitive
- Debug mode shows configuration summary without exposing secrets
- Vitest configured with jsdom environment for React component tests
- Token exchange functions now accept optional `clientSecret` parameter
- API routes updated to support dual authentication modes
- CLI wizard provides tailored setup instructions based on client type

### Fixed
- esbuild vulnerability (moderate severity, CVE in dev dependency)
- TypeScript strict mode error: unused `prev` parameter in CLI prompts

### Security
- Test coverage increased from 43 to 135 tests (+214%)
- All attack scenarios now tested (CSRF, tampering, open redirect, scope escalation)
- Enhanced error messages never log tokens or secrets
- Client secrets optional - PKCE mode requires no secrets at all
- Rotation procedures documented for confidential client deployments

---

## [0.1.0] - 2025-10-21

### Added

**Core Authentication**
- PKCE S256 authorization code flow implementation
- OAuth 2.0 token exchange and refresh
- ID token verification using JWKS
- State and nonce validation
- Return URL whitelist for open redirect prevention

**API Routes**
- `GET /api/latch/start` - Initiates OAuth flow with PKCE
- `GET /api/latch/callback` - Handles OAuth callback and token exchange
- `POST /api/latch/refresh` - Refreshes access token from refresh token
- `GET /api/latch/logout` - Clears session and redirects to Azure AD logout
- `GET /api/latch/session` - Returns current user session

**Crypto & Security**
- AES-GCM-256 cookie encryption with PBKDF2 key derivation
- PKCE code verifier and challenge generation (RFC 7636)
- Cryptographically secure random state and nonce generation
- HttpOnly cookies with SameSite=Lax
- Cookie tampering detection via authenticated encryption

**React Components & Hooks**
- `<LatchProvider>` - React context provider for auth state
- `useLatch()` - Hook for sign in/out and user session access
- `<LatchGuard>` - Component for protecting routes
- `useAccessToken()` - Hook for Direct Token mode (client-side tokens)

**Cloud Support**
- Azure Commercial cloud (`login.microsoftonline.com`)
- Azure Government GCC-High (`login.microsoftonline.us`)
- Azure Government DoD (`login.microsoftonline.us` with DoD Graph)
- Automatic endpoint selection based on cloud configuration
- Scope validation to prevent cloud endpoint mismatches

**Developer Experience**
- TypeScript strict mode with full type safety
- Environment-based configuration
- Debug logging mode (`LATCH_DEBUG=true`)
- Comprehensive JSDoc comments
- IntelliSense support for all APIs

**Example Application**
- Landing page with sign-in flow
- Protected dashboard with user profile
- Microsoft Graph API proxy example (`/api/me`)
- Middleware-based route protection

**Testing**
- 43 unit tests with Vitest
- Crypto utilities test suite
- OIDC validation test suite
- Configuration test suite
- Test UI with @vitest/ui

**Documentation**
- README.md with quick start guide
- SECURITY.md with threat model and vulnerability reporting
- ARCHITECTURE.md with technical implementation details
- ROADMAP.md tracking development progress
- .env.example with configuration examples
- MIT License

### Security

**Implemented Protections**
- CSRF protection via state parameter validation
- XSS token theft prevention (HttpOnly cookies)
- Open redirect prevention (return URL whitelist)
- Token replay prevention (nonce validation)
- Cookie tampering detection (AES-GCM auth tags)
- Scope escalation prevention (cloud-aware validation)

**Security Model**
- Refresh tokens never exposed to client JavaScript
- Access tokens server-side only in Secure Proxy mode
- No token logging (even in debug mode)
- HTTPS enforcement in production
- FIPS-compatible crypto when running Node.js with `--force-fips`

### Dependencies

**Runtime**
- `next` ^15.0.3
- `react` ^19.0.0
- `react-dom` ^19.0.0
- `jose` ^5.9.6 (JWKS verification)

**Development**
- `typescript` ^5.7.2
- `vitest` ^2.1.8
- `@vitest/ui` ^2.1.8
- `@vitest/coverage-v8` ^2.1.8
- `eslint` ^9.15.0
- `tailwindcss` ^3.4.15

---

## Version Comparison

[0.3.0]: https://github.com/lance0/latch/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/lance0/latch/releases/tag/v0.1.0
