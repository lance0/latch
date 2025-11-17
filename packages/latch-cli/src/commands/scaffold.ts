import prompts from 'prompts';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface ScaffoldOptions {
  example?: 'commercial' | 'gcc-high' | 'base';
  type?: 'routes' | 'proxy' | 'wrapper' | 'all';
}

interface ScaffoldAnswers {
  type: 'routes' | 'proxy' | 'wrapper' | 'all';
  example?: 'commercial' | 'gcc-high' | 'base';
  includeServerActions?: boolean;
  overwrite: boolean;
}

const API_ROUTES = [
  'app/api/latch/start/route.ts',
  'app/api/latch/callback/route.ts',
  'app/api/latch/session/route.ts',
  'app/api/latch/refresh/route.ts',
  'app/api/latch/logout/route.ts',
];

const SERVER_ACTIONS = [
  'app/actions/profile.ts',
  'app/actions/updateSettings.ts',
];

/**
 * Get the example app directory based on selection
 */
function getExampleDir(example: string): string {
  // In the monorepo, examples are at ../../apps/
  // When published to npm, we'd need to bundle these or point to repo
  const monorepoPath = join(process.cwd(), '..', '..', 'apps');
  
  if (example === 'base') {
    return join(monorepoPath, 'example-app');
  }
  return join(monorepoPath, `example-${example}`);
}

/**
 * Check if we're in a Next.js project
 */
function isNextJsProject(): boolean {
  return existsSync(join(process.cwd(), 'next.config.ts')) || 
         existsSync(join(process.cwd(), 'next.config.js')) ||
         existsSync(join(process.cwd(), 'next.config.mjs'));
}

/**
 * Scaffold API routes, proxy.ts, wrapper, or all from examples
 */
