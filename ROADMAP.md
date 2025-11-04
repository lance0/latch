# Latch Roadmap

This document tracks the development progress and planned features for Latch.

**Last Updated:** 2025-11-04
**Current Version:** v0.3.0
**Status:** Published to npm! Preparing for v1.0 GA
**Timeline:** v1.0 GA targeted for Q1 2026

---

## Timeline Overview

| Phase | Version | Status | Completed | Highlights |
|-------|---------|--------|-----------|------------|
| Phase 1 | v0.1 | ✅ Complete | 2025-10-21 | Core OIDC, PKCE, encrypted cookies |
| Phase 2 | v0.2 | ✅ Complete | 2025-10-22 | Enhanced DX, security tests, auto-refresh |
| Phase 3 | v0.3 | ✅ Complete | 2025-10-23 | Monorepo, CLI, dual auth modes, compliance docs |
| Phase 3.5 | v0.3.0 | ✅ Complete | 2025-11-04 | **Published to npm!** License updated to Apache 2.0 |
| Phase 4 | v1.0 | 🚧 In Progress | TBD | OBO flows, security audit, advanced features |

**Actual Effort (v0.1-v0.3):** ~200 hours over 3 months
**Remaining to GA:** ~100-150 hours

---

## ✅ v0.1 — MVP (COMPLETED)

**Status:** ✅ Complete
**Released:** 2025-10-21
**Effort:** ~80 hours

Core authentication functionality for Next.js App Router with Azure Government cloud support.

### Features

- ✅ **API Routes**
  - [x] `/api/latch/start` - Initiates PKCE flow with state/nonce
  - [x] `/api/latch/callback` - OAuth callback handler with token exchange
  - [x] `/api/latch/refresh` - Access token refresh endpoint
  - [x] `/api/latch/logout` - Session termination
  - [x] `/api/latch/session` - User session retrieval

- ✅ **Crypto & Security**
  - [x] PKCE S256 code verifier and challenge generation
  - [x] AES-GCM-256 cookie encryption (seal/unseal)
  - [x] Secure random state and nonce generation
  - [x] HttpOnly cookies with SameSite=Lax
  - [x] PBKDF2 key derivation (100k iterations)

- ✅ **OIDC Implementation**
  - [x] Authorization code flow with PKCE
  - [x] Token exchange (code → tokens)
  - [x] Refresh token flow
  - [x] ID token verification with JWKS (using jose)
  - [x] State parameter validation (CSRF protection)
  - [x] Nonce validation (replay protection)
  - [x] Return URL whitelist (open redirect prevention)

- ✅ **React Components & Hooks**
  - [x] `<LatchProvider>` - Context provider for auth state
  - [x] `useLatch()` - Hook for sign in/out and user state
  - [x] `<LatchGuard>` - Component-level route protection
  - [x] `useAccessToken()` - Direct Token mode support

- ✅ **Cloud Support**
  - [x] Commercial Azure (`login.microsoftonline.com`)
  - [x] GCC-High (`login.microsoftonline.us` + `graph.microsoft.us`)
  - [x] DoD (`login.microsoftonline.us` + `dod-graph.microsoft.us`)
  - [x] Cloud-aware endpoint generation
  - [x] Scope validation (prevents .com/.us mismatches)

### Metrics

- **Code:** ~2,500 lines
- **Tests:** 43 passing
- **Coverage:** Core utilities ~90%

---

## ✅ v0.2 — Enhanced DX & Testing (COMPLETED)

**Status:** ✅ Complete
**Completed:** 2025-10-22
**Effort:** ~60 hours

Enhanced error handling, auto-refresh, security hardening, and comprehensive documentation.

### Features

- ✅ **Enhanced Direct Token Mode**
  - [x] Auto-refresh with configurable threshold (default: 5 min before expiry)
  - [x] Exponential backoff retry logic (1s → 2s → 4s → 8s with jitter)
  - [x] Token expiry tracking (`expiresAt` timestamp)
  - [x] Page Visibility API support (pauses refresh when tab hidden)
  - [x] 17 new unit tests for auto-refresh behavior

