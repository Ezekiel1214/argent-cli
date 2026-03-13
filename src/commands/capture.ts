import fs from 'fs/promises';
import { readClipboard } from '../core/clipboard.js';
import { inferDocumentPath } from '../core/inference.js';
import { parseClipboard } from '../core/parser.js';
import { saveMapping } from '../core/mapping.js';
import { normalizeRelativeFilePath } from '../core/paths.js';
import { promptFilePath } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { CodeBlock } from '../types.js';

interface CaptureOptions {
  docsDir?: string;
  defaultFile?: string;
  file?: string;
  inferPaths?: boolean;
  output?: string;
  splitHeadings?: boolean;
  stdin?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
}

export async function capture(options: CaptureOptions = {}): Promise<void> {
  try {
    if (options.stdin && options.file) {
      throw new Error('Choose either --stdin or --file, not both.');
    }

    if (options.defaultFile && options.splitHeadings) {
      logger.warn('Using --default-file with --split-headings will apply the same target path to every section without a FILE marker.');
    }

    let text: string;
    if (options.file) {
      const inputPath = normalizeRelativeFilePath(options.file);
      logger.info(`Reading file ${inputPath}...`);
      text = await fs.readFile(inputPath, 'utf-8');
    } else if (options.stdin) {
      logger.info('Reading stdin...');
      text = await readStdin();
    } else {
      logger.info('Reading clipboard...');
      text = await readClipboard();
    }

    if (!text) {
      logger.warn(options.file ? 'Input file is empty.' : options.stdin ? 'Stdin is empty.' : 'Clipboard is empty.');
      return;
    }

    const blocks = parseClipboard(text, { splitHeadings: options.splitHeadings });

    if (blocks.length === 0) {
      logger.warn(options.file ? 'No code blocks found in the input file.' : options.stdin ? 'No code blocks found in stdin.' : 'No code blocks found in clipboard.');
      return;
    }

    logger.success(`Found ${blocks.length} code block(s).`);

    const enrichedBlocks: CodeBlock[] = [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block.suggestedPath) {
        enrichedBlocks.push({
          ...block,
          suggestedPath: normalizeRelativeFilePath(block.suggestedPath),
        });
      } else if (options.inferPaths) {
        const inferredPath = inferDocumentPath(block.content, options.docsDir);
        if (inferredPath) {
          logger.info(`Inferred path for block ${i + 1}: ${inferredPath}`);
          enrichedBlocks.push({
            ...block,
            suggestedPath: inferredPath,
          });
          continue;
        }
      } else if (options.defaultFile) {
        enrichedBlocks.push({
          ...block,
          suggestedPath: normalizeRelativeFilePath(options.defaultFile),
        });
      } else {
        logger.info(`Block ${i + 1} has no file marker.`);
        const preview = block.content.split('\n')[0] || block.content.substring(0, 50);
        const { filePath } = await promptFilePath(i, preview);
        enrichedBlocks.push({
          ...block,
          suggestedPath: normalizeRelativeFilePath(filePath),
        });
      }
    }

    const mappingPath = options.output;
    await saveMapping(enrichedBlocks, mappingPath);
    logger.success(
      `Mapping saved to ${mappingPath ? normalizeRelativeFilePath(mappingPath) : '.argent/mapping.json'}. Run \`argent apply\` to preview and apply changes.`,
    );
  } catch (err: unknown) {
    logger.error((err as Error).message);
  }
}
