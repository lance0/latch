# Latch Roadmap

**Last Updated:** 2025-11-12  
**Current Version:** v0.4.1  
**Status:** Production-ready! Used in live applications

---

## Timeline

| Version | Released | Status | Highlights |
|---------|----------|--------|------------|
| v0.1 | 2025-10-21 | ✅ Complete | Core OIDC, PKCE, encrypted cookies |
| v0.2 | 2025-10-22 | ✅ Complete | Enhanced DX, security tests, auto-refresh |
| v0.3 | 2025-10-23 | ✅ Complete | Monorepo, CLI, dual auth modes |
| v0.3.0 | 2025-11-04 | ✅ Complete | Published to npm! Apache 2.0 license |
| v0.4.0 | 2025-11-12 | ✅ Complete | Server Actions, examples, migration guides |
| v0.4.1 | 2025-11-12 | ✅ Complete | Token confusion prevention, enhanced CLI |
| v1.0 | TBD | 💡 Future | OBO flows, security audit (when needed) |

**Total Effort:** ~300 hours  
**Production Status:** ✅ In use in live applications

---

## ✅ Completed Features

### Core Authentication
- ✅ PKCE S256 OAuth 2.0 flow
- ✅ AES-GCM-256 encrypted HttpOnly cookies
- ✅ Azure Government cloud support (Commercial, GCC-High, DoD)
- ✅ Dual auth modes (Public PKCE / Confidential client_secret)
- ✅ Token refresh with exponential backoff
- ✅ Token confusion attack prevention (v0.4.1)
- ✅ Configurable security settings

### Next.js Integration
- ✅ React hooks (`useLatch`, `useAccessToken`)
- ✅ `<LatchProvider>` context provider
- ✅ Server Components support
- ✅ Server Actions (`getServerSession`, `requireAuth`)
- ✅ Middleware protection patterns
- ✅ API routes for all OAuth flows

### Developer Experience
- ✅ CLI tools: `init`, `generate-secret`, `scaffold`, `validate`, `doctor`
- ✅ Example apps for each cloud (commercial, gcc-high)
- ✅ Migration guides (NextAuth.js, MSAL)
- ✅ Comprehensive documentation
- ✅ TypeScript-first with full IntelliSense

### Testing & Quality
- ✅ 161 unit tests (66 security-focused)
- ✅ Production usage validation
- ✅ Government cloud tested (GCC-High, DoD)

---

## 💡 Future (v1.0+)

These features will be added based on community needs:

### On-Behalf-Of (OBO) Flows
For multi-tier architectures (web app → API → downstream services).  
**Status:** Not yet requested by users  
**Effort:** ~20 hours when needed

### External Security Audit
Third-party OIDC security review for enterprise adoption.  
**Status:** Not needed for passion project  
**Cost:** ~$5k-$10k if pursued

### Additional Features
- Correlation IDs for audit logging
- Front-channel logout support
- Performance benchmarks
- Starter templates

---

## Current Status

### What Works Today
- ✅ Production-ready for Next.js 15+ App Router
- ✅ Azure AD authentication (all clouds)
- ✅ Server-side and client-side patterns
- ✅ Comprehensive tooling and documentation
- ✅ Battle-tested in live applications

### What's Not Included
- ❌ Multiple OAuth providers (Azure AD only)
- ❌ OBO token exchange (coming when needed)
- ❌ External security audit (passion project)
- ❌ Database session storage (cookies only)

### v1.0 Criteria

**v1.0 will ship when:**
1. Community requests OBO flows for multi-tier apps
2. External security audit desired for enterprise adoption
3. Additional features needed by users

**Current focus:**  
Stability, bug fixes, community support, documentation improvements

---

## Development Metrics

| Metric | Value |
|--------|-------|
| **Development Time** | ~300 hours |
| **Releases** | v0.1 → v0.4.1 (7 versions) |
| **Tests** | 161 passing |
| **Documentation** | 10+ guides |
| **Production Usage** | ✅ Live applications |
| **License** | Apache 2.0 |

---

## Resources

- **Issues:** [GitHub Issues](https://github.com/lance0/latch/issues)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)
- **Documentation:** [README.md](./README.md)
- **Migration:** [docs/MIGRATION_FROM_NEXTAUTH.md](./docs/MIGRATION_FROM_NEXTAUTH.md)
