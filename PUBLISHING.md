# Publishing

This repo publishes the CLI package `super-ai-argent`.

Current package version:

```text
0.4.3
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
npm.cmd publish --otp 123456
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
npm.cmd publish
```

### Option 3: Trusted Publishing From GitHub Actions

This repo includes:

```text
.github/workflows/publish.yml
```

Use npm trusted publishing if you want GitHub Actions to publish future releases instead of a local terminal session.

## Common Failure Modes

`401 Unauthorized`

- npm auth is invalid
- fix with `npm.cmd login` or a new granular token

`403 Two-factor authentication or granular access token with bypass 2fa enabled is required`

- you are authenticated, but publish still does not satisfy npm's 2FA policy
- use a real OTP with `--otp`, or use a granular token with `Bypass 2FA`

## Release Line

Current pushed tags:

```text
v0.4.3
v0.4.2
v0.4.1
v0.4.0
```

The current verified release target is:

```text
super-ai-argent@0.4.3
```
