import fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDiff } from '../../src/core/differ.js';

vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('differ', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null if files are identical', async () => {
    mockedFs.readFile.mockResolvedValue('same content' as never);
    const result = await generateDiff('file.txt', 'same content');
    expect(result).toBeNull();
  });

  it('generates diff when file does not exist', async () => {
    const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedFs.readFile.mockRejectedValue(error);
    const result = await generateDiff('new.txt', 'new content');
    expect(result).toContain('+new content');
  });

  it('generates diff when content differs', async () => {
    mockedFs.readFile.mockResolvedValue('old line\n' as never);
    const result = await generateDiff('file.txt', 'new line\n');
    expect(result).toContain('-old line');
    expect(result).toContain('+new line');
  });

  it('surfaces non-ENOENT read failures', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('EACCES'));

    await expect(generateDiff('file.txt', 'new line\n')).rejects.toThrow('EACCES');
  });
});
