import { apply } from './apply.js';
import { capture } from './capture.js';

interface BuildOptions {
  deploy?: boolean;
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
    dryRun: options.dryRun,
    file: options.targetFile,
    mapping: options.mapping,
    requireChanges: options.requireChanges,
    yes: options.yes,
  });
}
