# Pre-Publishing Roadmap

**Goal:** Publish `@latch/core` and `@latch/cli` to npm with confidence

**Current Status:** 90% ready - just polish and verification needed
**Estimated Time to Publish:** 4-6 hours of work
**Risk Level:** Low (private packages, can unpublish within 72 hours if needed)

---

## Phase 1: Testing & Verification (2-3 hours)

### Critical Tests ⚠️ (Must Complete)

- [ ] **Local package linking test** (30 min)
  ```bash
  cd packages/latch
  pnpm link --global

  cd ~/test-project
  pnpm link --global @latch/core
  # Verify import works, types work, no build errors
  ```

- [ ] **CLI functionality test** (20 min)
  - [ ] `generate-secret` produces different secrets each run
  - [ ] `generate-secret` output is valid base64 (32 bytes decoded)
  - [ ] `init` validates UUID format correctly
  - [ ] `init` creates `.env.local` with all required fields
  - [ ] `init` shows GCC-High warnings when cloud=gcc-high
  - [ ] `init` shows DoD warnings when cloud=dod

- [ ] **Full authentication flow test** (30 min)
  - [ ] Using example-app with REAL Azure AD credentials
  - [ ] Sign in → redirects to Microsoft → redirects back
  - [ ] User session persists across page reload
  - [ ] Protected routes redirect when not authenticated
  - [ ] Sign out clears cookies and session
  - [ ] Middleware protection works

- [ ] **Run all tests** (10 min)
  ```bash
  cd packages/latch
  pnpm test --run
  # Should see: ✓ 126 tests passed
  ```

- [ ] **TypeScript compilation** (5 min)
  ```bash
  pnpm typecheck
  # Should complete with no errors
  ```

- [ ] **Build verification** (5 min)
  ```bash
  pnpm build
  # Verify dist/ contains:
  # - index.js (ESM)
  # - index.cjs (CJS)
  # - index.d.ts (types)
  # - react/index.js, react/index.cjs, react/index.d.ts
  ```

### Recommended Tests (Should Complete)

- [ ] **Package size check** (5 min)
  ```bash
  cd packages/latch
  pnpm pack
  # Check tarball size (should be <50KB)
  tar -tzf latch-core-*.tgz
  # Verify only dist/ and docs are included (not src/ or tests/)
  ```

- [ ] **Fresh install test** (15 min)
  ```bash
  mkdir /tmp/latch-fresh-test
  cd /tmp/latch-fresh-test
  npm init -y
  npm install /home/lance/latch/packages/latch/latch-core-*.tgz

  # Try importing
  node -e "import('@latch/core').then(console.log)"
  ```

- [ ] **Different Node versions** (10 min, optional)
  ```bash
  # Test with Node 18, 20, 22 if you have nvm
  nvm use 18 && pnpm build && pnpm test --run
  nvm use 20 && pnpm build && pnpm test --run
  ```

### Optional But Good Tests

- [ ] **Performance test**
  - Time to import: `node -e "console.time('import'); import('@latch/core'); console.timeEnd('import')"`
  - Should be <50ms

- [ ] **Bundle size analysis**
  ```bash
  cd packages/latch
  npx esbuild dist/index.js --bundle --minify --analyze
  ```

---

## Phase 2: Documentation Polish (1-2 hours)

### Package README Updates

- [ ] **packages/latch/README.md** (30 min)
  - [ ] Add installation instructions
  - [ ] Verify all code examples work (copy-paste test them)
  - [ ] Add "Getting Started" section with 3-minute quickstart
  - [ ] Add badge placeholders (will update after publish):
    ```markdown
    [![npm version](https://badge.fury.io/js/%40latch%2Fcore.svg)](https://badge.fury.io/js/%40latch%2Fcore)
    [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
    ```
  - [ ] Add "Why Latch?" section (differentiation from NextAuth)
  - [ ] Link to main docs and troubleshooting

- [ ] **packages/latch-cli/README.md** (15 min)
  - [ ] Verify CLI examples are correct
  - [ ] Add GIF/screenshot of `init` wizard (optional but nice)
  - [ ] Add troubleshooting section

- [ ] **Root README.md** (15 min)
  - [ ] Add npm installation instructions
  - [ ] Make sure Quick Start is clear and accurate
  - [ ] Update "What's Latch?" intro to be compelling
  - [ ] Add "Community" section with links to issues/discussions

### Documentation Completeness

- [ ] **API_REFERENCE.md** (15 min review)
  - [ ] All public APIs documented
  - [ ] Examples for each hook/component
  - [ ] Type signatures accurate

