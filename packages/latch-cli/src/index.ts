import { Command } from 'commander';
import { generateSecret } from './commands/generate-secret.js';
import { init } from './commands/init.js';
import { scaffold } from './commands/scaffold.js';
import { validate } from './commands/validate.js';
import { doctor } from './commands/doctor.js';

const program = new Command();

program
  .name('latch')
  .description('CLI tools for Latch authentication library')
  .version('0.4.4');

program
  .command('generate-secret')
  .alias('secret')
  .description('Generate a secure random cookie secret for LATCH_COOKIE_SECRET')
  .action(generateSecret);

program
  .command('init')
  .description('Initialize Latch configuration with an interactive wizard')
  .action(init);

program
  .command('scaffold')
  .description('Scaffold Latch files: API routes, proxy.ts, or auth wrapper')
  .option('--type <type>', 'Type to scaffold: routes, proxy, wrapper, or all')
  .option('--example <type>', 'Example to scaffold from: base, commercial, gcc-high')
  .action(scaffold);

program
  .command('validate')
  .description('Validate .env.local configuration for common mistakes')
  .action(validate);

program
  .command('doctor')
  .description('Run diagnostics on your Latch setup')
  .action(doctor);

program.parse();
