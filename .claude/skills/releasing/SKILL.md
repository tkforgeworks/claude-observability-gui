---
name: releasing
description: Release pipeline and cadence for this repo — how RC and stable releases are cut, how the tagless release.yml works, and how release notes are derived. Use when bumping versions, cutting an RC, promoting to stable, or debugging the release workflow.
---

# Releasing

Branching context (also in CLAUDE.md): `main` is protected (PRs only, required `typecheck-and-test` check, no force-push/deletion, no bypass). Each release gets a branch `vX.Y.Z/main` cut from `main`; topic branches are named `vX.Y.Z/<topic>` and PR into it; the release branch PRs into `main` when the version ships.

## CI

`.github/workflows/ci.yml` — runs on pushes and PRs for `main` and `v*/main`. Ubuntu runner. Steps: `npm ci` → `npm run compile` → `npm test`. No installer build.

## Release pipeline (`.github/workflows/release.yml`, tagless — CGUI-65)

Triggers on pushes to `main` and `v*/main`, **never on tags** (no one pushes tags; CI creates them). `check-release` reads the `package.json` version and skips unless tag `v{version}` is missing AND the branch/version combination is legal: RC versions (`-rc.`/`alpha`/`beta`) release only from `v*/main` (as prereleases), stable versions only from `main`. The stable-version bump that `release:final` pushes to the release branch therefore does NOT release — the release cuts when its PR merges to `main`.

Remaining jobs: `release-notes`, `typecheck-and-test` (release gate — mirrors CI), and the CGUI-79 build/publish graph: `build-windows` and `build-linux` (each `npm ci` → `npx electron-rebuild` → `npm run dist -- --publish never` → upload-artifact; Linux produces AppImage + deb, and the runner's glibc sets their compatibility floor) feed a single `publish` job that downloads every platform's artifacts, creates ONE **draft** release with all assets (`tag_name: v{version}` at `target_commitish: github.sha`), then publishes via API — immutable releases lock assets at publish time, publishing is what creates the tag, and only the `publish` job may ever touch the release (two builders racing the same tag would break the invariant). Workflow-level `concurrency: group: release` queues overlapping merges.

## Release notes (TK ForgeWorks standard)

The `release-notes` job consumes the reusable workflow `tkforgeworks/.github/.github/workflows/release-notes.yml@main` (`ticket-prefix: CGUI`, `release-version: v{version}` passed explicitly since the workflow runs pre-tag) — the canonical script lives in the org standards repo, not here. Body derives from commit subjects since the previous tag: version-bump and merge commits filtered, subjects split into Changes vs Bug Fixes (bug-fix commit subjects must start with `Fix` or `CGUI-N: Fix ...`), `CGUI-*` keys auto-linked via the `JIRA_BASE_URL` repo variable. Stable releases diff against the previous *stable* tag so final notes span all RCs. Write commit subjects knowing they become changelog lines.

## Cadence

**Version on a release branch:** `package.json` stays at the **last shipped stable** until an RC is actually cut — don't hand-bump it. Any version matching `(rc|alpha|beta)` pushed to a `v*/main` branch is a *release trigger* (`check-release` will build and publish a prerelease), and a hand-set stable like `1.2.1` makes `rc-tag.js` derive its next base from *that* (so `rc:patch` would jump to `1.2.2-rc.1`). Consequence: dev builds report the last shipped version until the first RC, since the sidebar reads `app.getVersion()` (CGUI-73 marks them `-dev`).

On the release branch, `npm run rc:patch|minor|major` bumps to the next `-rc.N` (commit + push, no tag, refuses to run on `main`) and the push cuts a GitHub prerelease. `npm run release:final` promotes the RC to its stable version and opens the PR into `main`; merging it cuts the stable release. `npm run release:patch|minor|major` is the direct no-RC path (creates a `release/vX.Y.Z` branch + PR when run from `main`). Never run `npm version` + `git push --tags` manually — direct pushes to `main` are rejected by the ruleset and tags are CI-created.
