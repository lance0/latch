import { randomBytes } from 'crypto';
import chalk from 'chalk';

/**
 * Generate a secure random secret for LATCH_COOKIE_SECRET
 */
export function generateSecret(): void {
  try {
    // Generate 32 bytes of cryptographically secure random data
    const secret = randomBytes(32).toString('base64');

    console.log(chalk.green('✓') + ' Generated secure cookie secret:\n');
    console.log(chalk.cyan('LATCH_COOKIE_SECRET') + '=' + chalk.yellow(secret));
    console.log();
    console.log(chalk.dim('Add this to your .env.local file'));
    console.log(chalk.dim('Never commit this secret to version control!'));
  } catch (error) {
    console.error(chalk.red('✗ Error generating secret:'), error);
    process.exit(1);
  }
}
