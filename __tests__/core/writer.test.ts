import fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyChanges } from '../../src/core/writer.js';

vi.mock('fs/promises');
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}));

const mockedFs = vi.mocked(fs);

describe('writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates backup if file exists', async () => {
    mockedFs.readFile.mockResolvedValue('existing content' as never);
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);

    await applyChanges('src/file.js', 'new content');

    expect(mockedFs.mkdir).toHaveBeenCalledWith(expect.stringMatching(/\.argent[\\/]backups[\\/]src$/), { recursive: true });
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.argent[\\/]backups[\\/]src[\\/]file\.js\.\d+\.bak/),
      'existing content',
      'utf-8',
    );
    expect(mockedFs.mkdir).toHaveBeenCalledWith('src', { recursive: true });
    expect(mockedFs.writeFile).toHaveBeenCalledWith('src/file.js', 'new content', 'utf-8');
  });

  it('skips backup if file does not exist', async () => {
    const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedFs.readFile.mockRejectedValue(error);
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);

    await applyChanges('new/file.js', 'content');

    expect(mockedFs.mkdir).toHaveBeenCalledWith('new', { recursive: true });
    expect(mockedFs.writeFile).toHaveBeenCalledWith('new/file.js', 'content', 'utf-8');
  });

  it('surfaces non-ENOENT read failures', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('EACCES'));

    await expect(applyChanges('src/file.js', 'new content')).rejects.toThrow('EACCES');
  });
});
