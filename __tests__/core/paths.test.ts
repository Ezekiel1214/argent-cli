import { describe, expect, it } from 'vitest';

import { normalizeRelativeFilePath } from '../../src/core/paths.js';

describe('paths', () => {
  it('normalizes simple project-relative paths', () => {
    expect(normalizeRelativeFilePath('./src/example.ts')).toBe('src/example.ts');
  });

  it('rejects escaping paths', () => {
    expect(() => normalizeRelativeFilePath('../escape.ts')).toThrow('File path cannot escape the current project');
  });

  it('rejects Windows absolute paths', () => {
    expect(() => normalizeRelativeFilePath('C:\\temp\\file.ts')).toThrow('File path must be relative to the current project');
  });

  it('rejects Windows drive-relative paths', () => {
    expect(() => normalizeRelativeFilePath('C:temp\\file.ts')).toThrow('File path must be relative to the current project');
  });
});
