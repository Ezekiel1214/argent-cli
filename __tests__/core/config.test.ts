import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchMock = vi.fn();

vi.mock('cosmiconfig', () => ({
  cosmiconfig: vi.fn(() => ({ search: searchMock })),
}));

describe('config', () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it('returns empty object if no config found', async () => {
    searchMock.mockResolvedValue(null);
    const { loadConfig } = await import('../../src/core/config.js');
    const config = await loadConfig();
    expect(config).toEqual({});
  });

  it('returns config if found', async () => {
    searchMock.mockResolvedValue({ config: { autoDeploy: true } });
    const { loadConfig } = await import('../../src/core/config.js');
    const config = await loadConfig();
    expect(config).toEqual({ autoDeploy: true });
  });

  it('throws when config is not an object', async () => {
    searchMock.mockResolvedValue({ config: 'bad', filepath: 'C:/repo/.argentrc.json' });
    const { loadConfig } = await import('../../src/core/config.js');
    await expect(loadConfig()).rejects.toThrow('Invalid config in C:/repo/.argentrc.json: expected a JSON object.');
  });

  it('throws when deploy provider is invalid', async () => {
    searchMock.mockResolvedValue({ config: { deployProvider: 'render' }, filepath: 'C:/repo/.argentrc.json' });
    const { loadConfig } = await import('../../src/core/config.js');
    await expect(loadConfig()).rejects.toThrow(
      'Invalid config in C:/repo/.argentrc.json: "deployProvider" must be "vercel" or "netlify".',
    );
  });
});