export async function scaffold(options: ScaffoldOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n📦 Latch Scaffold\n'));

  // Check if we're in a Next.js project
  if (!isNextJsProject()) {
    console.error(chalk.red('✗ Not in a Next.js project directory'));
    console.log(chalk.dim('  Run this command from your Next.js project root'));
    process.exit(1);
  }

  try {
    // Interactive prompts if options not provided
    let type = options.type;
    let example = options.example;
    let includeServerActions = false;
    let overwrite = false;

    if (!type) {
      const answers = await prompts<string>([
        {
          type: 'select',
          name: 'type',
          message: 'What would you like to scaffold?',
          choices: [
            {
              title: 'API Routes',
              description: 'Auth endpoints (/api/latch/*)',
              value: 'routes',
            },
            {
              title: 'Proxy (Next.js 16)',
              description: 'Session validation middleware',
              value: 'proxy',
            },
            {
              title: 'Auth Wrapper',
              description: 'lib/auth.ts helper functions',
              value: 'wrapper',
            },
            {
              title: 'All of the Above',
              description: 'Complete setup',
              value: 'all',
            },
          ],
          initial: 0,
        },
        {
          type: (prev) => (prev === 'routes' || prev === 'all') ? 'select' : null,
          name: 'example',
          message: 'Which example to scaffold from?',
          choices: [
            {
              title: 'Base Example',
              description: 'Generic configurable example',
              value: 'base',
            },
            {
              title: 'Azure Commercial',
              description: 'Pre-configured for commercial cloud',
              value: 'commercial',
            },
            {
              title: 'Azure GCC-High',
              description: 'Pre-configured for government cloud',
              value: 'gcc-high',
            },
          ],
          initial: 0,
        },
        {
          type: (prev, values) => (values.type === 'routes' || values.type === 'all') ? 'confirm' : null,
          name: 'includeServerActions',
          message: 'Include Server Actions examples?',
          initial: true,
        },
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Overwrite existing files?',
          initial: false,
        },
      ]) as ScaffoldAnswers;

      if (!answers.type) {
        console.log(chalk.yellow('\n✗ Scaffold cancelled'));
        process.exit(0);
      }

      type = answers.type;
      example = answers.example;
      includeServerActions = answers.includeServerActions || false;
      overwrite = answers.overwrite;
    }

    let copiedFiles = 0;
    let skippedFiles = 0;

    // Handle proxy.ts scaffolding
    if (type === 'proxy' || type === 'all') {
      console.log(chalk.bold('\nScaffolding proxy.ts...'));
      const sourcePath = join(process.cwd(), '..', '..', 'examples', 'nextjs16', 'proxy.ts');
      const destPath = join(process.cwd(), 'proxy.ts');

      if (existsSync(sourcePath)) {
        if (existsSync(destPath) && !overwrite) {
          console.log(chalk.dim(`  ⊘ Skipped (exists): proxy.ts`));
          skippedFiles++;
        } else {
          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content, 'utf-8');
          console.log(chalk.green(`  ✓ Created: proxy.ts`));
          copiedFiles++;
        }
      } else {
        // Fallback: generate proxy.ts inline
        console.log(chalk.yellow(`  ⚠ Reference proxy.ts not found, generating inline...`));
        const proxyContent = `/**
 * Next.js 16 Proxy with Latch Authentication
 * 
 * IMPORTANT: proxy.ts automatically runs on Node.js runtime in Next.js 16
 * DO NOT add: export const runtime = 'nodejs' (causes build error)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAMES, unseal } from '@lance0/latch';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes - customize this list for your app
  const publicRoutes = [
    '/api/latch/',      // All Latch auth endpoints
    '/api/health',      // Health check
    '/',                // Landing page
  ];

  if (publicRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next();
  }

  // Validate session
  const sessionCookie = request.cookies.get(COOKIE_NAMES.ID_TOKEN)?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const secret = process.env.LATCH_COOKIE_SECRET;
    if (!secret) {
      console.error('[Proxy] LATCH_COOKIE_SECRET not configured');
      return NextResponse.redirect(new URL('/', request.url));
    }

    const session = await unseal(sessionCookie, secret) as any;

    // Check for user ID (sub claim)
    if (!session || !session.sub) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
`;
        await writeFile(destPath, proxyContent, 'utf-8');
        console.log(chalk.green(`  ✓ Generated: proxy.ts`));
        copiedFiles++;
      }
    }

    // Handle wrapper scaffolding
    if (type === 'wrapper' || type === 'all') {
      console.log(chalk.bold('\nScaffolding auth wrapper...'));
      const destPath = join(process.cwd(), 'lib', 'auth.ts');

      if (existsSync(destPath) && !overwrite) {
        console.log(chalk.dim(`  ⊘ Skipped (exists): lib/auth.ts`));
        skippedFiles++;
      } else {
        await mkdir(dirname(destPath), { recursive: true });
        const wrapperContent = `/**
 * Application-specific auth helpers
 * 
 * This wraps Latch helpers with your application logic.
 * Recommended pattern - keeps auth logic centralized.
 */
import { getServerSession } from '@lance0/latch';
import { cache } from 'react';

/**
 * Get current user with app-specific logic
 * Cached per-request to avoid duplicate operations
 */
export const getCurrentUser = cache(async () => {
  const session = await getServerSession(process.env.LATCH_COOKIE_SECRET!);

  if (!session.isAuthenticated || !session.user) {
    return null;
  }

  // TODO: Add your application logic here
  // Example: Database sync (JIT user provisioning)
  // const user = await db.user.upsert({
  //   where: { azureId: session.user.sub },
  //   create: {
  //     azureId: session.user.sub,
  //     email: session.user.email,
  //     name: session.user.name,
  //   },
  //   update: {
  //     email: session.user.email,
  //     name: session.user.name,
  //   },
  // });
  // return user;

  // For now, return Latch user directly
  return session.user;
});

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}
`;
        await writeFile(destPath, wrapperContent, 'utf-8');
        console.log(chalk.green(`  ✓ Created: lib/auth.ts`));
        copiedFiles++;
      }
    }

    // Handle API routes scaffolding
    if (type === 'routes' || type === 'all') {
      const exampleDir = getExampleDir(example || 'base');

      // Check if example directory exists (in monorepo context)
      if (!existsSync(exampleDir)) {
        console.error(chalk.red('✗ Example directory not found'));
        console.log(chalk.dim(`  Expected: ${exampleDir}`));
        console.log();
        console.log(chalk.yellow('💡 Note: Scaffold works best when run from the Latch monorepo'));
        console.log(chalk.dim('  Alternatively, copy files manually from:'));
        console.log(chalk.dim('  https://github.com/lance0/latch/tree/master/apps/example-app'));
        process.exit(1);
      }

      // Copy API routes
      console.log(chalk.bold('\nCopying API routes...'));
      for (const route of API_ROUTES) {
        const sourcePath = join(exampleDir, route);
        const destPath = join(process.cwd(), route);

        if (!existsSync(sourcePath)) {
          console.log(chalk.yellow(`  ⚠ Source not found: ${route}`));
          continue;
        }

        // Check if destination exists
        if (existsSync(destPath) && !overwrite) {
          console.log(chalk.dim(`  ⊘ Skipped (exists): ${route}`));
          skippedFiles++;
          continue;
        }

        // Create directory if needed
        await mkdir(dirname(destPath), { recursive: true });

        // Copy file
        const content = await readFile(sourcePath, 'utf-8');
        await writeFile(destPath, content, 'utf-8');

        console.log(chalk.green(`  ✓ Copied: ${route}`));
        copiedFiles++;
      }

      // Copy Server Actions if requested
      if (includeServerActions) {
        console.log(chalk.bold('\nCopying Server Actions...'));
        for (const action of SERVER_ACTIONS) {
          const sourcePath = join(exampleDir, action);
          const destPath = join(process.cwd(), action);

          if (!existsSync(sourcePath)) {
            console.log(chalk.yellow(`  ⚠ Source not found: ${action}`));
            continue;
          }

          if (existsSync(destPath) && !overwrite) {
            console.log(chalk.dim(`  ⊘ Skipped (exists): ${action}`));
            skippedFiles++;
            continue;
          }

          await mkdir(dirname(destPath), { recursive: true });

          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content, 'utf-8');

          console.log(chalk.green(`  ✓ Copied: ${action}`));
          copiedFiles++;
        }
      }
    }

    // Summary
    console.log();
    console.log(chalk.green(`✓ Scaffold complete! ${copiedFiles} files copied`));
    if (skippedFiles > 0) {
      console.log(chalk.dim(`  (${skippedFiles} files skipped - already exist)`));
    }
    console.log();

    // Next steps based on what was scaffolded
    console.log(chalk.bold('Next steps:'));
    if (type === 'proxy' || type === 'all') {
      console.log('  1. ' + chalk.dim('Review proxy.ts and customize publicRoutes'));
    }
    if (type === 'wrapper' || type === 'all') {
      console.log('  2. ' + chalk.dim('Review lib/auth.ts and add your database logic'));
    }
    if (type === 'routes' || type === 'all') {
      console.log('  3. ' + chalk.dim('Configure .env.local (run: latch init)'));
      console.log('  4. ' + chalk.dim('Wrap your app with <LatchProvider>'));
    }
    console.log('  ' + chalk.dim('Run') + ' pnpm dev ' + chalk.dim('to test'));
    console.log();

  } catch (error) {
    console.error(chalk.red('\n✗ Error during scaffold:'), error);
    process.exit(1);
  }
}
