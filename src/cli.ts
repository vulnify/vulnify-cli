#!/usr/bin/env node

import { Command } from 'commander';
import { testCommand } from './commands/test';
import { helpCommand } from './commands/help';
import { infoCommand } from './commands/info';
import { colors } from './utils/colors';

const program = new Command();

// Configure the main program
program
  .name('vulnify')
  .description('CLI tool for vulnerability analysis using Vulnify SCA API')
  .version('1.0.0', '-v, --version', 'display version number');

// Add commands
program.addCommand(testCommand);
program.addCommand(helpCommand);
program.addCommand(infoCommand);

// Custom help
program.on('--help', () => {
  console.log('');
  console.log(colors.title('Examples:'));
  console.log('  $ vulnify test                    # Analyze current project');
  console.log('  $ vulnify test --file package.json # Analyze specific file');
  console.log('  $ vulnify test --ecosystem npm     # Force ecosystem detection');
  console.log('  $ vulnify info                     # Show API information');
  console.log('');
  console.log(colors.muted('For more information, visit: https://docs.vulnify.io'));
});

// Handle unknown commands
program.on('command:*', () => {
  console.error(colors.error('Invalid command: %s'), program.args.join(' '));
  console.log(colors.info('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse arguments and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

