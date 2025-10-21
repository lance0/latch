# Latch Roadmap

This document tracks the development progress and planned features for Latch.

**Last Updated:** 2025-10-21
**Current Version:** v0.1.0-alpha
**Timeline:** 6 months to v1.0 stable
**Architecture:** Embedded Library (v0.1-v0.2) → Monorepo (v0.3+)

---

## Timeline Overview

| Phase | Version | Duration | Status | Target |
|-------|---------|----------|--------|--------|
| Phase 1 | v0.1 | Weeks 1-8 | ✅ Complete | 2025-10-21 |
| Phase 2 | v0.2 | Weeks 9-12 | 🔜 Next | TBD |
| Phase 3 | v0.3 | Weeks 13-18 | 📋 Planned | TBD |
| Phase 4 | v1.0 | Weeks 19-26 | 💭 Future | TBD |

**Total Effort:** ~300-400 hours over 6 months
**Weekly Commitment:** 10-20 hours/week

---

## ✅ v0.1 — MVP (COMPLETED)

**Status:** ✅ Complete
**Released:** 2025-10-21

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

- ✅ **Example Application**
  - [x] Landing page with sign-in flow
  - [x] Protected dashboard with `<LatchGuard>`
  - [x] User profile display (ID token claims)
  - [x] Microsoft Graph proxy example (`/api/me`)
  - [x] Middleware-based route protection

- ✅ **Testing**
  - [x] Crypto utilities tests (seal, PKCE, random)
  - [x] OIDC validation tests (state, nonce, returnTo)
  - [x] Config tests (endpoints, scope validation)
  - [x] 43 passing unit tests
  - [x] Vitest + @vitest/ui configured

- ✅ **Documentation**
  - [x] README.md with quick start guide
  - [x] SECURITY.md with threat model and policies
  - [x] ARCHITECTURE.md with technical details
  - [x] .env.example with all configuration options
  - [x] Inline code comments and JSDoc

- ✅ **Developer Experience**
  - [x] TypeScript strict mode
  - [x] ESLint configuration
  - [x] Full type safety with IntelliSense
  - [x] Debug mode (`LATCH_DEBUG=true`)

### Metrics

- **Code:** ~2,500 lines
- **Tests:** 43 passing
- **Coverage:** Core utilities ~90%, API routes untested
- **Dependencies:** 3 runtime (Next.js, React, jose)

---

## 🚧 v0.2 — Refinement & Direct Token Mode (Weeks 9-12)

**Status:** 🏗️ In Progress (~30% complete)
**Target:** TBD
**Effort:** 10-15 hours/week

Enhancements for developer experience, better error handling, and testing improvements.

### Week-by-Week Plan

#### Week 9: Enhanced Direct Token Mode
- [ ] Improve `useAccessToken()` hook
  - [ ] Auto-refresh 60s before expiration
  - [ ] Retry once on 401 errors
  - [ ] Better loading states
- [ ] Add token expiration warnings in dev mode
- [ ] Document security trade-offs in README
- [ ] Create example showing Direct Token mode in action

#### Week 10: DX Improvements & Session Management
- [ ] Implement `/api/latch/session` route (already done, enhance)
- [ ] Add background token refresh option
- [ ] Improve error messages
  - [ ] Add "Did you mean?" suggestions
  - [ ] Link to docs for common errors
  - [ ] Show example fixes
- [ ] Enhance `returnTo` parameter support
- [ ] Create troubleshooting guide (10+ scenarios)

#### Week 11: Testing & Security Hardening ✅
- [x] Expand unit test coverage to >80%
  - [x] Security test suite (66 tests)
  - [ ] API route integration tests
  - [ ] Client hook tests
- [x] Add security tests
  - [x] CSRF attack simulation (invalid state)
  - [x] Cookie tampering detection
  - [x] Open redirect prevention
  - [x] Scope escalation prevention
- [x] Run `pnpm audit` and fix vulnerabilities
- [x] Add CodeQL GitHub Action

#### Week 12: Documentation & v0.2 Release
- [ ] Write comprehensive guides
  - [ ] Secure Proxy vs Direct Token comparison
  - [ ] Troubleshooting common issues
  - [ ] API reference with examples
