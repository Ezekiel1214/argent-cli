import type { DeployProvider } from '../core/config.js';
import { loadMapping } from '../core/mapping.js';
import { normalizeRelativeFilePath } from '../core/paths.js';
import { generateDiff } from '../core/differ.js';
import { applyChanges } from '../core/writer.js';
import { confirmApply } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { deploy } from './deploy.js';

interface ApplyOptions {
  deploy?: boolean;
  deployProvider?: DeployProvider | string;
  dryRun?: boolean;
  file?: string;
  mapping?: string;
  requireChanges?: boolean;
  yes?: boolean;
}

export async function apply(options: ApplyOptions = {}): Promise<void> {
  try {
    const blocks = await loadMapping(options.mapping).catch(() => null);
    if (!blocks) {
      logger.error(
        options.mapping
          ? `No mapping found at ${normalizeRelativeFilePath(options.mapping)}.`
          : 'No mapping found. Run `argent capture` first.',
      );
      return;
    }

    const targetFile = options.file ? normalizeRelativeFilePath(options.file) : null;
    const selectedBlocks = targetFile
      ? blocks.filter((block) => block.suggestedPath === targetFile)
      : blocks;

    if (targetFile && selectedBlocks.length === 0) {
      logger.warn(`No mapped changes found for ${targetFile}`);
      return;
    }

    let appliedCount = 0;
    let diffCount = 0;

    for (const block of selectedBlocks) {
      if (!block.suggestedPath) {
        logger.warn('Skipping block with no file path (should not happen).');
        continue;
      }

      const diff = await generateDiff(block.suggestedPath, block.content);
      if (diff === null) {
        logger.info(`No changes for ${block.suggestedPath}`);
        continue;
      }

      diffCount += 1;
      console.log(diff);

      if (options.dryRun) {
        logger.info(`Dry run: skipping write for ${block.suggestedPath}`);
        continue;
      }

      const ok = options.yes ? true : await confirmApply(block.suggestedPath);
      if (ok) {
        await applyChanges(block.suggestedPath, block.content);
        appliedCount += 1;
        logger.success(`Updated ${block.suggestedPath}`);
      } else {
        logger.warn(`Skipped ${block.suggestedPath}`);
      }
    }

    if (options.deploy) {
      if (options.dryRun) {
        logger.info('Skipping deploy because dry-run mode is enabled.');
      } else if (appliedCount > 0) {
        await deploy({ provider: options.deployProvider, skipPrompt: Boolean(options.yes) });
      } else {
        logger.info('Skipping deploy because no changes were applied.');
      }
    }

    if (options.requireChanges && diffCount === 0) {
      throw new Error('No effective changes found in the selected mapping.');
    }
  } catch (err: unknown) {
    logger.error((err as Error).message);
  }
}
