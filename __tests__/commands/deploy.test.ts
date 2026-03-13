import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../src/utils/prompts.js', () => ({ confirmDeploy: vi.fn() }));
vi.mock('../../src/utils/deploy-provider.js', () => ({
  getDeployProviderName: vi.fn((provider: string) => (provider === 'netlify' ? 'Netlify' : 'Vercel')),
  getNpxCommand: vi.fn(() => 'npx.cmd'),
  getVercelCommand: vi.fn(() => 'vercel.cmd'),
  resolveDeployProvider: vi.fn((provider?: string, fallback = 'vercel') => provider ?? fallback),
}));
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}));

import { execa } from 'execa';
import { deploy } from '../../src/commands/deploy.js';
import * as config from '../../src/core/config.js';
import * as prompts from '../../src/utils/prompts.js';
import * as logger from '../../src/utils/logger.js';

const mockedExeca = vi.mocked(execa);

describe('deploy command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error if Vercel CLI missing', async () => {
    mockedExeca.mockRejectedValue(new Error('not found'));
    await deploy();
    expect(logger.logger.error).toHaveBeenCalledWith('Vercel CLI not found. Please install it: npm i -g vercel');
  });

  it('prompts and deploys if confirmed', async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: '1.2.3' } as never);
    vi.mocked(prompts.confirmDeploy).mockResolvedValue(true);
    mockedExeca.mockResolvedValueOnce({ stdout: 'Deployed' } as never);

    await deploy();

    expect(prompts.confirmDeploy).toHaveBeenCalled();
    expect(logger.logger.info).toHaveBeenCalledWith('Deploying to Vercel...');
    expect(mockedExeca).toHaveBeenCalledWith('vercel.cmd', ['--prod'], { stdio: 'inherit' });
    expect(logger.logger.success).toHaveBeenCalledWith('Deployment complete!');
  });

  it('deploys to Netlify when requested', async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: '1.2.3' } as never);
    vi.mocked(prompts.confirmDeploy).mockResolvedValue(true);
    mockedExeca.mockResolvedValueOnce({ stdout: 'Deployed' } as never);

    await deploy({ provider: 'netlify' });

    expect(logger.logger.info).toHaveBeenCalledWith('Deploying to Netlify...');
    expect(mockedExeca).toHaveBeenCalledWith('npx.cmd', ['netlify', 'deploy', '--prod'], { stdio: 'inherit' });
  });

  it('does nothing if user declines', async () => {
    mockedExeca.mockResolvedValueOnce({ stdout: '1.2.3' } as never);
    vi.mocked(prompts.confirmDeploy).mockResolvedValue(false);

    await deploy();

    expect(mockedExeca).toHaveBeenCalledTimes(1);
    expect(logger.logger.info).not.toHaveBeenCalledWith('Deploying to Vercel...');
  });

  it('uses the configured deploy provider by default', async () => {
    vi.mocked(config.loadConfig).mockResolvedValueOnce({ deployProvider: 'netlify' });
    mockedExeca.mockResolvedValueOnce({ stdout: '1.2.3' } as never);
    vi.mocked(prompts.confirmDeploy).mockResolvedValue(true);
    mockedExeca.mockResolvedValueOnce({ stdout: 'Deployed' } as never);

    await deploy();

    expect(logger.logger.info).toHaveBeenCalledWith('Deploying to Netlify...');
  });
});
