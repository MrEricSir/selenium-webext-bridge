# Release Process

## Prerequisites

- npm account with publish access to `selenium-webext-bridge`
- Logged in via `npm login`
- All tests passing (`npm test`)
- Working directory clean (`git status`)

## Steps

### 1. Update the version

Decide on the new version number following [semver](https://semver.org/):

```bash
# For a patch release (bug fixes):
npm version patch

# For a minor release (new features, backwards-compatible):
npm version minor

# For a major release (breaking changes):
npm version major
```

This updates `package.json` and creates a git commit + tag automatically.

### 2. Update CHANGELOG.md

Add a new section at the top of `CHANGELOG.md` for the new version. Summarize what changed since the last release. Amend the version commit:

```bash
git add CHANGELOG.md
git commit --amend --no-edit
git tag -d vX.Y.Z
git tag vX.Y.Z
```

### 3. Run tests

```bash
npm test
```

### 4. Preview the package

Check what will be published:

```bash
npm pack --dry-run
```

Verify no unexpected files are included. The `files` field in `package.json` controls this.

### 5. Publish to npm

```bash
npm publish
```

### 6. Push to GitHub

```bash
git push origin main --tags
```

### 7. Create a GitHub Release

1. Go to https://github.com/MrEricSir/selenium-webext-bridge/releases/new
2. Select the tag you just pushed
3. Title: `vX.Y.Z`
4. Paste the changelog entry for this version into the description
5. Click "Publish release"