- ✅ **Enhanced Error Messages**
  - [x] "Did you mean?" suggestions using Levenshtein distance
  - [x] Actionable error messages for all error codes
  - [x] Step-by-step solutions and examples
  - [x] UUID validation for Client/Tenant IDs
  - [x] Weak secret detection in production
  - [x] Helper utilities: `createLatchError`, `formatErrorForLog`, `getUserSafeErrorMessage`

- ✅ **Security Test Suite**
  - [x] 66 security tests added (135 total tests, up from 43)
  - [x] CSRF protection tests (state parameter validation)
  - [x] Cookie tampering detection (AES-GCM integrity)
  - [x] Open redirect prevention (return URL validation)
  - [x] Scope escalation prevention (cloud endpoint validation)

- ✅ **Documentation**
  - [x] TROUBLESHOOTING.md (15+ common scenarios)
  - [x] Startup configuration validation with detailed feedback
  - [x] Structured debug logging with configuration summary

### Metrics

- **Tests:** 135 passing (up from 43, +214%)
- **Security tests:** 66 new tests
- **Coverage:** >80% for core utilities

---

## ✅ v0.3 — Monorepo & CLI (COMPLETED)

**Status:** ✅ Complete
**Completed:** 2025-10-23
**Effort:** ~60 hours

Monorepo architecture, CLI tooling, dual authentication modes, and compliance documentation.

### Features

- ✅ **Monorepo Architecture**
  - [x] Migrated to pnpm workspaces with Turborepo
  - [x] Split into `@lance0/latch` and `@lance0/latch-cli` packages
  - [x] Prepared for npm publication
  - [x] Example app demonstrates real-world usage

- ✅ **CLI Package (`@lance0/latch-cli`)**
  - [x] Interactive setup wizard (`latch init`)
  - [x] Secure secret generator (`latch generate-secret`)
  - [x] Client type selection (Public PKCE vs Confidential client_secret)
  - [x] Azure AD app registration guidance
  - [x] Automatic `.env.local` generation

- ✅ **Dual Authentication Modes**
  - [x] Optional client secret support for confidential clients
  - [x] PKCE-only mode for public clients (SPAs, mobile apps)
  - [x] Client secret + PKCE hybrid mode (Web apps)
  - [x] Automatic mode detection from environment variables
  - [x] Zero-downtime client secret rotation procedures
  - [x] 9 new token exchange tests

- ✅ **Comprehensive Documentation**
  - [x] Authentication Modes guide (Secure Proxy vs Direct Token comparison)
  - [x] Complete API reference with examples for all public APIs
  - [x] Cloud-specific `.env` templates (commercial, gcc-high, dod)
  - [x] Quick start checklists for each cloud environment
  - [x] Compliance notes for GCC-High (IL4) and DoD (IL5)
  - [x] FIPS mode instructions for DoD deployments
  - [x] Runtime requirements (Node.js-only, no Edge Runtime)
  - [x] Azure AD logout flow helper (`buildLogoutUrl()`)

- ✅ **CI/CD Infrastructure**
  - [x] GitHub Actions workflow (lint, typecheck, test, build)
  - [x] CodeQL security scanning (weekly + on PR)
  - [x] Automated `pnpm audit` in CI pipeline

### Metrics

- **Packages:** 2 (`@lance0/latch`, `@lance0/latch-cli`)
- **Tests:** 135 passing
- **Documentation:** 7 comprehensive markdown files
- **Package size:** 186KB (latch), 11KB (latch-cli)
- **npm Published:** 2025-11-04 ✅

---

## 🚧 v1.0 — GA Release (IN PROGRESS)

**Status:** 🚧 In Progress
**Target:** Q1 2026
**Estimated Effort:** 100-150 hours

Production-ready release with security audit, advanced features, and ecosystem support.

### Critical Pre-GA Items (from Codex Review)

#### 🔴 High Priority (Must-Have for GA)

- [ ] **OBO/Token Exchange Helpers** (20 hours)
  - [ ] On-Behalf-Of (OBO) flow for API-to-API calls
  - [ ] Token exchange endpoint wrappers
  - [ ] Sovereign cloud compatibility (GCC-High, DoD)
  - [ ] Example: Next.js API → Azure Function with OBO token
  - [ ] Documentation: When to use OBO vs service principal auth
  - **Rationale:** Critical for multi-tier government applications

