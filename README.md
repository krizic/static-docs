---
title: Home
description: Turn Markdown into a zero-JS static documentation site.
navOrder: 0
---

# StaticDocs

**StaticDocs** (`@org/static-docs`) turns a repository's Markdown files into a
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

## Install

```bash
npm install --save-dev @org/static-docs
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

## Learn more

- [Installation guide](./docs/getting-started/install.md)
- [Configuration reference](./docs/guides/config.md)
