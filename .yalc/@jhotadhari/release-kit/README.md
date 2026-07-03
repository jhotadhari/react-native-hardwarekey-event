# release-kit

Generic release pipeline for libraries and apps — bumps versions, manages changelogs, publishes to npm and GitHub.

## Quick start

```sh
yarn add --dev @jhotadhari/release-kit
```

Create a `release.config.ts` in your project root:

```ts
import { defineConfig } from '@jhotadhari/release-kit';

export default defineConfig({
    repo: 'https://github.com/your-org/your-repo',
});
```

Create a `CHANGELOG.md` with an `[Unreleased]` section:

```md
# Changelog

## [Unreleased]
```

Cut a release:

```sh
git checkout development
git checkout -b release/1.2.0
npx release-kit 1.2.0
```

## How it works

1. **Validates** — clean tree, correct branch, `[Unreleased]` exists, version is higher, typecheck/lint/tests pass
2. **Bumps** — version strings in configured files (JSON, Gradle)
3. **Changelogs** — dates and renames `[Unreleased]` → new version
4. **Commits** — on the release branch
5. **Merges** — into `main` (no-ff), tags, pushes
6. **GitHub Release** — from the changelog section
7. **npm publish** — with auto-detected dist-tag for prereleases
8. **Merges back** — into `development`
9. **Re-adds** — fresh `[Unreleased]` section

Run with `--dry-run` to validate without mutating.

## Documentation

- [Configuration](./docs/configuration.md) — full `ReleaseConfig` reference
- [Workflow](./docs/workflow.md) — branching model and release process
- [Version bumping](./docs/version-bumping.md) — JSON, Gradle, and versionCode
- [CLI reference](./docs/cli.md) — arguments, options, env vars

## License

[MIT](./LICENSE)
