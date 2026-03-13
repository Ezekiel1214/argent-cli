import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/commands/capture.js', () => ({ capture: vi.fn() }));
vi.mock('../../src/commands/apply.js', () => ({ apply: vi.fn() }));

import { build } from '../../src/commands/build.js';
import * as applyModule from '../../src/commands/apply.js';
import * as captureModule from '../../src/commands/capture.js';

describe('build command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes deploy provider through to apply', async () => {
    await build({
      deploy: true,
      deployProvider: 'netlify',
      file: 'incoming/handover.md',
      inferPaths: true,
      splitHeadings: true,
      yes: true,
    });

    expect(captureModule.capture).toHaveBeenCalledWith({
      defaultFile: undefined,
      docsDir: undefined,
      file: 'incoming/handover.md',
      inferPaths: true,
      output: undefined,
      splitHeadings: true,
      stdin: undefined,
    });
    expect(applyModule.apply).toHaveBeenCalledWith({
      deploy: true,
      deployProvider: 'netlify',
      dryRun: undefined,
      file: undefined,
      mapping: undefined,
      requireChanges: undefined,
      yes: true,
    });
  });
});
