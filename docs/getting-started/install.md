---
title: Installation
description: Install and set up StaticDocs
navCategory: Getting Started
navOrder: 1
---

# Installation

StaticDocs is distributed on NPM and runs on Node.js 18 or newer.

## Requirements

- Node.js 18+ (ESM).
- A repository containing one or more Markdown files.

## Install via NPM

Add the package as a dev dependency:

```bash
npm install --save-dev @org/static-docs
```

This also installs the `static-docs` binary, available through `npx`.

## Create a config

Add a `static-docs.config.json` to your repo root:

```json
{
  "$schema": "./node_modules/@org/static-docs/schema.json",
  "siteName": "My Project Docs",
  "outputDir": "./docs-build"
}
```

## Next Steps

Run your first build with `npx static-docs build`, then read the
[configuration guide](../guides/config.md) to customize routing, themes, and
the table of contents.