- [ ] **TROUBLESHOOTING.md** (10 min review)
  - [ ] Common errors covered
  - [ ] Solutions are actionable
  - [ ] Add "Getting Help" section

- [ ] **CHANGELOG.md** (10 min)
  - [ ] Add v0.3.0 release notes
  - [ ] List all new features since v0.2
  - [ ] Note breaking changes (if any)

### Nice to Have

- [ ] Create CONTRIBUTING.md (how others can contribute)
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Add examples/ directory with common use cases

---

## Phase 3: Package Metadata & Legal (30 min)

### package.json Review

**@latch/core:**

- [ ] Verify `version` is correct (0.3.0)
- [ ] Verify `author` is "lance0"
- [ ] Verify `repository.url` is "https://github.com/lance0/latch.git"
- [ ] Check `keywords` are SEO-friendly:
  ```json
  "keywords": [
    "nextjs",
    "authentication",
    "oidc",
    "oauth",
    "azure",
    "azure-ad",
    "azure-government",
    "gcc-high",
    "dod",
    "pkce",
    "security",
    "entra",
    "microsoft"
  ]
  ```
- [ ] Verify `peerDependencies` versions are correct
- [ ] Add `funding` field (optional):
  ```json
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/lance0"
  }
  ```

**@latch/cli:**

- [ ] Same checks as above
- [ ] Verify `bin` field points to correct file
- [ ] Check dependencies (commander, prompts, chalk) are latest stable

### Legal & Licensing

- [ ] **LICENSE file** (5 min)
  - [ ] Verify Apache 2.0 license is in packages/latch/LICENSE
  - [ ] Verify Apache 2.0 license is in packages/latch-cli/LICENSE
  - [ ] Check copyright year (2025)
  - [ ] Check copyright holder (lance0 or your legal name)

- [ ] **SECURITY.md** (10 min review)
  - [ ] Vulnerability reporting process is clear
  - [ ] Contact email is valid
  - [ ] Supported versions listed

- [ ] **Code audit** (15 min)
  - [ ] No API keys or secrets in code
  - [ ] No TODO comments with security concerns
  - [ ] No debugging console.logs that leak sensitive data
  - [ ] All error messages are user-safe (no token exposure)

### Registry Compliance

- [ ] **.npmignore review**
  - [ ] Excludes `src/`, `__tests__/`, `*.test.ts`
  - [ ] Excludes config files (tsconfig, vitest, tsup)
  - [ ] Includes only `dist/`, `README.md`, `LICENSE`

- [ ] **files field** in package.json
  - [ ] Lists only what should be published
  - [ ] Verify with `npm pack --dry-run`

---

## Phase 4: Security & Dependency Audit (30 min)

### Dependency Security

- [ ] **Run audit** (5 min)
  ```bash
  pnpm audit
  # Should show: 0 vulnerabilities
  ```

- [ ] **If vulnerabilities found:**
  - [ ] Check severity (low/moderate/high/critical)
  - [ ] Update dependencies: `pnpm update`
  - [ ] Re-run tests after updates
  - [ ] If unfixable, document in SECURITY.md

- [ ] **Check dependency count** (5 min)
  ```bash
  # @latch/core should only have 'jose'
  cd packages/latch
  npm ls --production

  # @latch/cli should have commander, prompts, chalk
  cd packages/latch-cli
  npm ls --production
  ```

### Code Security Review

- [ ] **Crypto usage audit** (10 min)
  - [ ] `crypto.randomBytes()` used for secrets ✓
  - [ ] PBKDF2 iterations are sufficient (100k+) ✓
  - [ ] AES-GCM used for cookie encryption ✓
  - [ ] No weak algorithms (MD5, SHA1 for crypto)

- [ ] **Input validation** (10 min)
  - [ ] UUID validation in CLI ✓
  - [ ] State parameter validation ✓
  - [ ] Nonce validation ✓
  - [ ] Return URL whitelist ✓
  - [ ] Scope validation for cloud mismatch ✓

---

## Phase 5: npm Account Setup (15 min)

### If You Don't Have npm Account

- [ ] **Create account** (5 min)
  - Go to https://www.npmjs.com/signup
  - Use a professional email
  - Enable 2FA (REQUIRED for publishing scoped packages)

- [ ] **Verify email** (2 min)
  - Check email and click verification link

- [ ] **Enable 2FA** (5 min)
  ```bash
  npm login
  # Follow prompts for 2FA setup
  ```

### If You Have npm Account

