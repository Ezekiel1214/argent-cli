import path from 'path';

function hasWindowsDrivePrefix(value: string): boolean {
  return /^[a-zA-Z]:/.test(value);
}

export function normalizeRelativeFilePath(input: string): string {
  const trimmed = input.trim().replace(/^['"`]+|['"`]+$/g, '');
  const withForwardSlashes = trimmed.replace(/\\/g, '/');

  if (!withForwardSlashes) {
    throw new Error('File path cannot be empty.');
  }

  if (path.isAbsolute(trimmed) || hasWindowsDrivePrefix(trimmed) || withForwardSlashes.startsWith('//')) {
    throw new Error(`File path must be relative to the current project: ${input}`);
  }

  const normalized = path.posix.normalize(withForwardSlashes).replace(/^\.\/+/, '');

  if (!normalized || normalized === '.') {
    throw new Error('File path cannot be empty.');
  }

  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`File path cannot escape the current project: ${input}`);
  }

  return normalized;
}