- [ ] Create `.env` templates for each cloud
- [ ] Record demo video (optional)
- [ ] Tag `v0.2.0-beta`
- [ ] Get feedback from 3+ testers

### Planned Features

- [ ] **Enhanced Error Handling**
  - [ ] User-facing error messages (sanitized)
  - [ ] Error recovery suggestions
  - [ ] Automatic retry logic with exponential backoff

- [ ] **Background Refresh**
  - [ ] Optional background token refresh
  - [ ] Automatic refresh 60s before expiration
  - [ ] Configurable refresh behavior

- [ ] **TypeScript Improvements**
  - [ ] Stricter type guards
  - [ ] Generic type helpers for custom claims

- [ ] **Testing**
  - [ ] API route integration tests
  - [ ] E2E tests with Playwright (optional)
  - [ ] Security test suite
  - [ ] Coverage target: >80%

### Success Metrics

- [x] Test coverage >80% (109 tests, up from 43)
- [x] Zero TypeScript strict mode violations
- [ ] <100ms overhead for token refresh
- [ ] 3+ beta testers provide positive feedback
- [ ] No critical bugs for 1 week

### 🎯 Decision Gate: Ready for v0.3?

**Requirements to proceed:**
- [ ] API stable (no breaking changes for 2 weeks)
- [ ] Positive feedback from beta testers
- [ ] Test coverage >80%
- [ ] All v0.2 features working

---

## 🛰 v0.3 — Monorepo & Docs Site (Weeks 13-18)

**Status:** 📋 Planned
**Target:** TBD
**Effort:** 15-20 hours/week

Major architectural shift to monorepo + public documentation + CLI tooling.

### Week-by-Week Plan

#### Week 13-14: Monorepo Migration
- [ ] Set up pnpm workspaces
  ```yaml
  # pnpm-workspace.yaml
  packages:
    - 'packages/*'
    - 'apps/*'
  ```
- [ ] Install and configure Turborepo
- [ ] Restructure project
  ```
  packages/
    latch/          # Core library
  apps/
    example-secure-proxy/
    example-direct-token/
  ```
- [ ] Set up tsup for library builds
- [ ] Update all imports and CI pipeline
- [ ] Test everything still works
- [ ] Document migration in CHANGELOG

#### Week 15: Second Example App & Enhanced Validation
- [ ] Create `apps/example-direct-token` (Direct Token mode)
- [ ] Enhance JWKS validation with caching
- [ ] Add nonce validation improvements
- [ ] Test with real Azure AD tokens
- [ ] Document `jose` dependency rationale

#### Week 16: Cloud Validator CLI
- [ ] Create `packages/latch-cli` package
- [ ] Implement commands:
  - [ ] `npx latch check-config` - Validate .env
  - [ ] `npx latch generate-secret` - Generate cookie secret
  - [ ] `npx latch init` - Interactive setup wizard
- [ ] Build with tsup
- [ ] Publish to npm as `@latch/cli` (or similar)
- [ ] Document in main README

#### Week 17: Documentation Site (Docusaurus)
- [ ] Create `apps/docs` with Docusaurus
- [ ] Port all markdown docs
- [ ] Create architecture diagrams (OAuth flow, cookies, etc.)
- [ ] Add interactive examples (CodeSandbox embeds)
- [ ] Set up deployment (Vercel/Netlify)
- [ ] Configure custom domain: `latch.dev`
- [ ] Add search (Algolia DocSearch)

#### Week 18: Polish & v0.3 Release
- [ ] Review all documentation for accuracy
- [ ] Add migration guide (v0.2 → v0.3)
- [ ] Create starter templates (`npx create-latch-app`)
- [ ] Record tutorial videos (optional)
  - [ ] Quickstart (5 min)
  - [ ] Azure AD app registration (10 min)
  - [ ] GCC-High setup (10 min)
- [ ] Publish v0.3.0 to npm
- [ ] Announce publicly (HN, Reddit, Twitter)
- [ ] Create launch blog post

### Planned Features

