# Changelog

All notable changes to Latch will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v0.2.0
- Enhanced error handling with user-facing messages
- Background token refresh
- Better TypeScript type guards
- Increased test coverage (>80%)

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

[Unreleased]: https://github.com/yourusername/latch/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/latch/releases/tag/v0.1.0
