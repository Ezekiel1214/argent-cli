# Publishing

This repo publishes the CLI package `@ezekiel1214/argent-cli`.

Current package version:

```text
0.4.5
```

## Before You Publish

Run the normal verification path:

```powershell
npm.cmd run test:core
npm.cmd run test:vitest
npm.cmd run smoke
```

Check the package tarball:

```powershell
npm.cmd pack --dry-run
```

## Publish Options

### Option 1: Local Publish With npm 2FA

Log in:

```powershell
npm.cmd login
npm.cmd whoami
```

Publish with your real current npm authenticator code:

```powershell
npm.cmd publish --access public --otp 123456
```

Replace `123456` with the actual live 6-digit code from your authenticator app.

### Option 2: Granular npm Token With Bypass 2FA

Create an npm granular access token with:

- `Read and write`
- `Bypass 2FA`

Then configure it locally:

```powershell
npm.cmd config delete //registry.npmjs.org/:_authToken
npm.cmd config set //registry.npmjs.org/:_authToken YOUR_NPM_TOKEN
npm.cmd whoami
npm.cmd publish --access public
```

### Option 3: Trusted Publishing From GitHub Actions

This repo includes:

```text
.github/workflows/publish.yml
```

The workflow now publishes on tag push and then creates the GitHub release automatically.

Before it can work, npm must trust this repository as a publisher for `@ezekiel1214/argent-cli`.

Important bootstrap note:

- `@ezekiel1214/argent-cli` is still unpublished if `npm view @ezekiel1214/argent-cli version` returns `404`
- npm's current trusted-publisher setup is configured from package settings on npmjs.com
- inference: the first release may still need a manual `npm publish`, then trusted publishing can be configured from the package settings page for later releases

Set that up in npm package settings:

1. Open npm package settings for `@ezekiel1214/argent-cli`.
2. Go to `Trusted publishing`.
3. Add a GitHub Actions publisher for:
   - Owner: `Ezekiel1214`
   - Repository: `argent-cli`
   - Workflow filename: `publish.yml`

Launch path:

```powershell
git push origin master
git push origin v0.4.5
```

Requirements:

- npm trusted publishing must be configured for `Ezekiel1214/argent-cli`
- GitHub Actions must be enabled for the repository

Retry path after npm trusted publishing is configured:

- Go to the failed `Publish` run for `v0.4.5`
- Use `Re-run all jobs`

Fallback if you prefer a fresh run:

- bump the package version
- create and push a new `v*` tag

The workflow is idempotent:

- it skips `npm publish` if that exact version is already on npm
- it skips `gh release create` if the GitHub release already exists

## Common Failure Modes

`401 Unauthorized`

- npm auth is invalid
- fix with `npm.cmd login` or a new granular token

`403 Two-factor authentication or granular access token with bypass 2fa enabled is required`

- you are authenticated, but publish still does not satisfy npm's 2FA policy
- use a real OTP with `--otp`, or use a granular token with `Bypass 2FA`

GitHub Actions `npm publish` fails even though the workflow has `id-token: write`

- npm trusted publishing is not configured yet for this package and repo
- fix the npm package `Trusted publishing` settings, then re-run the failed tagged workflow

## Release Line

Current pushed tags:

```text
v0.4.5
v0.4.4
v0.4.3
v0.4.2
v0.4.1
```

The current verified release target is:

```text
@ezekiel1214/argent-cli@0.4.5
```