- [ ] **Monorepo Structure**
  - [ ] Separate `packages/latch` for core library
  - [ ] Multiple example apps in `apps/`
  - [ ] Turborepo for build optimization
  - [ ] pnpm workspaces

- [ ] **Enhanced OIDC Features**
  - [ ] Full JWKS caching with configurable TTL
  - [ ] Multi-tenant support
  - [ ] Custom claim extraction helpers

- [ ] **Documentation Site**
  - [ ] Docusaurus site at `latch.dev`
  - [ ] API reference (auto-generated from JSDoc)
  - [ ] Interactive examples with CodeSandbox
  - [ ] Video tutorials for setup

- [ ] **CLI Tools**
  - [ ] `npx latch check-config` - Validates .env configuration
  - [ ] `npx latch generate-secret` - Generates LATCH_COOKIE_SECRET
  - [ ] `npx latch init` - Interactive setup wizard

- [ ] **Example Apps**
  - [ ] Secure Proxy mode example
  - [ ] Direct Token mode example
  - [ ] Next.js + Latch + shadcn/ui dashboard (optional)

- [ ] **Testing**
  - [ ] Mock OIDC server for integration tests
  - [ ] Security tests (CSRF, tampering, open redirect)
  - [ ] Coverage target: >90%

### Success Metrics

- [ ] Docs site live with >20 pages
- [ ] Installable via `pnpm add latch`
- [ ] 10+ GitHub stars in first week
- [ ] No critical bugs in first 48 hours
- [ ] <5 minute setup time (measured)
- [ ] Test coverage >90%

### 🎯 Decision Gate: Ready for v1.0?

**Requirements to proceed:**
- [ ] v0.3.0 stable in production (at least 1 user)
- [ ] No critical bugs for 2 weeks
- [ ] Documentation comprehensive
- [ ] Positive community feedback

---

## 🛡 v1.0 — Stable Release (Weeks 19-26)

**Status:** 💭 Planned
**Target:** TBD
**Effort:** 10-15 hours/week

Production-grade release with security review and ecosystem support.

### Week-by-Week Plan

#### Week 19-20: DoD Cloud & Advanced Features
- [ ] Add DoD (IL5) cloud support
  - [ ] Different authority endpoints
  - [ ] DoD Graph API endpoints
  - [ ] Document IL4 vs IL5 differences
- [ ] Implement scope validation guard
  - [ ] Prevent `.com` API calls in Gov mode
  - [ ] Warning system for misconfigurations
- [ ] Add rate limiting for token refresh
- [ ] Add session timeout configuration
- [ ] Document all configuration options

#### Week 21-22: Third-Party Security Review
- [ ] Hire security consultant ($3k-$10k budget)
  - [ ] OIDC expertise required
  - [ ] Azure AD experience preferred
- [ ] Provide audit scope
  - [ ] OAuth/OIDC flow
  - [ ] Cookie security
  - [ ] PKCE implementation
  - [ ] Token storage & handling
- [ ] Address all findings
  - [ ] Fix critical issues immediately
  - [ ] Plan medium/low priority fixes
- [ ] Document findings in SECURITY.md
- [ ] Add "Security Reviewed" badge

#### Week 23: Migration Guides & Breaking Changes
- [ ] Write migration guides
  - [ ] From NextAuth.js to Latch
  - [ ] From @azure/msal-browser to Latch
  - [ ] Version upgrade guides (v0.2→v0.3, v0.3→v1.0)
- [ ] Create codemods for breaking changes (if any)
- [ ] Add deprecation warnings for old APIs
- [ ] Test upgrade paths end-to-end
- [ ] Document breaking changes in CHANGELOG

#### Week 24: Performance & Scalability
- [ ] Benchmark performance
  - [ ] Cookie seal/unseal time
  - [ ] Token refresh latency
  - [ ] JWKS validation time
  - [ ] Middleware overhead
- [ ] Optimize hot paths
  - [ ] Cache JWKS more aggressively
  - [ ] Reduce API route overhead
- [ ] Load test (100 concurrent users)
- [ ] Document performance characteristics

