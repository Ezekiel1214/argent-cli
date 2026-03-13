import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');

async function importDistModule(relativePath) {
  return import(pathToFileURL(path.join(distRoot, relativePath)).href);
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

await run('parser extracts file markers across comment styles', async () => {
  const { parseClipboard } = await importDistModule(path.join('core', 'parser.js'));

  const input = [
    '```ts',
    '// FILE: src/example.ts',
    'export const value = 1;',
    '```',
    '```html',
    '<!-- FILE: public/index.html -->',
    '<div>Hello</div>',
    '```',
    '```css',
    '/* FILE: styles/site.css */',
    'body { color: black; }',
    '```',
  ].join('\n');

  const blocks = parseClipboard(input);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].suggestedPath, 'src/example.ts');
  assert.equal(blocks[1].suggestedPath, 'public/index.html');
  assert.equal(blocks[2].suggestedPath, 'styles/site.css');
  assert.equal(blocks[0].content, 'export const value = 1;');
  assert.equal(blocks[1].content, '<div>Hello</div>');
  assert.equal(blocks[2].content, 'body { color: black; }');
});

await run('parser falls back to plain document capture when no code fences exist', async () => {
  const { parseClipboard } = await importDistModule(path.join('core', 'parser.js'));
  const blocks = parseClipboard([
    '# Molin Control Plane Handover',
    '',
    'This package contains governance docs and a demo catalog.',
  ].join('\n'));

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].content, '# Molin Control Plane Handover\n\nThis package contains governance docs and a demo catalog.');
  assert.equal(blocks[0].suggestedPath, undefined);
});

await run('parser can split plain markdown documents by headings', async () => {
  const { parseClipboard } = await importDistModule(path.join('core', 'parser.js'));
  const blocks = parseClipboard([
    '# Overview',
    'General summary.',
    '',
    '## Governance',
    '<!-- FILE: docs/governance.md -->',
    'Rules and checks.',
    '',
    '## Shop Demo',
    'Catalog notes.',
  ].join('\n'), { splitHeadings: true });

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].content, '# Overview\nGeneral summary.');
  assert.equal(blocks[0].suggestedPath, undefined);
  assert.equal(blocks[1].content, '## Governance\nRules and checks.');
  assert.equal(blocks[1].suggestedPath, 'docs/governance.md');
  assert.equal(blocks[2].content, '## Shop Demo\nCatalog notes.');
});

await run('path normalizer keeps project-relative paths and rejects escapes', async () => {
  const { normalizeRelativeFilePath } = await importDistModule(path.join('core', 'paths.js'));

  assert.equal(normalizeRelativeFilePath('./src/example.ts'), 'src/example.ts');
  assert.equal(normalizeRelativeFilePath('"nested\\\\file.ts"'), 'nested/file.ts');
  assert.throws(() => normalizeRelativeFilePath('../escape.ts'));
  assert.throws(() => normalizeRelativeFilePath('C:\\temp\\file.ts'));
  assert.throws(() => normalizeRelativeFilePath('C:temp\\file.ts'));
});

await run('document path inference derives doc paths from headings', async () => {
  const { inferDocumentPath } = await importDistModule(path.join('core', 'inference.js'));
  assert.equal(inferDocumentPath('# Molin Control Plane Handover\n\nSummary'), 'docs/molin-control-plane-handover.md');
  assert.equal(inferDocumentPath('## Shop Demo\n\nCatalog notes', 'handover'), 'handover/shop-demo.md');
  assert.equal(inferDocumentPath('Plain paragraph with no heading'), undefined);
});

await run('doctor reports current capabilities as JSON', async () => {
  const { doctor } = await importDistModule(path.join('commands', 'doctor.js'));
  const outputs = [];
  const originalLog = console.log;

  try {
    console.log = (message) => {
      outputs.push(String(message));
    };
    await doctor({ json: true });
  } finally {
    console.log = originalLog;
  }

  const report = JSON.parse(outputs.join('\n'));
  assert.equal(report.version, '0.4.0');
  assert.ok(report.capabilities.captureInputs.includes('file'));
  assert.ok(report.capabilities.applyFeatures.includes('dry-run'));
  assert.ok(report.capabilities.buildFeatures.includes('optional deploy'));
});

