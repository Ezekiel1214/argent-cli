import { describe, expect, it } from 'vitest';
import { parseClipboard } from '../../src/core/parser.js';

describe('parser', () => {
  it('extracts code blocks without markers', () => {
    const input = '```js\nconst a = 1;\n```';
    const blocks = parseClipboard(input);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe('const a = 1;');
    expect(blocks[0].suggestedPath).toBeUndefined();
  });

  it('detects // FILE: marker', () => {
    const input = '```js\n// FILE: src/index.js\nconst a = 1;\n```';
    const blocks = parseClipboard(input);
    expect(blocks[0].suggestedPath).toBe('src/index.js');
  });

  it('detects # FILE: marker', () => {
    const input = '```py\n# FILE: src/main.py\nprint("hello")\n```';
    const blocks = parseClipboard(input);
    expect(blocks[0].suggestedPath).toBe('src/main.py');
  });

  it('ignores markers not in first 5 lines', () => {
    const input = '```\nline1\nline2\nline3\nline4\nline5\n// FILE: deep.js\ncontent\n```';
    const blocks = parseClipboard(input);
    expect(blocks[0].suggestedPath).toBeUndefined();
  });

  it('handles multiple blocks with mixed markers', () => {
    const input = '```js\n// FILE: a.js\ncodeA\n```\n```js\ncodeB\n```';
    const blocks = parseClipboard(input);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].suggestedPath).toBe('a.js');
    expect(blocks[1].suggestedPath).toBeUndefined();
  });
});
