import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({ execa: vi.fn().mockResolvedValue({ stdout: '1.2.3' }) }));
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { doctor } from '../../src/commands/doctor.js';
import { APP_VERSION } from '../../src/version.js';

describe('doctor command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the current package version in json mode', async () => {
    const originalLog = console.log;
    const outputs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      outputs.push(String(message));
    });

    try {
      await doctor({ json: true });
    } finally {
      console.log = originalLog;
    }

    const report = JSON.parse(outputs.join('\n'));
    expect(report.version).toBe(APP_VERSION);
  });
});