- [ ] **Login** (2 min)
  ```bash
  npm login
  # Enter username, password, email
  # Enter 2FA code
  ```

- [ ] **Verify login** (1 min)
  ```bash
  npm whoami
  # Should show your username
  ```

- [ ] **Check scope availability** (5 min)
  - Check if `@latch` scope is available: https://www.npmjs.com/org/latch
  - If taken, consider `@lance0/latch` or `@latch-auth/core`
  - Update package.json names if needed

---

## Phase 6: Pre-Publish Checklist (30 min)

### Final Verification

- [ ] **Clean build** (5 min)
  ```bash
  rm -rf node_modules packages/*/node_modules packages/*/dist
  pnpm install
  pnpm build
  ```

- [ ] **All tests pass** (5 min)
  ```bash
  pnpm test --run
  ```

- [ ] **TypeScript compiles** (2 min)
  ```bash
  pnpm typecheck
  ```

- [ ] **Lint passes** (2 min)
  ```bash
  pnpm lint
  ```

- [ ] **Dry run publish** (10 min)
  ```bash
  cd packages/latch
  npm publish --dry-run
  # Review what will be published

  cd ../latch-cli
  npm publish --dry-run
  ```

- [ ] **Pack and inspect** (5 min)
  ```bash
  cd packages/latch
  npm pack
  tar -tzf latch-core-0.3.0.tgz
  # Verify contents look correct
  # No src/ files
  # No test files
  # dist/ is present
  # README and LICENSE present
  ```

### Git Status Check

- [ ] **All changes committed** (5 min)
  ```bash
  git status
  # Should show: working tree clean
  ```

- [ ] **Create release branch** (optional but recommended)
  ```bash
  git checkout -b release/v0.3.0
  git push -u origin release/v0.3.0
  ```

- [ ] **Tag version** (wait until after successful publish)

---

## Phase 7: Publishing (30 min)

### Publish @latch/core

- [ ] **Double-check version** (1 min)
  ```bash
  cd packages/latch
  cat package.json | grep version
  # Should be: "version": "0.3.0"
  ```

- [ ] **Publish** (5 min)
  ```bash
  npm publish --access public
  # Enter 2FA code when prompted
  ```

- [ ] **Verify on npm** (2 min)
  - Visit https://www.npmjs.com/package/@latch/core
  - Check version shows 0.3.0
  - Check README renders correctly
  - Check files are listed

### Publish @latch/cli

- [ ] **Same process** (5 min)
  ```bash
  cd packages/latch-cli
  npm publish --access public
  ```

- [ ] **Verify** (2 min)
  - Visit https://www.npmjs.com/package/@latch/cli
  - Test install: `npx @latch/cli --version`

### Post-Publish Verification

- [ ] **Test install from npm** (10 min)
  ```bash
  mkdir /tmp/npm-install-test
  cd /tmp/npm-install-test
  npm init -y
  npm install @latch/core
  npm install @latch/cli

  # Test imports
  node -e "import('@latch/core').then(m => console.log(Object.keys(m)))"

  # Test CLI
  npx @latch/cli generate-secret
  ```

- [ ] **Wait for npm indexing** (5 min)
  - npm search can take 5-10 min to index
  - Try: `npm search @latch/core`

---

## Phase 8: Post-Publish Tasks (1 hour)

### Git & GitHub

- [ ] **Tag release** (5 min)
  ```bash
  git tag v0.3.0
  git push origin v0.3.0
  ```

- [ ] **Create GitHub Release** (15 min)
  - Go to https://github.com/lance0/latch/releases/new
  - Tag: v0.3.0
  - Title: "v0.3.0 - Monorepo + CLI Tools"
  - Description: Copy from CHANGELOG.md
  - Mark as "pre-release" if you want to be cautious

### Update Documentation

- [ ] **Update root README** (10 min)
  - Add npm badges (now that packages exist):
    ```markdown
    [![npm version](https://badge.fury.io/js/%40latch%2Fcore.svg)](https://www.npmjs.com/package/@latch/core)
    [![npm downloads](https://img.shields.io/npm/dm/@latch/core.svg)](https://www.npmjs.com/package/@latch/core)
    ```
  - Update installation instructions to use `npm install @latch/core`

- [ ] **Update CHANGELOG** (5 min)
  - Change `[Unreleased]` to `[0.3.0] - 2025-10-22`
  - Add comparison link at bottom

### Announce (Optional)

