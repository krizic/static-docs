---
title: Configuration
description: Reference for the static-docs.config.json file
navCategory: Guides
navOrder: 1
---

# Configuration

StaticDocs is driven by a single `static-docs.config.json` file placed in your
repository root. Every key is optional and has a sensible default.

## Site basics

### siteName

The name shown in the header and appended to each page `<title>`.

### outputDir

Where the built site is written. Defaults to `./docs-build`.

### basePath

The URL prefix the site is served under. Use `/` for a root deployment or
`/docs/` when hosting under a subpath.

## Routing

### Automatic scanning

By default, StaticDocs scans for `**/*.md` and maps each file to a pretty URL.
For example, `docs/getting-started/install.md` becomes `/docs/getting-started/install/`.

### Explicit routes

Provide a `routes` array to take full control:

```json
{
  "routes": [
    { "path": "/", "source": "./README.md", "meta": { "title": "Home" } },
    { "path": "/api/core", "source": "./packages/core/README.md" }
  ]
}
```

## Sidebar

The `sidebar` object controls navigation. Use `exclude` to skip files with glob
patterns, and `auto` to toggle directory-based grouping.

## Table of contents

The `toc` object controls the right-hand "On this page" panel via `enabled`,
`minDepth`, and `maxDepth`.

## Markdown

The `markdown` object toggles `gfm` and `smartypants`, and sets the Shiki
`shikiTheme` used for syntax highlighting.

## See also

Return to the [installation](../getting-started/install.md) guide.
