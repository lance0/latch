# NextAuth Azure Government Cloud Support - Contribution Roadmap

## Executive Summary

**Total Effort**: ~120-200 hours over 3-6 months
**Success Probability**: 60-70% (depends on maintainer buy-in)
**Key Risk**: Feature might be deprioritized or rejected by maintainers
**Opportunity Cost**: Could build Latch v0.3-v1.0 in same timeframe

---

## Phase 1: Research & RFC Discussion (Weeks 1-3)

### Week 1: Deep Dive Research
**Effort**: 15-20 hours

**Tasks**:
- [ ] Fork nextauthjs/next-auth repo
- [ ] Set up local development environment (Turborepo + pnpm)
- [ ] Study existing provider patterns (azure-ad.ts, microsoft-entra-id.ts)
- [ ] Research Auth.js v5 provider API changes
- [ ] Review closed PRs/issues related to Azure providers
- [ ] Study how other providers handle custom endpoints (e.g., Auth0 custom domains)
- [ ] Test current Microsoft Entra ID provider with Gov cloud manually

**Deliverables**:
- Technical feasibility report
- List of required code changes
- Estimate of backward compatibility impact

**Potential Blockers**:
- Turborepo setup issues (complex monorepo)
- Understanding full provider lifecycle (authorization, token exchange, profile fetch)
- Identifying all hardcoded `.com` endpoints

---

### Week 2: RFC Draft & Community Engagement
**Effort**: 10-15 hours

**Tasks**:
- [ ] Write RFC Discussion post on GitHub
- [ ] Title: "RFC: Azure Government Cloud Support (GCC-High, DoD)"
- [ ] Include:
  - Problem statement (no Gov cloud docs, hardcoded `.com` endpoints)
  - Proposed solution (cloud parameter or custom endpoints)
  - API design (backward compatible)
  - Example configuration
  - Migration path for existing users
- [ ] Tag relevant maintainers (@balazsorban44, @ndom91)
- [ ] Cross-post to Auth.js Discord for visibility

**RFC Example Outline**:
```markdown
## Problem
Azure Government clouds (GCC-High IL4, DoD IL5) use different endpoints:
- Login: login.microsoftonline.us (not .com)
- Graph: graph.microsoft.us / dod-graph.microsoft.us (not .com)

Current MicrosoftEntraID provider hardcodes commercial endpoints.

## Proposed Solution
Add optional `cloud` parameter to MicrosoftEntraID provider:

```typescript
MicrosoftEntraID({
  clientId: "...",
  clientSecret: "...",
  cloud: "gcc-high", // commercial | gcc-high | dod
})
```

Or allow custom endpoint overrides:

```typescript
MicrosoftEntraID({
  clientId: "...",
  issuer: "https://login.microsoftonline.us/tenant-id/v2.0",
  graphBaseUrl: "https://graph.microsoft.us",
})
```

## Breaking Changes
None - defaults to commercial cloud (current behavior)
```

**Deliverables**:
- Published RFC discussion
- Initial community feedback

**Potential Blockers**:
- Maintainers might prefer generic approach (not Azure-specific)
- Could request "just use custom issuer" (minimal documentation)
- Might get ignored (low priority for team)

---

### Week 3: RFC Iteration & Consensus Building
**Effort**: 5-10 hours

**Tasks**:
- [ ] Respond to community feedback
- [ ] Refine API design based on maintainer input
- [ ] Research similar patterns in other providers
- [ ] Build consensus on approach (cloud param vs custom endpoints)
- [ ] Get explicit "green light" from core maintainer

**Decision Point**:
- ✅ **Proceed** if maintainers express interest and approve design
- ⚠️ **Pivot** if they suggest alternative approach (implement their way)
- ❌ **Abort** if rejected or no response after 2 weeks

**Historical Precedent**:
- NextAuth has ~800 open issues and ~200 open PRs
- Response time varies (24 hours to never)
- Some features languish in discussion for months

---

## Phase 2: Implementation (Weeks 4-6)

### Week 4: Core Provider Changes
**Effort**: 20-25 hours

