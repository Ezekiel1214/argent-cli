import { CodeBlock, ParseOptions } from '../types.js';

const FILE_MARKER_REGEXES = [
  /^(?:\/\/|#)\s*FILE:\s*(.+)$/i,
  /^\/\*\s*FILE:\s*(.+?)\s*\*\/$/i,
  /^<!--\s*FILE:\s*(.+?)\s*-->$/i,
];

function extractBlock(content: string): CodeBlock {
  const lines = content.split('\n');
  let filePath: string | undefined;
  let markerLineIndex = -1;

  for (let i = 0; i < Math.min(5, lines.length); i += 1) {
    const line = lines[i].trim();
    for (const regex of FILE_MARKER_REGEXES) {
      const markerMatch = line.match(regex);
      if (markerMatch) {
        filePath = markerMatch[1].trim();
        markerLineIndex = i;
        break;
      }
    }

    if (filePath) {
      break;
    }
  }

  const contentLines = markerLineIndex >= 0
    ? lines.filter((_, index) => index !== markerLineIndex)
    : lines;

  return {
    content: contentLines.join('\n').trim(),
    suggestedPath: filePath,
  };
}

function splitPlainDocument(text: string): string[] {
  const sections = text
    .split(/(?=^#{1,3}\s+[^\n]+$)/m)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.length > 0 ? sections : [text];
}

export function parseClipboard(text: string, options: ParseOptions = {}): CodeBlock[] {
  const blockRegex = /```[^\n]*\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;
  const normalizedText = text.replace(/\r\n/g, '\n').trim();

  while ((match = blockRegex.exec(text)) !== null) {
    blocks.push(extractBlock(match[1].replace(/\r\n/g, '\n').trim()));
  }

  if (blocks.length === 0 && normalizedText) {
    const sections = options.splitHeadings ? splitPlainDocument(normalizedText) : [normalizedText];
    sections.forEach((section) => blocks.push(extractBlock(section)));
  }

  return blocks;
}
