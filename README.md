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

## Commands

| Command | Description |
|---------|-------------|
| `static-docs build` | Build the site into `outputDir`. |
| `static-docs dev`   | Watch and serve with live reload. |
| `static-docs schema`| Emit a JSON Schema for the config file. |

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