**Tasks**:
- [ ] Modify `packages/core/src/providers/microsoft-entra-id.ts`:
  ```typescript
  export type AzureCloud = "commercial" | "gcc-high" | "dod"

  export interface MicrosoftEntraIDOptions {
    cloud?: AzureCloud
    graphBaseUrl?: string // Advanced: custom Graph endpoint
  }

  export default function MicrosoftEntraID(
    config: OIDCUserConfig<MicrosoftEntraIDProfile> & MicrosoftEntraIDOptions
  ): OIDCConfig<MicrosoftEntraIDProfile> {
    const endpoints = getAzureEndpoints(config.cloud ?? "commercial", config.tenantId)

    return {
      id: "microsoft-entra-id",
      name: "Microsoft Entra ID",
      type: "oidc",
      issuer: config.issuer ?? endpoints.issuer,
      authorization: {
        url: endpoints.authorization,
        params: { scope: "openid profile email User.Read" }
      },
      token: { url: endpoints.token },
      userinfo: { url: endpoints.userinfo },
      profile: async (profile, tokens) => {
        const graphUrl = config.graphBaseUrl ?? endpoints.graphBaseUrl
        // Fetch profile photo from correct Graph endpoint
        const photo = await fetch(`${graphUrl}/v1.0/me/photos/${size}x${size}/$value`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        })
        // ...
      }
    }
  }

  function getAzureEndpoints(cloud: AzureCloud, tenantId: string) {
    const configs = {
      commercial: {
        loginBase: "https://login.microsoftonline.com",
        graphBaseUrl: "https://graph.microsoft.com"
      },
      "gcc-high": {
        loginBase: "https://login.microsoftonline.us",
        graphBaseUrl: "https://graph.microsoft.us"
      },
      dod: {
        loginBase: "https://login.microsoftonline.us",
        graphBaseUrl: "https://dod-graph.microsoft.us"
      }
    }

    const { loginBase, graphBaseUrl } = configs[cloud]

    return {
      issuer: `${loginBase}/${tenantId}/v2.0`,
      authorization: `${loginBase}/${tenantId}/oauth2/v2.0/authorize`,
      token: `${loginBase}/${tenantId}/oauth2/v2.0/token`,
      userinfo: `${graphBaseUrl}/oidc/userinfo`,
      graphBaseUrl
    }
  }
  ```

- [ ] Add TypeScript types
- [ ] Ensure backward compatibility (default to commercial)
- [ ] Run `pnpm lint` and `pnpm format`

**Potential Blockers**:
- Type conflicts with `OIDCConfig`
- Profile photo fetching might need refactor
- Maintainers might request different architecture

---

### Week 5: Testing
**Effort**: 15-20 hours

**Tasks**:
- [ ] Create test file: `packages/core/test/providers/microsoft-entra-id.test.ts`
- [ ] Test cases:
  ```typescript
  describe("MicrosoftEntraID - Azure Government Clouds", () => {
    test("defaults to commercial cloud", () => {
      const provider = MicrosoftEntraID({ clientId: "...", clientSecret: "..." })
      expect(provider.authorization.url).toContain("login.microsoftonline.com")
    })

    test("uses GCC-High endpoints when cloud=gcc-high", () => {
      const provider = MicrosoftEntraID({
        clientId: "...",
        clientSecret: "...",
        cloud: "gcc-high",
        tenantId: "tenant-id"
      })
      expect(provider.authorization.url).toContain("login.microsoftonline.us")
      expect(provider.issuer).toContain("login.microsoftonline.us")
    })

    test("uses DoD Graph endpoint when cloud=dod", () => {
      const provider = MicrosoftEntraID({
        clientId: "...",
        cloud: "dod",
        tenantId: "tenant-id"
      })
      // Profile fetching should use dod-graph.microsoft.us
      // (This is complex - might need to mock fetch)
    })

    test("allows custom graphBaseUrl override", () => {
      const provider = MicrosoftEntraID({
        clientId: "...",
        graphBaseUrl: "https://custom-graph.example.com"
      })
      // Verify custom endpoint is used
    })
  })
  ```

- [ ] Test with actual Azure Gov test tenant (if available)
- [ ] Run full test suite: `pnpm test`
- [ ] Verify no regressions in other providers

**Potential Blockers**:
- Limited test coverage in NextAuth (their tests are "crude")
- No access to Azure Gov test tenant (might need to mock)
- Async profile fetching hard to test

---

### Week 6: Documentation
**Effort**: 10-15 hours

**Tasks**:
- [ ] Update JSDoc in `microsoft-entra-id.ts`:
  ```typescript
  /**
   * Microsoft Entra ID OAuth provider
   *
   * Supports Azure Commercial, GCC-High (IL4), and DoD (IL5) clouds.
   *
   * @example
   * ```ts
   * // Azure Commercial (default)
   * MicrosoftEntraID({
   *   clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
   *   clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
   * })
   *
   * // Azure Government GCC-High
   * MicrosoftEntraID({
   *   clientId: process.env.CLIENT_ID,
   *   clientSecret: process.env.CLIENT_SECRET,
   *   cloud: "gcc-high",
   *   tenantId: process.env.TENANT_ID,
   * })
   *
   * // Azure Government DoD
   * MicrosoftEntraID({
   *   clientId: process.env.CLIENT_ID,
   *   clientSecret: process.env.CLIENT_SECRET,
   *   cloud: "dod",
   *   tenantId: process.env.TENANT_ID,
   * })
   * ```
   *
   * @see [Azure Government Docs](https://learn.microsoft.com/azure/azure-government/)
   */
  ```