#### Week 25: Final Polish & Release Prep
- [ ] Final documentation review
  - [ ] Check all links work
  - [ ] Verify code examples compile
- [ ] Create comprehensive examples
  - [ ] Basic setup
  - [ ] GCC-High configuration
  - [ ] Multi-tenant setup
- [ ] Update README badges
- [ ] Create release checklist
- [ ] Record final demo video
- [ ] Write launch blog post

#### Week 26: v1.0 Launch 🚀
- [ ] Final testing on fresh VM
- [ ] Version bump to v1.0.0
- [ ] Update CHANGELOG
- [ ] Create git tag and GitHub release
- [ ] Publish to npm
- [ ] Announce publicly
  - [ ] Hacker News
  - [ ] Reddit (r/nextjs, r/webdev)
  - [ ] Twitter/X, LinkedIn
  - [ ] Dev.to
- [ ] Email beta testers
- [ ] Monitor for issues (48 hours)

### Planned Features

- [ ] **Security**
  - [ ] Third-party security audit
  - [ ] Penetration testing
  - [ ] FIPS compliance verification
  - [ ] CVE monitoring process

- [ ] **DoD Cloud**
  - [ ] IL5 compliance documentation
  - [ ] DoD-specific configuration guide
  - [ ] Certificate-based auth examples (PIV/CAC)

- [ ] **Publishing**
  - [ ] Published npm package (`latch` or `@latch/next`)
  - [ ] Semantic versioning policy
  - [ ] Changesets for release management
  - [ ] GitHub releases with changelogs

- [ ] **Migration Guides**
  - [ ] From NextAuth.js to Latch
  - [ ] From @azure/msal-browser to Latch
  - [ ] From custom OAuth to Latch
  - [ ] Version upgrade guides

- [ ] **Ecosystem**
  - [ ] Starter templates repository
  - [ ] GitHub Actions workflow examples
  - [ ] Terraform modules for Azure AD app registration
  - [ ] Docker examples for deployment

- [ ] **Community**
  - [ ] Contributing guidelines (CONTRIBUTING.md)
  - [ ] Code of conduct
  - [ ] Issue templates
  - [ ] PR templates
  - [ ] Governance model (GOVERNANCE.md)

- [ ] **Performance**
  - [ ] Token refresh <100ms (p95)
  - [ ] No memory leaks under load
  - [ ] Scales to 1000+ concurrent users

### Success Metrics

- [ ] 1,000 npm downloads/month
- [ ] >5 production deployments (self-reported)
- [ ] >200 GitHub stars
- [ ] >1 IL4/IL5 case study
- [ ] Zero critical security issues
- [ ] <7 day security issue resolution SLA
- [ ] No critical bugs in first 48 hours after launch

---

## 🔮 Post-v1.0 (Community-Driven)

**Status:** 💡 Ideas
**Target:** Community demand

Features that extend beyond the core Next.js focus.

### Potential Features

- [ ] **`latch/react`** - Router-agnostic React SPA support
  - [ ] Works with React Router, Remix, etc.
  - [ ] Client-side only mode (no Next.js)
  - [ ] BFF (Backend-for-Frontend) pattern examples

- [ ] **`latch/node`** - Server-side token validation library
  - [ ] Express middleware
  - [ ] Fastify plugin
  - [ ] Standalone JWT validator

- [ ] **`latch/cli`** - Enhanced developer tools
  - [ ] OIDC flow debugger
  - [ ] Token inspector (decode JWTs)
  - [ ] Azure AD troubleshooting assistant

- [ ] **Adapter Ecosystem**
  - [ ] Remix adapter
  - [ ] SvelteKit adapter
  - [ ] Nuxt adapter (if community interest)

- [ ] **Advanced Features**
  - [ ] Rate limiting helpers
  - [ ] Session analytics
  - [ ] Audit logging hooks
  - [ ] Custom IdP support (beyond Azure AD)

### Requirements

- **Community-driven:** Only build if >50 users request
- **Maintainer availability:** Requires additional contributors
- **Backward compatibility:** Must not break existing Latch apps

---

## Version History

