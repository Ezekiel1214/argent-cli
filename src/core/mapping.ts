import fs from 'fs/promises';
import path from 'path';
import { CodeBlock } from '../types.js';
import { normalizeRelativeFilePath } from './paths.js';

const MAPPING_DIR = '.argent';
const MAPPING_FILE = 'mapping.json';

function resolveMappingPath(mappingPath?: string): string {
  return mappingPath ? normalizeRelativeFilePath(mappingPath) : path.join(MAPPING_DIR, MAPPING_FILE);
}

export async function saveMapping(blocks: CodeBlock[], mappingPath?: string): Promise<void> {
  const targetPath = resolveMappingPath(mappingPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(blocks, null, 2), 'utf-8');
}

export async function loadMapping(mappingPath?: string): Promise<CodeBlock[]> {
  const filePath = resolveMappingPath(mappingPath);
  const data = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(data) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid mapping format: expected an array of code blocks.');
  }

  return parsed.map((block, index) => {
    if (
      !block ||
      typeof block !== 'object' ||
      typeof (block as CodeBlock).content !== 'string' ||
      (
        (block as CodeBlock).suggestedPath !== undefined &&
        typeof (block as CodeBlock).suggestedPath !== 'string'
      )
    ) {
      throw new Error(`Invalid mapping entry at index ${index}.`);
    }

    const typedBlock = block as CodeBlock;
    return {
      ...typedBlock,
      suggestedPath:
        typedBlock.suggestedPath === undefined
          ? undefined
          : normalizeRelativeFilePath(typedBlock.suggestedPath),
    };
  });
}
