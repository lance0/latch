import { Command } from 'commander';
import { generateSecret } from './commands/generate-secret.js';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('latch')
  .description('CLI tools for Latch authentication library')
  .version('0.3.0');

program
  .command('generate-secret')
  .alias('secret')
  .description('Generate a secure random cookie secret for LATCH_COOKIE_SECRET')
  .action(generateSecret);

program
  .command('init')
  .description('Initialize Latch configuration with an interactive wizard')
  .action(init);

program.parse();