| Version | Released   | Status | Highlights |
|---------|------------|--------|------------|
| v0.1.0  | 2025-10-21 | ✅ Complete | Core OIDC flow, PKCE, encrypted cookies |
| v0.2.0  | TBD        | 🔜 Planned | Enhanced errors, background refresh |
| v0.3.0  | TBD        | 📋 Planned | Docs site, CLI tools, examples |
| v1.0.0  | TBD        | 💭 Planned | Security audit, npm publish, migration guides |

---

## How to Contribute

Want to help ship these features? Check out:

1. **[Good First Issues](https://github.com/yourusername/latch/labels/good%20first%20issue)** - Entry points for new contributors
2. **[Help Wanted](https://github.com/yourusername/latch/labels/help%20wanted)** - Features that need owners
3. **CONTRIBUTING.md** - Guidelines for PRs and code style

### Priority Areas

We're especially looking for help with:

- 🧪 **Testing:** Integration tests, E2E tests, security tests
- 📚 **Documentation:** Guides, examples, troubleshooting
- 🔧 **Tooling:** CLI development, config validators
- 🔒 **Security:** Audit, review, vulnerability testing

---

## Risk Management

### Critical Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Breaking Azure AD changes** | High | Low | Monitor Azure AD changelog; version lock dependencies |
| **Security vulnerability found** | Critical | Medium | Bug bounty program; fast patch process; security@latch.dev contact |
| **Poor adoption** | High | Medium | Focus on Gov cloud niche; direct outreach; case studies |
| **Maintainer burnout** | High | Medium | Manage scope carefully; recruit co-maintainer by v1.0 |
| **Next.js breaking changes** | Medium | Medium | Test against Next.js canary; document version compatibility |
| **Competition launches** | Medium | Low | Stay focused on Gov niche; transparency advantage |

### Contingency Plans

**If behind schedule:**
- Cut scope (e.g., delay CLI tool to post-v1.0)
- Extend timeline (v1.0 at 8 months instead of 6)
- Focus on core flows first, defer nice-to-haves

**If critical bug found:**
- Patch release <24 hours
- Security advisory on GitHub
- Direct notification to known users
- Post-mortem and additional tests

**If adoption is slow:**
- Double down on documentation
- Direct outreach to Gov contractors
- Write comparison guides vs NextAuth/MSAL
- Offer free setup assistance (first 10 users)

---

## Resources & Budget

### Development Tools

- **pnpm** - Package manager (free)
- **Next.js 15** - Framework (free)
- **TypeScript** - Language (free)
- **Vitest** - Testing (free)
- **Turborepo** - Monorepo (free)
- **Docusaurus** - Docs site (free)

### Services

- **GitHub** - Code hosting + CI/CD (free tier)
- **npm** - Package registry (free)
- **Vercel/Netlify** - Docs hosting (free tier)
- **Domain**: `latch.dev` (~$15/year)
- **Security review** - $3k-$10k (one-time, v1.0)

### Total First-Year Budget

- Domain: $15/year
- Security audit: $5,000 (one-time, optional but recommended)
- **Total: ~$5,015**

### Time Commitment

| Phase | Weeks | Hours/Week | Total Hours |
|-------|-------|------------|-------------|
| v0.1  | 1-8   | 15-20      | 120-160     |
| v0.2  | 9-12  | 10-15      | 40-60       |
| v0.3  | 13-18 | 15-20      | 90-120      |
| v1.0  | 19-26 | 10-15      | 80-120      |
| **Total** | **26 weeks** | **avg 13-18** | **330-460** |

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

---

## Next Steps

### This Week (Current: v0.1 Complete)
1. ✅ Initialize repository
2. ✅ Implement core library
3. ✅ Create example app
4. ✅ Write documentation
5. 🔜 Start v0.2 planning

### Next 4 Weeks (v0.2)
1. Enhance Direct Token mode
2. Improve error handling
3. Expand test coverage to >80%
4. Get beta tester feedback

---

**Questions?** Open a [GitHub Discussion](https://github.com/lance/latch/discussions)
**Found a bug?** Submit an [Issue](https://github.com/lance/latch/issues)
**Security issue?** Email `security@latch.dev`
