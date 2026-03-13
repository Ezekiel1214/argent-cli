import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const distRoot = path.join(repoRoot, 'dist');

  try {
    await fs.access(path.join(distRoot, 'core', 'parser.js'));
    await fs.access(path.join(distRoot, 'core', 'mapping.js'));
    await fs.access(path.join(distRoot, 'core', 'differ.js'));
  } catch {
    throw new Error('Build output not found. Run `npm run build` before `npm run smoke`.');
  }

  const parserModule = await import(pathToFileURL(path.join(distRoot, 'core', 'parser.js')).href);
  const mappingModule = await import(pathToFileURL(path.join(distRoot, 'core', 'mapping.js')).href);
  const differModule = await import(pathToFileURL(path.join(distRoot, 'core', 'differ.js')).href);

  const blocks = parserModule.parseClipboard('```ts\n// FILE: src/example.ts\nexport const value = 1;\n```');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].suggestedPath, 'src/example.ts');

  const htmlBlocks = parserModule.parseClipboard('```html\n<!-- FILE: public/index.html -->\n<div>Hello</div>\n```');
  assert.equal(htmlBlocks[0].suggestedPath, 'public/index.html');

  const diff = await differModule.generateDiff('does-not-exist.txt', 'hello\n');
  assert.ok(diff && diff.includes('+++ does-not-exist.txt'));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-smoke-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.writeFile('example.txt', 'keep\nold\n');
    const editedDiff = await differModule.generateDiff('example.txt', 'keep\nnew\n');
    assert.ok(editedDiff && editedDiff.includes(' keep'));
    assert.ok(editedDiff && editedDiff.includes('-old'));
    assert.ok(editedDiff && editedDiff.includes('+new'));
    const pathsModule = await import(pathToFileURL(path.join(distRoot, 'core', 'paths.js')).href);
    assert.equal(pathsModule.normalizeRelativeFilePath('./src/example.ts'), 'src/example.ts');
    assert.throws(() => pathsModule.normalizeRelativeFilePath('../escape.ts'));
    assert.throws(() => pathsModule.normalizeRelativeFilePath('C:temp\\file.ts'));
    await mappingModule.saveMapping(blocks);
    const loaded = await mappingModule.loadMapping();
    assert.deepEqual(loaded, blocks);

    const writerModule = await import(pathToFileURL(path.join(distRoot, 'core', 'writer.js')).href);
    await fs.mkdir(path.join('nested', 'dir'), { recursive: true });
    await fs.writeFile(path.join('nested', 'dir', 'example.ts'), 'old\n');
    await writerModule.applyChanges(path.join('nested', 'dir', 'example.ts'), 'new\n');
    const backupEntries = await fs.readdir(path.join('.argent', 'backups', 'nested', 'dir'));
    assert.equal(backupEntries.length, 1);
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log('Smoke test passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