await run('mapping saves and reloads validated blocks', async () => {
  const { saveMapping, loadMapping } = await importDistModule(path.join('core', 'mapping.js'));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-mapping-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    const blocks = [{ content: 'export const value = 1;', suggestedPath: './src/example.ts' }];
    await saveMapping(blocks);
    const loaded = await loadMapping();

    assert.deepEqual(loaded, [{ content: 'export const value = 1;', suggestedPath: 'src/example.ts' }]);

    await saveMapping(blocks, 'tmp/custom-mapping.json');
    const loadedCustom = await loadMapping('tmp/custom-mapping.json');
    assert.deepEqual(loadedCustom, [{ content: 'export const value = 1;', suggestedPath: 'src/example.ts' }]);

    await fs.writeFile(
      path.join('.argent', 'mapping.json'),
      JSON.stringify([{ content: 'bad', suggestedPath: '../escape.ts' }]),
      'utf-8',
    );

    await assert.rejects(loadMapping(), /cannot escape the current project/i);
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('differ preserves context lines for edited files', async () => {
  const { generateDiff } = await importDistModule(path.join('core', 'differ.js'));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-diff-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.writeFile('example.txt', 'keep\nold\n', 'utf-8');
    const diff = await generateDiff('example.txt', 'keep\nnew\n');

    assert.ok(diff);
    assert.match(diff, / keep/);
    assert.match(diff, /-old/);
    assert.match(diff, /\+new/);
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('writer stores backups under source-relative directories', async () => {
  const { applyChanges } = await importDistModule(path.join('core', 'writer.js'));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-writer-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('nested/dir', { recursive: true });
    await fs.writeFile(path.join('nested', 'dir', 'example.ts'), 'old\n', 'utf-8');
    await applyChanges(path.join('nested', 'dir', 'example.ts'), 'new\n');

    const written = await fs.readFile(path.join('nested', 'dir', 'example.ts'), 'utf-8');
    const backupEntries = await fs.readdir(path.join('.argent', 'backups', 'nested', 'dir'));

    assert.equal(written, 'new\n');
    assert.equal(backupEntries.length, 1);
    assert.match(backupEntries[0], /^example\.ts\.\d+\.bak$/);
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('writer surfaces non-ENOENT read failures', async () => {
  const { applyChanges } = await importDistModule(path.join('core', 'writer.js'));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-writer-error-'));
  const previousCwd = process.cwd();
  const originalReadFile = fs.readFile;

  try {
    process.chdir(tempDir);
    fs.readFile = async (...args) => {
      if (args[0] === 'blocked.txt') {
        const error = new Error('EACCES');
        error.code = 'EACCES';
        throw error;
      }

      return originalReadFile(...args);
    };

    await assert.rejects(applyChanges('blocked.txt', 'new\n'), /EACCES/);

    const blockedExists = await fs.access('blocked.txt').then(() => true).catch(() => false);
    assert.equal(blockedExists, false);
  } finally {
    fs.readFile = originalReadFile;
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('apply command can target a single mapped file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-apply-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('.argent', { recursive: true });
    await fs.mkdir('src', { recursive: true });
    await fs.writeFile('src/keep.ts', 'old keep\n', 'utf-8');
    await fs.writeFile('src/skip.ts', 'old skip\n', 'utf-8');
    await fs.writeFile(
      path.join('.argent', 'mapping.json'),
      JSON.stringify([
        { content: 'new keep\n', suggestedPath: 'src/keep.ts' },
        { content: 'new skip\n', suggestedPath: 'src/skip.ts' },
      ]),
      'utf-8',
    );

    const { apply } = await importDistModule(path.join('commands', 'apply.js'));
    await apply({ file: 'src/keep.ts', yes: true });

    const keepContent = await fs.readFile('src/keep.ts', 'utf-8');
    const skipContent = await fs.readFile('src/skip.ts', 'utf-8');

    assert.equal(keepContent, 'new keep\n');
    assert.equal(skipContent, 'old skip\n');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('apply can fail fast when no effective changes exist', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-noop-'));
  const previousCwd = process.cwd();
  const errors = [];

  try {
    process.chdir(tempDir);
    await fs.mkdir('.argent', { recursive: true });
    await fs.mkdir('src', { recursive: true });
    await fs.writeFile('src/same.ts', 'same\n', 'utf-8');
    await fs.writeFile(
      path.join('.argent', 'mapping.json'),
      JSON.stringify([{ content: 'same\n', suggestedPath: 'src/same.ts' }]),
      'utf-8',
    );

    const loggerModule = await importDistModule(path.join('utils', 'logger.js'));
    const originalError = loggerModule.logger.error;
    loggerModule.logger.error = (message) => {
      errors.push(String(message));
    };

    const { apply } = await importDistModule(path.join('commands', 'apply.js'));
    await apply({ file: 'src/same.ts', yes: true, requireChanges: true });

    loggerModule.logger.error = originalError;
    assert.equal(errors.at(-1), 'No effective changes found in the selected mapping.');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('apply dry-run prints diffs without writing files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-dry-run-'));
  const previousCwd = process.cwd();
  const infos = [];

  try {
    process.chdir(tempDir);
    await fs.mkdir('.argent', { recursive: true });
    await fs.mkdir('src', { recursive: true });
    await fs.writeFile('src/dry-run.ts', 'old value\n', 'utf-8');
    await fs.writeFile(
      path.join('.argent', 'mapping.json'),
      JSON.stringify([{ content: 'new value\n', suggestedPath: 'src/dry-run.ts' }]),
      'utf-8',
    );

    const loggerModule = await importDistModule(path.join('utils', 'logger.js'));
    const originalInfo = loggerModule.logger.info;
    loggerModule.logger.info = (message) => {
      infos.push(String(message));
    };

    const { apply } = await importDistModule(path.join('commands', 'apply.js'));
    await apply({ file: 'src/dry-run.ts', yes: true, dryRun: true, deploy: true });

    loggerModule.logger.info = originalInfo;

    const current = await fs.readFile('src/dry-run.ts', 'utf-8');
    const backupDirExists = await fs
      .access(path.join('.argent', 'backups'))
      .then(() => true)
      .catch(() => false);

    assert.equal(current, 'old value\n');
    assert.equal(backupDirExists, false);
    assert.ok(infos.includes('Dry run: skipping write for src/dry-run.ts'));
    assert.ok(infos.includes('Skipping deploy because dry-run mode is enabled.'));
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('capture and apply can use a custom mapping path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-custom-mapping-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('src', { recursive: true });
    await fs.writeFile('src/custom.ts', 'old custom\n', 'utf-8');

    const { capture } = await importDistModule(path.join('commands', 'capture.js'));
    const { apply } = await importDistModule(path.join('commands', 'apply.js'));

    const stdinChunks = [
      '```ts',
      '// FILE: src/custom.ts',
      'new custom',
      '```',
      '',
    ];
    process.stdin.push(stdinChunks.join('\n'));
    process.stdin.push(null);

    await capture({ stdin: true, output: 'tmp/mapping.json' });
    await apply({ mapping: 'tmp/mapping.json', file: 'src/custom.ts', yes: true });

    const updated = await fs.readFile('src/custom.ts', 'utf-8');
    assert.equal(updated, 'new custom');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('capture can read a plain documentation file without code fences', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-capture-file-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('incoming', { recursive: true });
    await fs.writeFile(
      path.join('incoming', 'handover.md'),
      [
        '<!-- FILE: docs/handover.md -->',
        '# Molin Control Plane Handover',
        '',
        'This package contains governance docs and a demo catalog.',
      ].join('\n'),
      'utf-8',
    );

    const { capture } = await importDistModule(path.join('commands', 'capture.js'));
    const { loadMapping } = await importDistModule(path.join('core', 'mapping.js'));

    await capture({ file: 'incoming/handover.md', output: 'tmp/handover-mapping.json' });
    const blocks = await loadMapping('tmp/handover-mapping.json');

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].suggestedPath, 'docs/handover.md');
    assert.equal(blocks[0].content, '# Molin Control Plane Handover\n\nThis package contains governance docs and a demo catalog.');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('capture can split a plain markdown file by headings and apply a default file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-split-headings-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('incoming', { recursive: true });
    await fs.writeFile(
      path.join('incoming', 'plan.md'),
      [
        '# Overview',
        'General summary.',
        '',
        '## Governance',
        '<!-- FILE: docs/governance.md -->',
        'Rules and checks.',
        '',
        '## Open Questions',
        'Follow-up decisions.',
      ].join('\n'),
      'utf-8',
    );

    const { capture } = await importDistModule(path.join('commands', 'capture.js'));
    const { loadMapping } = await importDistModule(path.join('core', 'mapping.js'));

    await capture({
      file: 'incoming/plan.md',
      output: 'tmp/split-mapping.json',
      splitHeadings: true,
      defaultFile: 'docs/overview.md',
    });

    const blocks = await loadMapping('tmp/split-mapping.json');
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].suggestedPath, 'docs/overview.md');
    assert.equal(blocks[1].suggestedPath, 'docs/governance.md');
    assert.equal(blocks[2].suggestedPath, 'docs/overview.md');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('capture can infer paths for split plain markdown sections', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-infer-paths-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('incoming', { recursive: true });
    await fs.writeFile(
      path.join('incoming', 'summary.md'),
      [
        '# Overview',
        'General summary.',
        '',
        '## Governance Rules',
        'Rules and checks.',
      ].join('\n'),
      'utf-8',
    );

    const { capture } = await importDistModule(path.join('commands', 'capture.js'));
    const { loadMapping } = await importDistModule(path.join('core', 'mapping.js'));

    await capture({
      file: 'incoming/summary.md',
      output: 'tmp/inferred-mapping.json',
      splitHeadings: true,
      inferPaths: true,
      docsDir: 'handover',
    });

    const blocks = await loadMapping('tmp/inferred-mapping.json');
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].suggestedPath, 'handover/overview.md');
    assert.equal(blocks[1].suggestedPath, 'handover/governance-rules.md');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('capture falls back when inferPaths cannot infer a path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-infer-fallback-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('incoming', { recursive: true });
    await fs.writeFile(path.join('incoming', 'plain.md'), 'Plain paragraph without heading', 'utf-8');

    const { capture } = await importDistModule(path.join('commands', 'capture.js'));
    const { loadMapping } = await importDistModule(path.join('core', 'mapping.js'));

    await capture({
      file: 'incoming/plain.md',
      output: 'tmp/infer-fallback.json',
      inferPaths: true,
      defaultFile: 'docs/fallback.md',
    });

    const blocks = await loadMapping('tmp/infer-fallback.json');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].suggestedPath, 'docs/fallback.md');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('build command can ingest a document and write inferred output files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-build-command-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('incoming', { recursive: true });
    await fs.writeFile(
      path.join('incoming', 'handover.md'),
      [
        '# Overview',
        'General summary.',
        '',
        '## Shop Demo',
        'Catalog notes.',
      ].join('\n'),
      'utf-8',
    );

    const { build } = await importDistModule(path.join('commands', 'build.js'));
    await build({
      file: 'incoming/handover.md',
      mapping: 'tmp/build-mapping.json',
      inferPaths: true,
      docsDir: 'docs',
      splitHeadings: true,
      yes: true,
    });

    const overview = await fs.readFile(path.join('docs', 'overview.md'), 'utf-8');
    const shopDemo = await fs.readFile(path.join('docs', 'shop-demo.md'), 'utf-8');

    assert.equal(overview, '# Overview\nGeneral summary.');
    assert.equal(shopDemo, '## Shop Demo\nCatalog notes.');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('build command does not apply stale mappings when capture produces no output', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-build-empty-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fs.mkdir('.argent', { recursive: true });
    await fs.mkdir('incoming', { recursive: true });
    await fs.mkdir('docs', { recursive: true });
    await fs.writeFile(path.join('docs', 'stale.md'), 'stale\n', 'utf-8');
    await fs.writeFile(path.join('incoming', 'empty.md'), '', 'utf-8');
    await fs.writeFile(
      path.join('.argent', 'mapping.json'),
      JSON.stringify([{ content: 'new stale\n', suggestedPath: 'docs/stale.md' }]),
      'utf-8',
    );

    const { build } = await importDistModule(path.join('commands', 'build.js'));
    await build({
      file: 'incoming/empty.md',
      yes: true,
    });

    const stale = await fs.readFile(path.join('docs', 'stale.md'), 'utf-8');
    assert.equal(stale, 'stale\n');
  } finally {
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

await run('init surfaces non-ENOENT access failures', async () => {
  const { init } = await importDistModule(path.join('commands', 'init.js'));
  const loggerModule = await importDistModule(path.join('utils', 'logger.js'));
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'argent-verify-init-error-'));
  const previousCwd = process.cwd();
  const originalAccess = fs.access;
  const originalError = loggerModule.logger.error;
  const errors = [];

  try {
    process.chdir(tempDir);
    fs.access = async (...args) => {
      if (args[0] === path.join(tempDir, '.argentrc.json')) {
        const error = new Error('EACCES');
        error.code = 'EACCES';
        throw error;
      }

      return originalAccess(...args);
    };
    loggerModule.logger.error = (message) => {
      errors.push(String(message));
    };

    await init();

    const configExists = await originalAccess(path.join(tempDir, '.argentrc.json')).then(() => true).catch(() => false);
    assert.equal(configExists, false);
    assert.equal(errors.at(-1), 'EACCES');
  } finally {
    fs.access = originalAccess;
    loggerModule.logger.error = originalError;
    process.chdir(previousCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

console.log('Core verification passed.');
