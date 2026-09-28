---
title: Home
description: Turn Markdown into a static documentation site.
navOrder: 0
---

# StaticDocs

**StaticDocs** (`@krizic/static-docs`) turns a repository's Markdown files into a
multi-page, deeply-linked, static documentation site with zero runtime
JavaScript. Drop a JSON config in your repo root, run one command, and get a
folder of HTML, CSS, and assets ready to deploy anywhere.

## Features

- **Zero-JS output** — sidebar and navigation work with pure CSS.
- **Deep linking** — every heading gets a slugged, linkable `id`.
- **Right-hand TOC** — an "On this page" panel generated per document.
- **Pretty URLs** — `docs/start.md` becomes `/docs/start/`.
- **Link rewriting** — `[Guide](./other.md)` is rewritten to `/other/`.
- **GitHub-flavored Markdown** — tables, task lists, strikethrough, autolinks.
- **Build-time syntax highlighting** — via Shiki, no client runtime.
- **Tailwind v4 themes** — compiled against your generated HTML.
- **Web-component routes** — mount a pre-built custom element on its own page.

## Install

```bash
npm install --save-dev @krizic/static-docs
```

## Usage

Create a `static-docs.config.json`, then build:

```bash
npx static-docs build
```

Or run the live-reloading dev server:

```bash
npx static-docs dev --port 4321
```

## Previewing the built site

The build output is plain static files, so any web server works. For a local
preview without extra tooling:

```bash
npx static-docs serve            # serves outputDir from the config on :8080
npx static-docs serve --port 9000 --dir ./dist-docs
```

`serve` reads `outputDir` and `basePath` from `static-docs.config.json`
(`--dir` overrides the directory), redirects directory URLs to their
canonical trailing-slash form, and refuses path traversal outside the served
root. It exits with code 1 when there is nothing to serve, so it is safe to
wire into scripts after a build.

## Commands

| Command | Description |
|---------|-------------|
| `static-docs build` | Build the site into `outputDir`. |
| `static-docs dev`   | Watch and serve with live reload. |
| `static-docs serve` | Serve the built site over HTTP. |
| `static-docs schema`| Emit a JSON Schema for the config file. |
| `static-docs schema --manifest` | Emit a JSON Schema for the evidence manifest. |

## Playwright evidence integration

The optional `@krizic/static-docs/playwright` subpath turns verification
screenshots into an evidence manifest for the gallery pages.
`@playwright/test` is an optional peer dependency (`>=1.40`) — install it only
in projects that use this integration.

Register the reporter and annotate tests:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['@krizic/static-docs/playwright/reporter', { outputDir: 'e2e-screenshots' }],
  ],
});
```

```ts
// specs/newsletter.spec.ts
import { test } from '@playwright/test';
import { addEvidence, saveEvidenceScreenshot } from '@krizic/static-docs/playwright';

test('toggles a newsletter', async ({ page }, info) => {
  addEvidence(info, {
    title: 'Newsletter abonnieren',
    shows: 'Der Newsletter-Tab',
    proves: 'Toggle speichert den Status',
  });
  // ... interact with the page ...
  await saveEvidenceScreenshot(page, info, 'newsletter', { dir: 'e2e-screenshots' });
});
```

At the end of the run the reporter writes `e2e-screenshots/manifest.json`.
The reporter's `outputDir` is resolved relative to Playwright's `rootDir` —
the configured `testDir` when one is set, otherwise the directory containing
the Playwright config file. In contrast, `saveEvidenceScreenshot`'s `dir`
option is resolved against `process.cwd()`, so prefer passing an absolute
path (e.g. via `path.resolve`) to stay independent of the directory the test
runner was started from. Screenshot names must be unique across tests — the same name from several browser projects is
aggregated into one entry, but the same name from two different tests fails
the run with an error naming both tests. Tests without evidence screenshots
are skipped.

Statuses map from the Playwright outcome: expected → `passed`, flaky →
`flaky`, skipped → `skipped`, unexpected → `failed`; an entry fails when any
browser project of the test failed, even one that crashed before taking a
screenshot.

## Evidence manifest schema

`manifest.json` contains `{ generatedAt, evidence: [...] }`. Each evidence
entry has an `id`, a `status` (`passed`, `failed`, `flaky`, or `skipped`),
and per-browser shots under `browsers`. The metadata fields `title`, `shows`,
and `proves` are optional — entries without them render a "Metadata missing"
badge in the gallery, and the card title falls back to the entry id.

`static-docs schema --manifest` writes the JSON Schema for the format; the
package also ships it as `evidence-manifest.schema.json`, so manifests can
reference it via the optional `$schema` field.

## Changelog

### 0.2.0 (additive)

- New `static-docs serve` command and programmatic `serve()` /
  `createStaticHandler()` API for previewing the built site.
- New `@krizic/static-docs/playwright` subpath (`addEvidence`,
  `saveEvidenceScreenshot`, `buildEvidenceManifest`, `extractEvidenceMeta`)
  and `@krizic/static-docs/playwright/reporter` default-exported reporter;
  `@playwright/test` is an optional peer dependency.
- Evidence manifest: `flaky` and `skipped` statuses, optional
  `title`/`shows`/`proves`, optional `$schema`; the gallery renders distinct
  badges and a "Metadata missing" badge. Old manifests remain valid.
- New `EVIDENCE_MANIFEST_FILENAME` constant; `static-docs schema --manifest`;
  the package ships `evidence-manifest.schema.json`.
- Dev server hardening: encoded path traversal now answers 403, malformed
  URLs 400 (instead of crashing), and directory URLs redirect to their
  canonical trailing-slash form.

## Releasing

Releases are automatic. Every push to `master` publishes a new patch version —
there is no need to edit the version in `package.json` by hand.

The published version on npm is the source of truth. On each run the workflow
reads the latest published version, increments its patch number, writes that
into `package.json`, builds, publishes to npm and GitHub Packages, and finally
pushes back a `chore(release): vX.Y.Z [skip ci]` commit and a matching `vX.Y.Z`
tag.

To cut a **minor or major** release, raise the version in `package.json`
yourself and push. A local version higher than the next patch wins, so
`0.1.4 → 0.2.0` ships as `0.2.0`; subsequent pushes then continue from
`0.2.1`.

Because the release commit is pushed with the built-in `GITHUB_TOKEN` and
carries `[skip ci]`, it does not trigger another run. The commit is made *after*
publishing, so a failed publish never leaves `master` advertising a version that
was never released — the next push simply resolves the same version again.

The CLI and the exported `version` constant report the released version: it is
inlined at build time from `package.json` as `__PKG_VERSION__`.

## Learn more

- [Installation guide](./docs/getting-started/install.md)
- [Configuration reference](./docs/guides/config.md)
