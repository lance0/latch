# Changelog

All notable changes to Latch will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5] - 2025-11-17

### Changed
- **Documentation**: Moved recommended wrapping pattern to Quick Start section in README
  - Now appears as step 6 (before using auth in components)
  - Emphasizes centralizing auth logic with app-specific helpers
  - Shows complete lib/auth.ts example with database sync
  - Includes CLI command to generate wrapper
  - Added step 8 showing usage in Server Actions and API routes

### Notes
- No code changes - documentation-only release
- Makes the recommended production pattern more discoverable
- Helps users avoid common mistakes (using Latch helpers directly everywhere)

## [0.4.4] - 2025-11-17

### Added
- **CLI**: Enhanced `latch scaffold` command with new capabilities
  - `latch scaffold --type proxy` - Generate Next.js 16 compatible proxy.ts
  - `latch scaffold --type wrapper` - Generate lib/auth.ts auth helpers
  - `latch scaffold --type all` - Complete setup (proxy + wrapper + routes)
  - Interactive menu for selecting what to scaffold
  - Inline proxy.ts generation as fallback when reference file not found

### Changed
- **CLI**: Improved scaffold command description and help text
- **CLI**: Version updated to 0.4.4

## [0.4.3] - 2025-11-17

### Added
- **New Helpers for Better DX**:
  - `requireServerSession()` - Get authenticated session or throw (TypeScript-friendly, no `!` assertions needed)
  - `isLatchSession()` - Type guard for session validation (proper TypeScript narrowing)
  - `checkLatchHealth()` - Validate Latch configuration (useful for `/api/health` endpoints)
- **Reference Implementation**: `examples/nextjs16/proxy.ts` - Complete Next.js 16 proxy with proper session validation
- **Comprehensive Documentation**: Session structure, cookie names, and usage patterns in API_REFERENCE.md

### Fixed
- **Critical**: Removed incorrect `export const runtime = 'nodejs'` from proxy.ts examples (causes build errors in Next.js 16)
- **Critical**: Fixed session validation - check `session.sub` not `session.idToken` (which doesn't exist)
- **Documentation**: Clarified LatchSession structure - properties are on `session.user`, not `session` directly

### Changed
- **Documentation**: Enhanced API_REFERENCE.md with:
  - Clear LatchSession and LatchUser structure
  - ✅ Correct vs ❌ Wrong usage examples
  - Cookie name constants documentation
  - Session validation patterns for proxy.ts

### Notes
- All changes are **non-breaking** - existing code continues to work
- New helpers are **optional** convenience functions
- Based on real production feedback (Scout app integration)

## [0.4.2] - 2025-11-12

### Added
- **Automatic Token Refresh** - LatchProvider now automatically refreshes sessions 5 minutes before token expiry, preventing unexpected logouts
- **PBKDF2 Key Caching** - Derived encryption keys are now cached in memory, improving seal/unseal performance by 10-20x

### Performance
- Cookie encryption operations: ~10-20ms → <1ms (after first operation)
- Reduced CPU usage under high load
- Seamless session management without database queries

### User Experience
- Users stay logged in for full refresh token lifetime (7 days by default)
- No more unexpected 1-hour logout due to ID token expiry
- Automatic background session refresh with 5-minute buffer

### Technical
- Added `clearKeyCache()` export for testing/manual cache invalidation
- Auto-refresh uses React useEffect with proper cleanup
- Cache is per-process and supports secret rotation

## [0.4.1] - 2025-11-12

### Added
- **Token Confusion Attack Prevention**
  - `validateIssuer()` helper for strict tenant/cloud validation
  - Automatic detection of commercial vs government cloud mismatches
  - Prevents tokens from wrong tenant being accepted
  - Clear error messages for misconfigurations
- **Configurable Security Settings**
  - `LATCH_CLOCK_SKEW_TOLERANCE` for token validation (default: 60s)
  - `LATCH_JWKS_CACHE_TTL` for JWKS caching (default: 3600s)
  - Enhanced `verifyIdToken()` with optional tenant/cloud validation
- **Enhanced CLI (@lance0/latch-cli@0.4.1)**
  - `latch scaffold` - Copy API routes and Server Actions from examples
  - `latch validate` - Validate .env.local for common mistakes
  - `latch doctor` - Run diagnostics on Latch setup
  - Updated init wizard with security options

### Security
- Added 19 new security tests for issuer validation
- Multi-tenant scenario coverage
- Token confusion attack scenarios

### Documentation
- Updated SECURITY.md with Token Confusion Attack Prevention section
- Attack scenarios and protections documented

## [0.4.0] - 2025-11-12

### Added
- **Server Actions Support**
  - `getServerSession()` - Session access in Server Components/Actions
  - `requireAuth()` - Authentication guard with automatic error throw
  - Server Actions examples (profile, updateSettings)
  - Interactive demo page with useTransition patterns
  - Comprehensive docs/SERVER_ACTIONS.md guide
- **Example App Presets**
  - `apps/example-commercial` - Azure Commercial Cloud preset
  - `apps/example-gcc-high` - Azure Government (GCC-High) preset
  - Cloud-specific .env.example files with detailed comments
  - Dedicated README for each preset with IL4 compliance notes
  - Comprehensive apps/README.md comparing all examples
- **Migration Guides**
  - docs/MIGRATION_FROM_NEXTAUTH.md - Complete NextAuth.js migration guide
  - docs/MIGRATION_FROM_MSAL.md - MSAL Browser/React migration guide
  - Side-by-side code comparisons
  - Feature mapping tables
  - Quick comparison table in README

### Documentation
- Added "Migrating to Latch" section to README
- Common pitfalls section for multi-cloud scenarios
- Features demonstrated list in apps documentation

## [0.3.0] - 2025-10-23

### Added
- **Monorepo Architecture**
  - Migrated to pnpm workspaces with Turborepo
  - Split into `@lance0/latch` and `@lance0/latch-cli` packages
  - Prepared for npm publication
  - Example app demonstrates real-world usage
- **CLI Package (`@lance0/latch-cli`)**
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