- [ ] Create docs page: `docs/content/providers/microsoft-entra-id.mdx`
- [ ] Add section: "Using with Azure Government Clouds"
- [ ] Include environment variable examples
- [ ] Add troubleshooting section (common issues with Gov clouds)
- [ ] Update bug report template to include cloud parameter

**Deliverables**:
- Complete JSDoc comments
- Documentation page with Gov cloud examples
- Updated bug report template

**Potential Blockers**:
- Docs site uses MDX with custom components (learning curve)
- Maintainers might request specific doc format

---

## Phase 3: PR Submission & Review (Weeks 7-10)

### Week 7: PR Preparation
**Effort**: 5-10 hours

**Tasks**:
- [ ] Create feature branch: `feat/azure-government-cloud-support`
- [ ] Squash commits into logical units
- [ ] Write comprehensive PR description:
  - Link to RFC discussion
  - Problem statement
  - Solution approach
  - Breaking changes (none)
  - Testing done
  - Screenshots/examples
- [ ] Self-review (check CONTRIBUTING.md checklist)
- [ ] Run final checks:
  ```bash
  pnpm lint
  pnpm format
  pnpm typecheck
  pnpm test
  pnpm build
  ```
- [ ] Submit PR to `nextauthjs/next-auth:main`

**PR Template**:
```markdown
## Description
Adds support for Azure Government clouds (GCC-High, DoD) to MicrosoftEntraID provider.

Fixes: [Link to RFC discussion]

## Changes
- Added `cloud` parameter to MicrosoftEntraID provider options
- Added `getAzureEndpoints()` helper for endpoint mapping
- Updated profile photo fetching to use correct Graph endpoint
- Added TypeScript types for `AzureCloud`
- Added tests for all three cloud environments
- Added documentation with examples

## Breaking Changes
None - defaults to existing commercial cloud behavior

## Testing
- [x] All existing tests pass
- [x] New tests for GCC-High and DoD configurations
- [x] Manual testing with Azure Gov test tenant

## Checklist
- [x] Code follows NextAuth style guide
- [x] Tests added/updated
- [x] Documentation updated
- [x] JSDoc comments added
- [x] No breaking changes (backward compatible)
```

**Deliverables**:
- Clean PR ready for review

---

### Week 8-10: Review Cycles & Iteration
**Effort**: 15-30 hours (highly variable)

**Realistic Timeline**:
- **First review**: 3-14 days after submission
- **Feedback cycles**: 2-5 rounds
- **Final approval**: 4-8 weeks from initial submission

**Common Feedback**:
- "Can you add more tests?"
- "Please update the documentation"
- "Can you rebase on latest main?"
- "Let's use a different API structure"
- "Can you fix merge conflicts?"

**Tasks**:
- [ ] Respond to all review comments within 48 hours
- [ ] Make requested changes promptly
- [ ] Re-request review after updates
- [ ] Keep PR up-to-date with main branch
- [ ] Be patient and professional

**Potential Blockers**:
- Maintainers busy with other priorities
- PR sits idle for weeks
- Major refactor requested (start over)
- Conflicting opinions between maintainers
- Scope creep ("can you also add China cloud?")

**Political Considerations**:
- NextAuth recently rebranded to Auth.js (organizational changes)
- Vercel sponsorship might prioritize their use cases
- Government cloud support might not align with their roadmap
- Limited maintainer bandwidth (high PR backlog)

---

## Phase 4: Post-Merge Maintenance (Ongoing)

### Week 11+: After Merge
**Effort**: 5-10 hours/month

**Tasks**:
- [ ] Monitor issues related to Azure Gov cloud support
- [ ] Fix bugs reported by early adopters
- [ ] Update docs based on user feedback
- [ ] Respond to questions in Discord/Discussions
- [ ] Maintain feature compatibility with Auth.js updates

**Long-term Commitment**:
- You become the "Azure Gov cloud expert" in the community
- Expected to maintain the feature indefinitely
- Future breaking changes might require your input

---

## Risk Analysis

### High Probability Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PR sits idle for months | 40% | High | Ping weekly, escalate to Discord |
| Major refactor requested | 30% | Medium | Negotiate scope, consider compromise |
| Feature rejected | 15% | Critical | Pivot to forked provider package |
| Merge conflicts during review | 50% | Low | Keep rebasing, automate with GitHub Actions |
| Limited test tenant access | 60% | Medium | Use mocks, document manual testing |

### Critical Success Factors

✅ **Must Have**:
1. Explicit maintainer approval on RFC (Week 3)
2. Backward compatibility (no breaking changes)
3. Comprehensive tests (even if mocked)
4. Clear documentation with examples