- [ ] **Server Actions Patterns** (15 hours)
  - [ ] Next.js 15 Server Actions examples with Latch
  - [ ] Session validation in Server Actions
  - [ ] Token refresh patterns for long-running actions
  - [ ] Error handling in Server Actions
  - [ ] Documentation with code examples
  - **Rationale:** Next.js 15 best practice, emerging pattern

- [ ] **Enhanced Validation Guards** (10 hours)
  - [ ] Strict tenant/issuer validation per cloud
  - [ ] Prevent token from wrong tenant/cloud being accepted
  - [ ] Configurable clock-skew tolerance (currently 60s)
  - [ ] Configurable JWKS cache TTL (currently jose defaults)
  - [ ] Add `validateIssuer()` helper with cloud-aware checks
  - **Rationale:** Prevent token confusion attacks in multi-tenant scenarios

- [ ] **Example App Presets** (15 hours)
  - [ ] Create `apps/example-commercial` - Azure Commercial preset
  - [ ] Create `apps/example-gcc-high` - GCC-High preset with FIPS notes
  - [ ] Demonstrate Secure Proxy mode (Graph calls server-only)
  - [ ] Demonstrate Direct Token mode with auto-refresh
  - [ ] Side-by-side comparison README
  - **Rationale:** Lower barrier to entry, clear usage patterns

- [ ] **Third-Party Security Audit** (External, ~$5k-$10k)
  - [ ] Hire OIDC security expert
  - [ ] Audit scope: OAuth flow, cookie security, PKCE, token handling
  - [ ] Address all critical/high findings
  - [ ] Document findings in SECURITY.md
  - [ ] Add "Security Reviewed" badge to README
  - **Rationale:** Build trust for government adoption

- [x] **npm Publication** ✅ (Completed 2025-11-04)
  - [x] Published `@lance0/latch@0.3.0` to npm
  - [x] Published `@lance0/latch-cli@0.3.0` to npm
  - [x] Updated license to Apache 2.0
  - [ ] Create GitHub release with changelog (pending)
  - [ ] Announce publicly (HN, Reddit, Dev.to) (pending)

#### 🟡 Medium Priority (Nice-to-Have for GA)

- [ ] **Correlation IDs for Auth Flows** (8 hours)
  - [ ] Add `x-latch-flow-id` to all auth-related requests
  - [ ] Thread correlation ID through start → callback → refresh
  - [ ] Include in debug logs for flow tracing
  - [ ] Document in audit logging section
  - **Rationale:** Improves debugging and audit trail

- [ ] **Front-Channel Logout** (8 hours)
  - [ ] Implement front-channel logout iframe pattern
  - [ ] Add logout session monitoring
  - [ ] Document logout options (front-channel vs back-channel)
  - **Rationale:** Better Azure AD SSO integration

- [ ] **Session Invalidation Examples** (5 hours)
  - [ ] Example: Invalidate session on password change
  - [ ] Example: Force re-auth after N days
  - [ ] Example: Global logout (revoke all sessions)
  - **Rationale:** Common enterprise requirement

- [ ] **Migration Guides** (10 hours)
  - [ ] From NextAuth.js to Latch
  - [ ] From @azure/msal-browser to Latch
  - [ ] Comparison table: NextAuth vs Latch vs MSAL
  - **Rationale:** Ease adoption from existing solutions

- [ ] **Performance Benchmarks** (8 hours)
  - [ ] Benchmark cookie seal/unseal time
  - [ ] Benchmark token refresh latency
  - [ ] Benchmark JWKS validation time
  - [ ] Benchmark middleware overhead
  - [ ] Document performance characteristics
  - [ ] Target: <100ms p95 token refresh
  - **Rationale:** Prove production readiness

#### 🟢 Low Priority (Post-GA)

- [ ] **Starter Templates**
  - [ ] `npx create-latch-app` CLI
  - [ ] Template: Next.js 15 + Latch + shadcn/ui
  - [ ] Template: Next.js 15 + Latch + Tailwind
  - [ ] Template: Minimal starter

