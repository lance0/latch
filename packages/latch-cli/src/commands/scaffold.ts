import prompts from 'prompts';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';

interface ScaffoldOptions {
  example?: 'commercial' | 'gcc-high' | 'base';
}

interface ScaffoldAnswers {
  example: 'commercial' | 'gcc-high' | 'base';
  includeServerActions: boolean;
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
 * Scaffold API routes and optionally Server Actions from example app
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
    let example = options.example;
    let includeServerActions = false;
    let overwrite = false;

    if (!example) {
      const answers = await prompts<string>([
        {
          type: 'select',
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
          type: 'confirm',
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

      if (!answers.example) {
        console.log(chalk.yellow('\n✗ Scaffold cancelled'));
        process.exit(0);
      }

      example = answers.example;
      includeServerActions = answers.includeServerActions;
      overwrite = answers.overwrite;
    }

    const exampleDir = getExampleDir(example!);

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

    let copiedFiles = 0;
    let skippedFiles = 0;

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

    // Summary
    console.log();
    console.log(chalk.green(`✓ Scaffold complete! ${copiedFiles} files copied`));
    if (skippedFiles > 0) {
      console.log(chalk.dim(`  (${skippedFiles} files skipped - already exist)`));
    }
    console.log();

    // Next steps
    console.log(chalk.bold('Next steps:'));
    console.log('  1. ' + chalk.dim('Review the copied files'));
    console.log('  2. ' + chalk.dim('Configure .env.local (run: latch init)'));
    console.log('  3. ' + chalk.dim('Wrap your app with <LatchProvider>'));
    console.log('  4. ' + chalk.dim('Run') + ' pnpm dev ' + chalk.dim('to test'));
    console.log();

  } catch (error) {
    console.error(chalk.red('\n✗ Error during scaffold:'), error);
    process.exit(1);
  }
}