⚠️ **Nice to Have**:
1. Real Azure Gov tenant for testing
2. Performance benchmarks
3. Migration guide from manual config
4. Video tutorial

---

## Effort Comparison: NextAuth Contribution vs Latch Development

### NextAuth Contribution Path
**Total Effort**: 120-200 hours over 3-6 months

| Phase | Hours | Calendar Time |
|-------|-------|---------------|
| Research & RFC | 30-45 | 3 weeks |
| Implementation | 45-60 | 3 weeks |
| PR Review Cycles | 30-60 | 4-8 weeks |
| Post-merge Support | 15-35 | Ongoing |
| **Total** | **120-200** | **3-6 months** |

**Outcomes**:
- ✅ Benefits entire NextAuth community (~474k dependents)
- ✅ Resume boost (contribution to major OSS project)
- ❌ No control over timeline
- ❌ Feature might get de-prioritized
- ❌ Ongoing maintenance burden

---

### Latch Development Path (v0.3 - v1.0)
**Total Effort**: 120-160 hours over 3-4 months

| Phase | Hours | Calendar Time |
|-------|-------|---------------|
| v0.3: Monorepo + NPM Publish | 40 | 4 weeks |
| v0.4: Second Example App | 30 | 3 weeks |
| v0.5: Cloud Validator CLI | 20 | 2 weeks |
| v0.6: Docs Site (Docusaurus) | 30 | 3 weeks |
| v1.0: Security Audit + Polish | 40 | 4 weeks |
| **Total** | **160** | **4 months** |

**Outcomes**:
- ✅ Full control over roadmap
- ✅ Ship on your schedule
- ✅ Build exactly what you need
- ✅ Potential product/consulting opportunities
- ❌ Smaller user base (at first)
- ❌ You maintain everything

---

## Hybrid Approach (Recommended)

### Strategy: "Contribute While Building"

**Phase 1 (Weeks 1-4)**: Try NextAuth Contribution
- Submit RFC discussion
- Gauge maintainer interest
- Start implementation if approved

**Phase 2 (Weeks 5-8)**: Parallel Development
- Continue Latch v0.3 (monorepo migration)
- Keep NextAuth PR updated
- See which progresses faster

**Phase 3 (Weeks 9-12)**: Decision Point
- ✅ **If NextAuth PR merged**: Ship Latch v1.0 as "lightweight alternative" (differentiate on transparency/auditability)
- ❌ **If NextAuth PR stalled**: Publish Latch with "NextAuth doesn't support Gov clouds" messaging
- 🤷 **If NextAuth PR in limbo**: Continue both, focus on Latch

**Benefits**:
- Reduces risk (don't bet on one path)
- Maximizes learning
- Keeps options open
- Community contribution regardless of outcome

---

## Final Recommendation

### If You Value...

**Impact & Resume** → Contribute to NextAuth (help 474k projects)
**Control & Speed** → Build Latch (ship v1.0 in 4 months)
**Risk Mitigation** → Hybrid approach (try both, commit to winner)

### My Honest Assessment

NextAuth contribution is **honorable but risky**:
- 40% chance PR merges smoothly
- 40% chance it drags on for months
- 20% chance it gets rejected/ignored

Latch development is **pragmatic and safer**:
- You control timeline
- You ship when ready
- Gov cloud users get a solution NOW (not in 6 months, maybe)

**What I'd Do**:

1. **Week 1**: Submit NextAuth RFC (2 hours)
2. **Weeks 2-4**: Start Latch v0.3 monorepo (40 hours)
3. **Week 5**: Check RFC response
   - If positive → dedicate 50% time to NextAuth PR
   - If negative/silent → 100% focus on Latch

**Rationale**: Don't wait on NextAuth to solve a problem you can solve yourself. Contribute if they're receptive, but don't block your progress on their priorities.

---

## Next Steps (Your Decision)

### Option A: Try NextAuth First
```bash
# Fork and clone
gh repo fork nextauthjs/next-auth
cd next-auth
pnpm install

# Open RFC discussion
# Title: "RFC: Azure Government Cloud Support (GCC-High, DoD)"
```

### Option B: Continue Latch
```bash
# Start v0.3 monorepo migration
cd latch
mkdir -p packages/latch apps/example-app
# ... (continue roadmap)
```

### Option C: Hybrid
```bash
# Do both in parallel
# 20% time on NextAuth RFC + PR
# 80% time on Latch development
```

---

## Questions to Clarify

1. **Are you building for Gov clouds yourself?** (If yes → Latch makes more sense)
2. **Do you have time for 6-month NextAuth PR cycle?** (If no → Latch is faster)
3. **Do you want to become "the NextAuth Azure Gov expert"?** (Ongoing commitment)
4. **Is this a learning project or solving real problem?** (Learning → NextAuth, Real problem → Latch)

What's your primary goal here?
