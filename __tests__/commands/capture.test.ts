import fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises');
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/core/clipboard.js', () => ({
  readClipboard: vi.fn(),
}));

vi.mock('../../src/core/parser.js', () => ({
  parseClipboard: vi.fn(),
}));

vi.mock('../../src/core/mapping.js', () => ({
  saveMapping: vi.fn(),
}));

vi.mock('../../src/utils/prompts.js', () => ({
  promptFilePath: vi.fn(),
}));

import { capture } from '../../src/commands/capture.js';
import * as clipboard from '../../src/core/clipboard.js';
import * as parser from '../../src/core/parser.js';
import * as mapping from '../../src/core/mapping.js';
import * as prompts from '../../src/utils/prompts.js';
import * as logger from '../../src/utils/logger.js';

const mockedFs = vi.mocked(fs);

describe('capture command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
  });

  it('shows warning when clipboard empty', async () => {
    vi.mocked(clipboard.readClipboard).mockResolvedValue('');
    await capture();
    expect(logger.logger.warn).toHaveBeenCalledWith('Clipboard is empty.');
  });

  it('shows warning when no code blocks', async () => {
    vi.mocked(clipboard.readClipboard).mockResolvedValue('text');
    vi.mocked(parser.parseClipboard).mockReturnValue([]);
    await capture();
    expect(logger.logger.warn).toHaveBeenCalledWith('No code blocks found in clipboard.');
  });

  it('shows file-specific warning when a file has no code blocks', async () => {
    mockedFs.readFile.mockResolvedValue('text' as never);
    vi.mocked(parser.parseClipboard).mockReturnValue([]);

    await capture({ file: 'incoming/handover.md' });

    expect(logger.logger.warn).toHaveBeenCalledWith('No code blocks found in the input file.');
  });

  it('prompts for missing file paths and saves mapping', async () => {
    const blocks = [
      { content: 'code1', suggestedPath: 'auto.js' },
      { content: 'code2', suggestedPath: undefined },
    ];
    vi.mocked(clipboard.readClipboard).mockResolvedValue('clip content');
    vi.mocked(parser.parseClipboard).mockReturnValue(blocks);
    vi.mocked(prompts.promptFilePath).mockResolvedValue({ filePath: 'manual.js' });
    vi.mocked(mapping.saveMapping).mockResolvedValue(undefined);

    await capture();

    expect(logger.logger.success).toHaveBeenCalledWith('Found 2 code block(s).');
    expect(prompts.promptFilePath).toHaveBeenCalledTimes(1);
    expect(mapping.saveMapping).toHaveBeenCalledWith([
      { content: 'code1', suggestedPath: 'auto.js' },
      { content: 'code2', suggestedPath: 'manual.js' },
    ], undefined);
    expect(logger.logger.success).toHaveBeenCalledWith(
      'Mapping saved to .argent/mapping.json. Run `argent apply` to preview and apply changes.',
    );
  });

  it('falls back to defaultFile when inferPaths cannot infer a path', async () => {
    const blocks = [{ content: 'Plain paragraph without heading', suggestedPath: undefined }];
    vi.mocked(clipboard.readClipboard).mockResolvedValue('clip content');
    vi.mocked(parser.parseClipboard).mockReturnValue(blocks);
    vi.mocked(mapping.saveMapping).mockResolvedValue(undefined);

    await capture({ inferPaths: true, defaultFile: 'docs/fallback.md' });

    expect(mapping.saveMapping).toHaveBeenCalledWith(
      [{ content: 'Plain paragraph without heading', suggestedPath: 'docs/fallback.md' }],
      undefined,
    );
  });

  it('prompts when inferPaths cannot infer a path and no default file is set', async () => {
    const blocks = [{ content: 'Plain paragraph without heading', suggestedPath: undefined }];
    vi.mocked(clipboard.readClipboard).mockResolvedValue('clip content');
    vi.mocked(parser.parseClipboard).mockReturnValue(blocks);
    vi.mocked(prompts.promptFilePath).mockResolvedValue({ filePath: 'docs/manual.md' });
    vi.mocked(mapping.saveMapping).mockResolvedValue(undefined);

    await capture({ inferPaths: true });

    expect(prompts.promptFilePath).toHaveBeenCalledTimes(1);
    expect(mapping.saveMapping).toHaveBeenCalledWith(
      [{ content: 'Plain paragraph without heading', suggestedPath: 'docs/manual.md' }],
      undefined,
    );
  });

  it('handles errors', async () => {
    vi.mocked(clipboard.readClipboard).mockRejectedValue(new Error('fail'));
    await capture();
    expect(logger.logger.error).toHaveBeenCalledWith('fail');
  });
});
