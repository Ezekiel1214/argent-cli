import fs from 'fs/promises';
import chalk from 'chalk';

interface DiffPart {
  type: 'context' | 'add' | 'remove';
  line: string;
}

function splitLines(content: string): string[] {
  if (content === '') {
    return [];
  }

  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines;
}

function buildDiffParts(oldLines: string[], newLines: string[]): DiffPart[] {
  const dp: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    Array.from({ length: newLines.length + 1 }, () => 0),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      if (oldLines[oldIndex] === newLines[newIndex]) {
        dp[oldIndex][newIndex] = dp[oldIndex + 1][newIndex + 1] + 1;
      } else {
        dp[oldIndex][newIndex] = Math.max(dp[oldIndex + 1][newIndex], dp[oldIndex][newIndex + 1]);
      }
    }
  }

  const parts: DiffPart[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      parts.push({ type: 'context', line: oldLines[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (dp[oldIndex + 1][newIndex] >= dp[oldIndex][newIndex + 1]) {
      parts.push({ type: 'remove', line: oldLines[oldIndex] });
      oldIndex += 1;
    } else {
      parts.push({ type: 'add', line: newLines[newIndex] });
      newIndex += 1;
    }
  }

  while (oldIndex < oldLines.length) {
    parts.push({ type: 'remove', line: oldLines[oldIndex] });
    oldIndex += 1;
  }

  while (newIndex < newLines.length) {
    parts.push({ type: 'add', line: newLines[newIndex] });
    newIndex += 1;
  }

  return parts;
}

function buildUnifiedDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);
  const parts = buildDiffParts(oldLines, newLines);

  const lines: string[] = [
    `--- ${filePath}`,
    `+++ ${filePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];

  parts.forEach((part) => {
    if (part.type === 'context') {
      lines.push(` ${part.line}`);
      return;
    }

    if (part.type === 'remove') {
      lines.push(`-${part.line}`);
      return;
    }

    lines.push(`+${part.line}`);
  });

  return lines.join('\n');
}

function isMissingFileError(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string' &&
    (err as { code: string }).code === 'ENOENT',
  );
}

export async function generateDiff(filePath: string, newContent: string): Promise<string | null> {
  let oldContent = '';

  try {
    oldContent = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (!isMissingFileError(err)) {
      throw err;
    }

    oldContent = '';
  }

  if (oldContent === newContent) {
    return null;
  }

  const patch = buildUnifiedDiff(filePath, oldContent, newContent);
  return patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return line;
      }
      if (line.startsWith('+')) {
        return chalk.green(line);
      }
      if (line.startsWith('-')) {
        return chalk.red(line);
      }
      if (line.startsWith('@@')) {
        return chalk.cyan(line);
      }
      return line;
    })
    .join('\n');
}
