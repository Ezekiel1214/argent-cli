import fs from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { init } from '../../src/commands/init.js';
import * as logger from '../../src/utils/logger.js';

const mockedFs = vi.mocked(fs);

describe('init command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates .argentrc.json if not exists', async () => {
    mockedFs.access.mockRejectedValue(new Error('ENOENT'));
    mockedFs.writeFile.mockResolvedValue(undefined);

    await init();

    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.argentrc.json'),
      JSON.stringify({ autoDeploy: false, backupDir: '.argent/backups' }, null, 2),
      'utf-8',
    );
    expect(logger.logger.success).toHaveBeenCalled();
  });

  it('warns if file already exists', async () => {
    mockedFs.access.mockResolvedValue(undefined);
    await init();
    expect(logger.logger.warn).toHaveBeenCalledWith('.argentrc.json already exists.');
    expect(mockedFs.writeFile).not.toHaveBeenCalled();
  });
});