- [ ] **Terraform Modules**
  - [ ] Azure AD app registration module
  - [ ] Automated redirect URI configuration
  - [ ] Government cloud variants

- [ ] **GitHub Actions Workflows**
  - [ ] Latch security check action
  - [ ] Token refresh smoke test action

### v1.0 Timeline (Estimated)

| Week | Focus | Tasks | Hours |
|------|-------|-------|-------|
| 1-2 | OBO & Token Exchange | Implement OBO flow, test with Azure Functions | 20 |
| 3 | Server Actions | Examples, docs, patterns | 15 |
| 4 | Enhanced Validation | Issuer guards, JWKS config, clock skew | 10 |
| 5 | Example Apps | Commercial & GCC-High presets | 15 |
| 6 | Correlation IDs & Audit | Flow tracking, logging improvements | 8 |
| 7-8 | Security Audit Prep | Code review, documentation, external audit | 20 |
| 9 | Security Fixes | Address audit findings | 15 |
| 10 | Migration Guides & Polish | Docs, guides, final testing | 15 |
| 11 | Performance & Benchmarks | Load testing, optimization | 8 |
| 12 | Final Testing & Launch | Fresh VM test, npm publish, announce | 10 |
| **Total** | | | **136 hours** |

### Success Metrics for v1.0

- [ ] 1,000 npm downloads in first month
- [ ] >5 production deployments (self-reported)
- [ ] >200 GitHub stars
- [ ] >1 IL4/IL5 case study
- [ ] Zero critical security issues
- [ ] <100ms p95 token refresh latency
- [ ] Security audit passed with no critical findings
- [ ] <7 day security issue resolution SLA

---

## 🔮 Post-v1.0 (Community-Driven)

**Status:** 💡 Ideas
**Target:** Based on community demand

Features that extend beyond core Next.js focus.

### Potential Features

- [ ] **`latch/react`** - Router-agnostic React SPA support
  - [ ] Works with React Router, Remix, TanStack Router
  - [ ] Client-side only mode (no Next.js)
  - [ ] BFF (Backend-for-Frontend) pattern examples

- [ ] **`latch/node`** - Server-side token validation library
  - [ ] Express middleware
  - [ ] Fastify plugin
  - [ ] Standalone JWT validator for API validation

- [ ] **Adapter Ecosystem**
  - [ ] Remix adapter
  - [ ] SvelteKit adapter
  - [ ] Nuxt adapter (if community interest)

- [ ] **Advanced Features**
  - [ ] Multi-tenant session management
  - [ ] Session analytics and monitoring
  - [ ] Custom IdP support (beyond Azure AD)
  - [ ] Device code flow for CLI apps
  - [ ] Certificate-based auth (PIV/CAC for DoD)

### Requirements

- **Community-driven:** Only build if >50 users request
- **Maintainer availability:** Requires additional contributors
- **Backward compatibility:** Must not break existing Latch apps

---

## Version History

| Version | Released | Status | Highlights |
|---------|----------|--------|------------|
| v0.1.0 | 2025-10-21 | ✅ Complete | Core OIDC flow, PKCE, encrypted cookies |
| v0.2.0 | 2025-10-22 | ✅ Complete | Enhanced DX, security tests, auto-refresh |
| v0.3.0 | 2025-11-04 | ✅ Complete | Monorepo, CLI, dual auth modes, npm published! |
| v1.0.0 | Q1 2026 | 🚧 In Progress | OBO flows, security audit, GitHub public |

---

## Completed vs Planned (Summary)

### ✅ Completed (v0.1-v0.3)

- Core OIDC authentication with PKCE S256
- Azure Government cloud support (Commercial, GCC-High, DoD)
- Dual authentication modes (PKCE-only, client_secret + PKCE)
- React hooks and components (`useLatch`, `useAccessToken`, `<LatchProvider>`)
- Auto-refresh with exponential backoff
- AES-GCM-256 encrypted cookies
- Monorepo with pnpm + Turborepo
- CLI tooling (`@lance0/latch-cli`)
- 135 unit tests including 66 security tests
- Comprehensive documentation (7 markdown files)
- CI/CD with GitHub Actions
- Compliance documentation (IL4/IL5 guidance)
- FIPS 140-2 support instructions
- Runtime requirements documented (Node.js-only)
- Azure AD logout flow helper

