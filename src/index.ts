#!/usr/bin/env node
import { Command } from 'commander';
import { capture } from './commands/capture.js';
import { apply } from './commands/apply.js';
import { build } from './commands/build.js';
import { deploy } from './commands/deploy.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { APP_VERSION } from './version.js';

const program = new Command();

program.name('argent').description('Super AI Argent - bridge AI chats to your code').version(APP_VERSION);

program
  .command('capture')
  .description('Capture AI conversation from clipboard and map files')
  .option('--docs-dir <path>', 'Base project-relative directory to use when inferring document paths')
  .option('--default-file <path>', 'Use the specified project-relative file for blocks without a FILE marker')
  .option('-f, --file <path>', 'Read AI conversation or documentation from a project-relative file')
  .option('--infer-paths', 'Infer document output paths from markdown headings when no FILE marker is present')
  .option('-o, --output <path>', 'Write the mapping JSON to the specified project-relative path')
  .option('--split-headings', 'When no code fences exist, split plain markdown documents into sections by headings')
  .option('--stdin', 'Read AI conversation from stdin instead of the clipboard')
  .action(async (options) => {
    await capture(options);
  });

program
  .command('apply')
  .description('Preview and apply mapped changes')
  .option('-d, --deploy', 'Trigger deployment after applying changes')
  .option('--deploy-provider <provider>', 'Deployment provider to use when deploying (vercel or netlify)')
  .option('--dry-run', 'Print the selected diffs without writing files or creating backups')
  .option('-f, --file <path>', 'Apply only the mapped change for the specified project-relative file')
  .option('-m, --mapping <path>', 'Read mapped changes from the specified project-relative mapping file')
  .option('--require-changes', 'Report an error if the selected mapping produces no effective file changes')
  .option('-y, --yes', 'Apply all mapped changes without confirmation prompts')
  .action(apply);

program
  .command('build')
  .description('Ingest a document or AI conversation, build the mapped files, and optionally deploy')
  .option('--docs-dir <path>', 'Base project-relative directory to use when inferring document paths')
  .option('--default-file <path>', 'Use the specified project-relative file for blocks without a FILE marker')
  .option('--dry-run', 'Print the selected diffs without writing files or creating backups')
  .option('-d, --deploy', 'Trigger deployment after applying changes')
  .option('--deploy-provider <provider>', 'Deployment provider to use when deploying (vercel or netlify)')
  .option('-f, --file <path>', 'Read AI conversation or documentation from a project-relative file')
  .option('--infer-paths', 'Infer document output paths from markdown headings when no FILE marker is present')
  .option('-m, --mapping <path>', 'Write and read mapped changes from the specified project-relative mapping file')
  .option('--require-changes', 'Report an error if the selected mapping produces no effective file changes')
  .option('--split-headings', 'When plain markdown has no code fences, split it into multiple blocks by headings')
  .option('--stdin', 'Read AI conversation from stdin instead of the clipboard')
  .option('-t, --target-file <path>', 'Apply only the mapped change for the specified project-relative file')
  .option('-y, --yes', 'Apply all mapped changes without confirmation prompts')
  .action(build);

program
  .command('deploy')
  .description('Deploy current project using the configured provider')
  .option('--provider <provider>', 'Deployment provider to use (vercel or netlify)')
  .option('-y, --yes', 'Skip the deploy confirmation prompt')
  .action((options) => deploy({ provider: options.provider, skipPrompt: options.yes }));
program.command('doctor').description('Check current capabilities, environment, and available integrations').option('--json', 'Print the report as JSON').action(doctor);
program.command('init').description('Create a default .argentrc.json configuration file').action(init);

program.parse(process.argv);
