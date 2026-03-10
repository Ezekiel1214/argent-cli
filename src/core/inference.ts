import { normalizeRelativeFilePath } from './paths.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function inferDocumentPath(content: string, docsDir = 'docs'): string | undefined {
  const firstLine = content.split('\n').find((line) => line.trim());
  if (!firstLine) {
    return undefined;
  }

  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);
  if (!headingMatch) {
    return undefined;
  }

  const slug = slugify(headingMatch[1]);
  if (!slug) {
    return undefined;
  }

  return normalizeRelativeFilePath(`${docsDir}/${slug}.md`);
}
