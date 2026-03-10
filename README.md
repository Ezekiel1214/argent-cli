# super-ai-argent

Small CLI for turning AI-generated code blocks into reviewed file updates, with optional Vercel deployment.

## Commands

`argent capture`
Reads the clipboard, extracts fenced code blocks, detects `FILE:` markers, and saves a normalized mapping to `.argent/mapping.json`.

`argent capture --stdin`
Reads the AI response from standard input instead of the clipboard. This is the non-interactive path for shell pipelines.

`argent capture --file incoming/handover.md`
Reads AI conversation or documentation from a project-relative file on disk.

`argent capture --default-file docs/handover.md`
Uses the specified project-relative file for blocks that do not include a `FILE:` marker.

`argent capture --infer-paths --docs-dir handover`
Infers output document paths from markdown headings when blocks do not include a `FILE:` marker.

`argent capture --output tmp/mapping.json`
Writes the captured mapping to a custom project-relative JSON path instead of `.argent/mapping.json`.

`argent capture --split-headings`
When plain markdown has no code fences, splits it into multiple blocks by headings instead of treating the whole document as one block.

Supported inline file markers in the first 5 lines of a code block:
- `// FILE: src/app.ts`
- `# FILE: src/app.py`
- `/* FILE: styles/site.css */`
- `<!-- FILE: public/index.html -->`

If no fenced code blocks are present, `capture` treats the entire input as one document block by default. With `--split-headings`, plain markdown is split into sections, which is useful for long handovers and structured AI summaries.

`argent apply`
Shows a line-based diff for each mapped file, asks for confirmation, writes the approved changes, and creates backups under `.argent/backups`.

`argent apply --yes`
Applies every mapped change without interactive confirmation. This is the non-interactive mode for scripting.

`argent apply --file src/app.ts`
Applies only the mapped change for a specific project-relative file.

`argent apply --mapping tmp/mapping.json`
Reads mapped changes from a custom project-relative JSON file.

`argent apply --dry-run`
Prints the selected diffs without writing files, creating backups, or deploying.

`argent apply --require-changes`
Reports an error if the selected mapping produces no effective file changes. Useful in CI and automation.

`argent apply --deploy`
Runs the normal apply flow and deploys to Vercel only if at least one file was actually updated.

`argent build --file incoming/handover.md --split-headings --infer-paths --yes`
Runs document ingestion and apply in one step, turning a handover or AI summary directly into built files.

`argent build --file incoming/handover.md --split-headings --infer-paths --yes --deploy`
Runs the full agent flow: ingest the document, build the inferred files, and deploy when changes were actually applied.

`argent doctor`
Checks the current environment and reports the up-to-date capabilities, integrations, and available workflow options.

`argent deploy`
Triggers a production Vercel deployment for the current project.

`argent init`
Creates a default `.argentrc.json`:

```json
{
  "autoDeploy": false,
  "backupDir": ".argent/backups"
}
```

## Safety Rules

- File paths are normalized to project-relative paths.
- Absolute paths, UNC paths, and `..` traversal are rejected.
- Existing files are backed up before overwrite.
- Saved mappings are revalidated when loaded.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Primary verification path:

```bash
npm test
```

Additional checks:

```bash
npm run smoke
npm run test:vitest
```

Notes:
- `npm test` runs the in-process core verifier and works in restricted environments.
- `npm run test:vitest` keeps the original Vitest suite available, but it may fail in locked-down sandboxes that block process spawning.
