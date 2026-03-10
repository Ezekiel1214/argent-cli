import fs from 'fs/promises';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveMapping, loadMapping } from '../../src/core/mapping.js';
import { CodeBlock } from '../../src/types.js';

vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('mapping', () => {
  const testBlocks: CodeBlock[] = [
    { content: 'const a = 1;', suggestedPath: 'src/a.js' },
    { content: 'const b = 2;', suggestedPath: undefined },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('saves mapping to .argent/mapping.json', async () => {
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);

    await saveMapping(testBlocks);

    expect(mockedFs.mkdir).toHaveBeenCalledWith('.argent', { recursive: true });
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      path.join('.argent', 'mapping.json'),
      JSON.stringify(testBlocks, null, 2),
      'utf-8',
    );
  });

  it('loads mapping from .argent/mapping.json', async () => {
    const jsonData = JSON.stringify(testBlocks);
    mockedFs.readFile.mockResolvedValue(jsonData as never);

    const loaded = await loadMapping();
    expect(loaded).toEqual(testBlocks);
    expect(mockedFs.readFile).toHaveBeenCalledWith(path.join('.argent', 'mapping.json'), 'utf-8');
  });

  it('throws if mapping file not found', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));
    await expect(loadMapping()).rejects.toThrow();
  });
});
