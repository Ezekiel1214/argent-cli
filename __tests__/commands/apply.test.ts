import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/core/mapping.js', () => ({ loadMapping: vi.fn() }));
vi.mock('../../src/core/differ.js', () => ({ generateDiff: vi.fn() }));
vi.mock('../../src/core/writer.js', () => ({ applyChanges: vi.fn() }));
vi.mock('../../src/utils/prompts.js', () => ({ confirmApply: vi.fn() }));
vi.mock('../../src/commands/deploy.js', () => ({ deploy: vi.fn() }));

import { apply } from '../../src/commands/apply.js';
import * as mapping from '../../src/core/mapping.js';
import * as differ from '../../src/core/differ.js';
import * as writer from '../../src/core/writer.js';
import * as prompts from '../../src/utils/prompts.js';
import * as logger from '../../src/utils/logger.js';
import * as deployModule from '../../src/commands/deploy.js';

describe('apply command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
  });

  it('errors if no mapping found', async () => {
    vi.mocked(mapping.loadMapping).mockRejectedValue(new Error('not found'));
    await apply();
    expect(logger.logger.error).toHaveBeenCalledWith('No mapping found. Run `argent capture` first.');
  });

  it('skips blocks without suggestedPath', async () => {
    vi.mocked(mapping.loadMapping).mockResolvedValue([{ content: 'code', suggestedPath: undefined }]);
    await apply();
    expect(logger.logger.warn).toHaveBeenCalledWith('Skipping block with no file path (should not happen).');
  });

  it('shows diff and applies after confirmation', async () => {
    const blocks = [{ content: 'new', suggestedPath: 'file.js' }];
    vi.mocked(mapping.loadMapping).mockResolvedValue(blocks);
    vi.mocked(differ.generateDiff).mockResolvedValue('diff content');
    vi.mocked(prompts.confirmApply).mockResolvedValue(true);
    vi.mocked(writer.applyChanges).mockResolvedValue(undefined);

    await apply();

    expect(console.log).toHaveBeenCalledWith('diff content');
    expect(prompts.confirmApply).toHaveBeenCalledWith('file.js');
    expect(writer.applyChanges).toHaveBeenCalledWith('file.js', 'new');
    expect(logger.logger.success).toHaveBeenCalledWith('Updated file.js');
  });

  it('skips if user declines', async () => {
    const blocks = [{ content: 'new', suggestedPath: 'file.js' }];
    vi.mocked(mapping.loadMapping).mockResolvedValue(blocks);
    vi.mocked(differ.generateDiff).mockResolvedValue('diff');
    vi.mocked(prompts.confirmApply).mockResolvedValue(false);

    await apply();

    expect(writer.applyChanges).not.toHaveBeenCalled();
    expect(logger.logger.warn).toHaveBeenCalledWith('Skipped file.js');
  });

  it('skips if no diff', async () => {
    const blocks = [{ content: 'same', suggestedPath: 'file.js' }];
    vi.mocked(mapping.loadMapping).mockResolvedValue(blocks);
    vi.mocked(differ.generateDiff).mockResolvedValue(null);

    await apply();

    expect(logger.logger.info).toHaveBeenCalledWith('No changes for file.js');
    expect(prompts.confirmApply).not.toHaveBeenCalled();
  });

  it('triggers deploy if --deploy flag is passed', async () => {
    const blocks = [{ content: 'new', suggestedPath: 'file.js' }];

    vi.mocked(mapping.loadMapping).mockResolvedValue(blocks);
    vi.mocked(differ.generateDiff).mockResolvedValue('diff');
    vi.mocked(prompts.confirmApply).mockResolvedValue(true);
    vi.mocked(writer.applyChanges).mockResolvedValue(undefined);

    await apply({ deploy: true });

    expect(deployModule.deploy).toHaveBeenCalled();
  });

  it('passes the selected deploy provider through', async () => {
    const blocks = [{ content: 'new', suggestedPath: 'file.js' }];

    vi.mocked(mapping.loadMapping).mockResolvedValue(blocks);
    vi.mocked(differ.generateDiff).mockResolvedValue('diff');
    vi.mocked(prompts.confirmApply).mockResolvedValue(true);
    vi.mocked(writer.applyChanges).mockResolvedValue(undefined);

    await apply({ deploy: true, deployProvider: 'netlify' });

    expect(deployModule.deploy).toHaveBeenCalledWith({ provider: 'netlify' });
  });
});
