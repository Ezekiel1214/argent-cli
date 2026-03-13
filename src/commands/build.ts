import type { DeployProvider } from '../core/config.js';
import { apply } from './apply.js';
import { capture } from './capture.js';

interface BuildOptions {
  deploy?: boolean;
  deployProvider?: DeployProvider | string;
  docsDir?: string;
  dryRun?: boolean;
  file?: string;
  inferPaths?: boolean;
  mapping?: string;
  defaultFile?: string;
  requireChanges?: boolean;
  splitHeadings?: boolean;
  stdin?: boolean;
  targetFile?: string;
  yes?: boolean;
}

export async function build(options: BuildOptions = {}): Promise<void> {
  await capture({
    docsDir: options.docsDir,
    defaultFile: options.defaultFile,
    file: options.file,
    inferPaths: options.inferPaths,
    output: options.mapping,
    splitHeadings: options.splitHeadings,
    stdin: options.stdin,
  });

  await apply({
    deploy: options.deploy,
    deployProvider: options.deployProvider,
    dryRun: options.dryRun,
    file: options.targetFile,
    mapping: options.mapping,
    requireChanges: options.requireChanges,
    yes: options.yes,
  });
}