### 🚧 Remaining for v1.0 GA

**Critical Path (Must-Have):**
1. OBO/Token exchange helpers (20 hours)
2. Server Actions patterns (15 hours)
3. Enhanced validation guards (10 hours)
4. Example app presets (15 hours)
5. Third-party security audit (~$5k-$10k)
6. npm publication (5 hours)

**Nice-to-Have:**
7. Correlation IDs (8 hours)
8. Front-channel logout (8 hours)
9. Migration guides (10 hours)
10. Performance benchmarks (8 hours)

**Total to GA:** ~100-150 hours + security audit

---

## Risk Management

### Critical Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Security vulnerability found** | Critical | Medium | Fast patch process; security@latch.dev contact; bug bounty (post-1.0) |
| **Poor adoption** | High | Medium | Focus on Gov cloud niche; direct outreach; case studies; migration guides |
| **Breaking Azure AD changes** | High | Low | Monitor Azure AD changelog; version lock dependencies; test against canary |
| **Maintainer bandwidth** | High | Medium | Manage scope carefully; prioritize critical path; defer nice-to-haves |
| **Security audit fails** | High | Low | Address findings before GA; be transparent; delay launch if needed |
| **Next.js breaking changes** | Medium | Low | Test against Next.js canary; document version compatibility matrix |

### Contingency Plans

**If security audit finds critical issues:**
- Delay v1.0 launch until fixed
- Publish security advisory immediately
- Notify beta testers directly
- Add additional tests to prevent regression

**If OBO implementation complex:**
- Release v1.0 without OBO
- Add OBO in v1.1 within 4 weeks
- Document workaround (manual token exchange)

**If behind schedule:**
- Cut scope (defer correlation IDs, migration guides to v1.1)
- Focus on critical path only
- Extend timeline (acceptable for quality)

---

## Resources & Budget

### First-Year Budget

- **Domain:** `latch.dev` - $15/year (optional, GitHub Pages free)
- **Security audit:** $5,000-$10,000 (one-time, critical)
- **CI/CD:** Free (GitHub Actions)
- **npm registry:** Free
- **Hosting:** Free (Vercel/Netlify)
- **Total:** ~$5,015-$10,015

### Time Investment

| Phase | Weeks | Hours | Status |
|-------|-------|-------|--------|
| v0.1-v0.3 | 1-12 | ~200 | ✅ Complete |
| v1.0 | 13-24 | ~100-150 | 🚧 In Progress |
| **Total to GA** | **24 weeks** | **~300-350** | **67% complete** |

---

## Contributing

Want to help ship v1.0? We need help with:

- 🔧 **OBO/Token Exchange** - Implement on-behalf-of flow for sovereign clouds
- 📚 **Server Actions Examples** - Next.js 15 patterns and documentation
- 🎨 **Example Apps** - Build commercial and GCC-High preset apps
- 🧪 **Testing** - Integration tests for API routes
- 📖 **Migration Guides** - From NextAuth.js and MSAL

See [GitHub Issues](https://github.com/lance0/latch/issues) for specific tasks.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

---

## Next Steps

### This Week (Current: v0.3 Published!)
1. ✅ Monorepo architecture
2. ✅ CLI package
3. ✅ Compliance documentation
4. ✅ Published to npm (2025-11-04)
5. ✅ Updated license to Apache 2.0
6. ✅ Cleaned internal docs from repo
7. 🔜 Make GitHub repo public
8. 🔜 Create GitHub release
9. 🔜 Begin OBO flow implementation

### Next 12 Weeks (v1.0)
1. Implement OBO/token exchange helpers
2. Document Server Actions patterns
3. Create example app presets
4. Add enhanced validation guards
5. Schedule third-party security audit
6. Publish to npm

---

**Questions?** Open a [GitHub Discussion](https://github.com/lance0/latch/discussions)
**Found a bug?** Submit an [Issue](https://github.com/lance0/latch/issues)
**Security issue?** See [SECURITY.md](./SECURITY.md) for reporting instructions
