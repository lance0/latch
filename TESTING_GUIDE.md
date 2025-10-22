# Testing Guide - Latch v0.3.0

Quick guide for testing Latch locally this weekend.

## Setup (5 minutes)

### 1. Install dependencies

From the root of the monorepo:

```bash
pnpm install
```

### 2. Build all packages

```bash
pnpm build
```

This builds:
- `@latch/core` (30KB authentication library)
- `@latch/cli` (5KB CLI tools)
- `example-app` (Next.js demo)

## Testing the CLI (10 minutes)

### Test `generate-secret`

```bash
node packages/latch-cli/dist/index.js generate-secret
```

Expected output:
```
✓ Generated secure cookie secret:

LATCH_COOKIE_SECRET=<random-base64-string>

Add this to your .env.local file
Never commit this secret to version control!
```

### Test `init` wizard

Create a new test directory:

```bash
mkdir ../latch-test
cd ../latch-test
```

Run the init wizard:

```bash
node ../latch/packages/latch-cli/dist/index.js init
```

This will prompt you for:
1. Cloud environment (try GCC-High)
2. Azure AD Client ID (use a fake UUID for testing: `00000000-0000-0000-0000-000000000000`)
3. Azure AD Tenant ID (use another fake UUID: `11111111-1111-1111-1111-111111111111`)
4. Redirect URI (keep default: `http://localhost:3000/api/latch/callback`)
5. Scopes (keep default: `openid profile User.Read`)

Check the created `.env.local`:

```bash
cat .env.local
```

It should have all configuration with an auto-generated cookie secret!

## Testing the Package with pnpm link (15 minutes)

### 1. Link the package globally

From `packages/latch`:

```bash
cd /home/lance/latch/packages/latch
pnpm link --global
```

### 2. Create a new Next.js app

```bash
cd ~
npx create-next-app@latest my-latch-test --typescript --tailwind --app --no-src-dir
cd my-latch-test
```

### 3. Link Latch

```bash
pnpm link --global @latch/core
```

### 4. Install peer dependencies

```bash
pnpm add next@^15.0.0 react@^19.0.0 react-dom@^19.0.0
```

### 5. Use the CLI

```bash
node /home/lance/latch/packages/latch-cli/dist/index.js init
```

Select your Azure AD details (or use test values).

### 6. Create API routes

Copy the API routes from `apps/example-app/app/api/latch/` to your new app:

```bash
mkdir -p app/api/latch
cp /home/lance/latch/apps/example-app/app/api/latch/*.ts app/api/latch/
```

### 7. Update layout

Edit `app/layout.tsx`:

```tsx
import { LatchProvider } from '@latch/core/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LatchProvider>{children}</LatchProvider>
      </body>
    </html>
  );
}
```

### 8. Test sign-in

Edit `app/page.tsx`:

```tsx
'use client';

import { useLatch } from '@latch/core/react';

export default function Home() {
  const { user, isAuthenticated, signIn, signOut } = useLatch();

  if (!isAuthenticated) {
    return <button onClick={() => signIn()}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### 9. Run the app

```bash
pnpm dev
```

Visit http://localhost:3000 and test!

## Testing the Example App (5 minutes)

The fastest way to test:

```bash
cd /home/lance/latch/apps/example-app
```

Create `.env.local` with your actual Azure AD credentials:

```env
LATCH_CLIENT_ID=<your-real-client-id>
LATCH_TENANT_ID=<your-real-tenant-id>
LATCH_CLOUD=commercial  # or gcc-high, dod
LATCH_SCOPES=openid profile User.Read
LATCH_REDIRECT_URI=http://localhost:3000/api/latch/callback
LATCH_COOKIE_SECRET=<run generate-secret to get this>
```

Run:

```bash
pnpm dev
```

Visit http://localhost:3000 and test the full flow:
1. Click "Sign In with Azure AD"
2. Authenticate with Microsoft
3. Get redirected back
4. See your user profile
5. Visit /dashboard
6. Click "Sign Out"

## Troubleshooting

### "Cannot find module @latch/core"

Make sure you built the package:

```bash
cd /home/lance/latch/packages/latch
pnpm build
```

And linked it:

```bash
pnpm link --global
```

### "Invalid UUID format"

The CLI validates UUIDs. Use this format:
```
00000000-0000-0000-0000-000000000000
```

### "Cookie secret too short"

Generate a new secret:

```bash
node /home/lance/latch/packages/latch-cli/dist/index.js generate-secret
```

Copy the output to `LATCH_COOKIE_SECRET` in `.env.local`.

### "Cloud/Scope Mismatch"

If using GCC-High or DoD, make sure your scopes DON'T include `.com` URLs:

❌ Bad: `https://graph.microsoft.com/User.Read`
✅ Good: `User.Read`

Latch automatically uses the correct Graph endpoint for your cloud.

## What to Test

### ✅ Core Functionality

- [ ] Sign in flow works
- [ ] User session persists across page reloads
- [ ] Dashboard is protected (redirects if not authenticated)
- [ ] Sign out clears session
- [ ] Cookies are HttpOnly (check devtools → Application → Cookies)

### ✅ CLI Tools

- [ ] `generate-secret` creates different secrets each time
- [ ] `init` wizard validates UUIDs
- [ ] `init` creates .env.local with all fields
- [ ] GCC-High shows government cloud warnings

### ✅ TypeScript

- [ ] IntelliSense works for `useLatch()` hook
- [ ] Type errors show for invalid props
- [ ] No build errors

## Next Steps

After testing, you could:

1. **Publish to npm** (packages are ready!)
2. **Add more CLI commands** (`check-config`, etc.)
3. **Create a second example app** (Direct Token mode)
4. **Open NextAuth RFC** with your implementation as reference

## Questions?

Check:
- [README.md](./README.md) - Main docs
- [packages/latch/README.md](./packages/latch/README.md) - Package docs
- [packages/latch-cli/README.md](./packages/latch-cli/README.md) - CLI docs
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