- [ ] **Twitter/X** (5 min)
  ```
  Just published @latch/core to npm! 🎉

  A security-first OIDC auth library for Next.js with native Azure Government cloud support (GCC-High, DoD).

  ✅ PKCE-only (no client secrets)
  ✅ HttpOnly encrypted cookies
  ✅ TypeScript-first
  ✅ CLI tools included

  https://www.npmjs.com/package/@latch/core
  ```

- [ ] **LinkedIn** (5 min - more professional)
  - Share what you built
  - Mention the problem it solves (Gov cloud auth)
  - Link to npm package

- [ ] **Reddit** (10 min - if appropriate)
  - r/nextjs - "Built an auth library for Azure Gov clouds"
  - r/typescript - Show off the TypeScript quality
  - r/node - Highlight the CLI tools

- [ ] **Dev.to / Hashnode** (optional - write article)
  - "Building a Security-First Auth Library for Azure Government"
  - Deep dive into PKCE, cookie encryption, etc.
  - Link to package

### Monitor

- [ ] **Set up npm email notifications**
  - You'll get emails for new versions, security issues

- [ ] **Watch GitHub issues**
  - Enable notifications for your repo

---

## Potential Issues & Solutions

### Issue: `@latch` scope is taken

**Solution:**
- Use `@lance0/latch` instead
- Or `@latch-auth/core`
- Update package.json names in both packages
- Update imports in example-app and docs

### Issue: npm publish fails with 402 (payment required)

**Cause:** Trying to publish scoped package without organization

**Solution:**
```bash
npm publish --access public
```

### Issue: 2FA not working

**Solution:**
- Regenerate 2FA tokens
- Use authenticator app (not SMS)
- Keep backup codes safe

### Issue: Package is too large (>10MB)

**Solution:**
- Check .npmignore excludes src/
- Verify dist/ only has necessary files
- Use `npm pack` and inspect tarball

### Issue: Types not working after publish

**Solution:**
- Verify `types` field in package.json
- Check dist/ contains .d.ts files
- Test with fresh install (not symlink)

---

## Rollback Plan (If Something Goes Wrong)

### Within 72 hours of publish

You can unpublish:
```bash
npm unpublish @latch/core@0.3.0 --force
npm unpublish @latch/cli@0.3.0 --force
```

**Note:** This is controversial. Only do if there's a serious issue.

### After 72 hours

Cannot unpublish. Instead:

1. **Deprecate version:**
   ```bash
   npm deprecate @latch/core@0.3.0 "Critical security issue, use 0.3.1+"
   ```

2. **Publish fixed version:**
   ```bash
   # Fix issue, bump version to 0.3.1
   npm publish
   ```

3. **Update docs** to point to new version

---

## Success Criteria

You've successfully published when:

✅ Both packages visible on npm
✅ `npm install @latch/core` works
✅ `npx @latch/cli init` works
✅ TypeScript types work in fresh project
✅ GitHub release created
✅ README badges show correct version
✅ All tests still passing

---

## Timeline Recommendation

### Week 1 (This Weekend)
- **Day 1:** Complete Phase 1 (Testing) + Phase 2 (Docs) = 3-4 hours
- **Day 2:** Complete Phase 3-6 (Metadata, Security, Setup, Checklist) = 2-3 hours

### Week 2 (Next Weekend)
- **Day 1:** Final review, publish! (Phase 7) = 30 min
- **Day 2:** Post-publish tasks (Phase 8) = 1 hour

**Total: 6-8 hours** spread over two weekends

---

## My Personal Recommendation

**Minimum Viable Publish (3 hours total):**

1. ✅ Test CLI and package locally (30 min)
2. ✅ Run `pnpm audit` and fix any critical issues (15 min)
3. ✅ Quick README review - fix any obvious errors (30 min)
4. ✅ npm account setup + 2FA (15 min)
5. ✅ Dry run + actual publish (30 min)
6. ✅ Test install from npm (15 min)
7. ✅ GitHub release (15 min)

**Gold Standard Publish (6-8 hours):**
- Do everything in this roadmap
- Results in a really professional package

**Start with Minimum, iterate to Gold:**
- Publish v0.3.0 with minimum
- Gather feedback
- Polish and publish v0.3.1 with improvements

---

## Questions Before Publishing?

- [ ] Is the package name `@latch/core` available? (Check npm)
- [ ] Do you want to publish under your real name or "lance0"?
- [ ] Private or public repo? (Already private, keep it that way?)
- [ ] Do you want to set up GitHub Sponsors?
- [ ] Any concerns about support burden?

---

**You're 90% there.** The hard work is done. This roadmap is just polish and shipping. 🚀

Let me know which path you want: Minimum Viable or Gold Standard!
