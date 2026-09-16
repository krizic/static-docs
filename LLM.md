# Repository Context: @krizic/static-docs

_Generated: 2026-09-16T17:58:59.733Z_

## Overview

- **@krizic/static-docs** (package.json) — v0.1.4
  - Turn Markdown into a static documentation site.
  - scripts: build, dev, typecheck, test, check, check:fix, schema, docs, llm, prepare, prepublishOnly

## Directory Structure

```
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish.yml
├── docs/
│   ├── getting-started/
│   │   └── install.md
│   └── guides/
│       ├── config.md
│       └── diagrams.md
├── scripts/
│   └── next-version.mjs
├── src/
│   ├── evidence/
│   │   ├── client-script.ts
│   │   ├── manifest.ts
│   │   ├── render.ts
│   │   └── styles.ts
│   ├── parser/
│   │   ├── index.ts
│   │   ├── links.ts
│   │   ├── mermaid.ts
│   │   ├── meta.ts
│   │   └── toc.ts
│   ├── renderer/
│   │   ├── layout.ts
│   │   ├── page.ts
│   │   ├── sidebar.ts
│   │   └── toc-panel.ts
│   ├── themes/
│   │   ├── default/
│   │   │   ├── index.ts
│   │   │   └── theme.css
│   │   └── minimal/
│   │       └── theme.css
│   ├── utils/
│   │   ├── fs.ts
│   │   └── path.ts
│   ├── assets.ts
│   ├── builder.ts
│   ├── cli.ts
│   ├── config.ts
│   ├── dev.ts
│   ├── globals.d.ts
│   ├── index.ts
│   ├── nav.ts
│   ├── router.ts
│   ├── scanner.ts
│   ├── theme.ts
│   └── types.ts
├── tests/
│   ├── evidence/
│   │   └── manifest.test.ts
│   ├── build.test.ts
│   ├── config.test.ts
│   └── router.test.ts
├── .gitignore
├── biome.json
├── lefthook.yml
├── LLM.md
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── schema.json
├── tsconfig.json
└── tsup.config.ts
```

## File Contents

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x, 24.x]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint and format check
        run: pnpm run check

      - name: Typecheck
        run: pnpm run typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm run build
```

### .github/workflows/publish.yml

```yaml
name: Publish to npm

on:
  push:
    branches:
      - master

permissions:
  contents: write # required to push the release commit and tag
  id-token: write # required for npm provenance
  packages: write # required to publish to GitHub Packages

# Serialise releases: two concurrent runs would resolve the same next version
# and the second publish would fail on an already-taken version.
concurrency:
  group: publish-master
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history so the release commit can be pushed

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm run typecheck

      # The npm registry is the source of truth for what has shipped, so the
      # next version is derived from it rather than from package.json. A
      # manually raised local version (a minor or major release) still wins.
      - name: Resolve next version
        id: version
        run: |
          LOCAL_VERSION=$(node -p "require('./package.json').version")
          PACKAGE_NAME=$(node -p "require('./package.json').name")
          PUBLISHED_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "none")
          NEXT_VERSION=$(node scripts/next-version.mjs "$PUBLISHED_VERSION" "$LOCAL_VERSION")

          echo "Local version:     $LOCAL_VERSION"
          echo "Published version: $PUBLISHED_VERSION"
          echo "Next version:      $NEXT_VERSION"

          echo "next=$NEXT_VERSION" >> "$GITHUB_OUTPUT"

      # Written before the build so tsup inlines the released version into the
      # bundle via __PKG_VERSION__.
      - name: Apply next version
        run: npm version "${{ steps.version.outputs.next }}" --no-git-tag-version --allow-same-version

      - name: Build
        run: pnpm run build

      - name: Generate LLM.md
        run: pnpm run llm

      - name: Publish to npm
        run: pnpm publish --provenance --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Also publishes to GitHub Packages so released versions show up under
      # the repo's "Packages" sidebar on GitHub, linked via the `repository`
      # field in package.json. Uses the built-in GITHUB_TOKEN, no extra secret needed.
      - name: Setup Node.js for GitHub Packages
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          registry-url: https://npm.pkg.github.com
          scope: '@krizic'

      - name: Publish to GitHub Packages
        run: pnpm publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Last, so a failed publish never leaves master advertising a version
      # that was never released. If this step fails, the next run simply
      # resolves the same next version again from the registry.
      - name: Commit and tag release
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add package.json LLM.md
          git commit -m "chore(release): v${{ steps.version.outputs.next }} [skip ci]"
          git tag "v${{ steps.version.outputs.next }}"
          git push origin HEAD:master --follow-tags
```

### .gitignore

```
node_modules/
dist/
docs-build/
*.log
.DS_Store
bin/
.vscode/
docs/superpowers/
```

### biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "**/*.ts",
      "**/*.js",
      "**/*.mjs",
      "**/*.json",
      "!dist",
      "!docs-build",
      "!schema.json",
      "!LLM.md",
      "!pnpm-lock.yaml"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "formatWithErrors": false
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error",
        "noNonNullAssertion": "warn",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noDoubleEquals": "error"
      },
      "complexity": {
        "noForEach": "off",
        "useOptionalChain": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "json": {
    "formatter": {
      "enabled": true,
      "indentWidth": 2
    }
  }
}
```

### docs/getting-started/install.md

```markdown
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
```

### docs/guides/config.md

```markdown
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

### Web-component routes

Use `componentRoutes` to attach a pre-built web component to a route. The route
appears in the sidebar like any other page, and the component fills the page
content area:

```json
{
  "componentRoutes": [
    {
      "path": "/workbench",
      "tag": "my-workbench",
      "script": "./dist/workbench.js",
      "title": "Workbench",
      "navCategory": "Tools",
      "navOrder": 5
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | yes | The route the component is served at. |
| `tag` | yes | Custom element tag to render. Must be lowercase and contain a hyphen. |
| `script` | yes | Path to a pre-built, self-contained ES module, relative to the config file. |
| `title` | no | Sidebar label. Defaults to the humanized last path segment. |
| `navCategory` | no | Groups the route under a flat sidebar category. |
| `navOrder` | no | Controls sidebar ordering. |
| `hidden` | no | Builds the page but omits it from the sidebar. |

The bundle is copied next to the route's `index.html` and loaded with
`<script type="module">`. It must register the custom element itself, for
example:

```js
class MyWorkbench extends HTMLElement {
  connectedCallback() {
    this.innerHTML = "<h1>Hello</h1>";
  }
}
customElements.define("my-workbench", MyWorkbench);
```

The build fails if `script` does not exist or `tag` is not a valid custom
element name. Component routes have no table of contents, and the component
receives no attributes from the config.

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

## Evidence galleries

Render a gallery of e2e test screenshots ("evidence") from a directory that
contains a `manifest.json` plus the referenced images:

```json
{
  "evidenceGalleries": [
    {
      "source": "./e2e-screenshots",
      "path": "/e2e-evidence",
      "title": "E2E Test Evidence",
      "description": "Screenshots proving documented behavior",
      "navCategory": "Quality",
      "navOrder": 10
    }
  ]
}
```

- `source` — directory with `manifest.json` and the images (relative to the
  config file).
- `path` — route of the gallery page.
- `title`, `description`, `navCategory`, `navOrder`, `hidden` — same meaning
  as for component routes.

### Manifest contract

```json
{
  "generatedAt": "2026-09-16T13:27:10.400Z",
  "evidence": [
    {
      "id": "authenticated-list",
      "title": "Authentifizierte Dokumentliste",
      "shows": "What the screenshot shows",
      "proves": "What the test proves",
      "spec": "specs/authenticated-list.spec.ts",
      "test": "renders authenticated list",
      "status": "passed",
      "browsers": {
        "chromium": { "file": "authenticated-list-chromium.png", "status": "passed" }
      }
    }
  ]
}
```

- `id` must be unique; it becomes the deep link:
  `/e2e-evidence/#authenticated-list` opens that evidence's detail modal.
- `status` is `"passed"` or `"failed"`, overall and per browser. Browser names
  are free-form.
- `spec` and `test` are optional. Unknown extra fields are allowed.
- A missing image file produces a build warning and a placeholder, not an
  error. An invalid or missing manifest fails the build with details.

In dev mode the `source` directory is watched, so re-running your e2e suite
reloads the gallery automatically.
```

### docs/guides/diagrams.md

```markdown
---
title: Diagrams
description: Render Mermaid diagrams in your documentation
navCategory: Guides
navOrder: 2
---

# Diagrams

StaticDocs renders [Mermaid](https://mermaid.js.org/) diagrams from fenced code
blocks. Any code block tagged `mermaid` is turned into a diagram in the browser.

## Usage

Write a fenced code block with the `mermaid` language tag:

````markdown
```mermaid
flowchart LR
  A[Markdown] --> B[StaticDocs]
  B --> C{Diagram?}
  C -->|yes| D[Render SVG]
  C -->|no| E[Zero-JS page]
```
````

It renders as:

```mermaid
flowchart LR
  A[Markdown] --> B[StaticDocs]
  B --> C{Diagram?}
  C -->|yes| D[Render SVG]
  C -->|no| E[Zero-JS page]
```

## Sequence diagrams

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant M as mermaid.js
  U->>B: Open page with a diagram
  B->>M: Load runtime (only on diagram pages)
  M-->>B: Render SVG
```

## Notes

- The mermaid runtime is bundled into your output at `/assets/mermaid.min.js`
  and loaded locally — no CDN or network access required.
- The script is injected **only** on pages that contain a diagram. Pages without
  diagrams stay 100% zero-JS.
```

### lefthook.yml

```yaml
# Lint and format staged files with Biome before every commit.
# Config reference: https://lefthook.dev/configuration/
pre-commit:
  parallel: true
  jobs:
    - name: biome
      glob: "*.{ts,js,mjs,json}"
      run: ./node_modules/.bin/biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files} && git update-index --again

#       run: bundle exec rubocop --force-exclusion -- {all_files}
#
#     - name: govet
#       files: git ls-files -m
#       glob: "*.go"
#       run: go vet -- {files}
#
#     - script: "hello.js"
#       runner: node
#
#     - script: "hello.go"
#       runner: go run
```

### package.json

```json
{
  "name": "@krizic/static-docs",
  "version": "0.1.4",
  "description": "Turn Markdown into a static documentation site.",
  "type": "module",
  "license": "MIT",
  "author": "Vedran Krizic",
  "homepage": "https://github.com/krizic/static-docs#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/krizic/static-docs.git"
  },
  "bugs": {
    "url": "https://github.com/krizic/static-docs/issues"
  },
  "keywords": [
    "markdown",
    "documentation",
    "static-site",
    "docs",
    "ssg",
    "mermaid",
    "cli"
  ],
  "engines": {
    "node": ">=18"
  },
  "packageManager": "pnpm@11.15.1",
  "bin": {
    "static-docs": "./dist/cli.js"
  },
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "src/themes",
    "schema.json",
    "assets",
    "LLM.md"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsup && tsc --emitDeclarationOnly --declaration",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "schema": "node dist/cli.js schema",
    "docs": "node dist/cli.js build",
    "llm": "repo-context --out LLM.md",
    "prepare": "lefthook install",
    "prepublishOnly": "pnpm run build && pnpm run llm"
  },
  "dependencies": {
    "@tailwindcss/cli": "^4.3.3",
    "@tailwindcss/typography": "^0.5.20",
    "cac": "^7.0.0",
    "chokidar": "^4.0.3",
    "fast-glob": "^3.3.3",
    "gray-matter": "^4.0.3",
    "hast-util-to-string": "^3.0.1",
    "mermaid": "^11.16.0",
    "rehype-autolink-headings": "^7.1.0",
    "rehype-pretty-code": "^0.14.5",
    "rehype-slug": "^6.0.0",
    "rehype-stringify": "^10.0.1",
    "remark-frontmatter": "^5.0.0",
    "remark-gfm": "^4.0.1",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.2",
    "remark-smartypants": "^3.0.3",
    "shiki": "^4.3.1",
    "tailwindcss": "^4.3.3",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.1.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.13",
    "@krizic/repo-context": "^0.1.1",
    "@types/hast": "^3.0.4",
    "@types/node": "^22.0.0",
    "lefthook": "^2.1.14",
    "tsup": "^8.5.1",
    "typescript": "^7.0.0",
    "vitest": "^5.0.1"
  }
}
```

### pnpm-workspace.yaml

```yaml
allowBuilds:
  '@parcel/watcher': true
  esbuild: true
  lefthook: true
onlyBuiltDependencies:
  - esbuild
  - "@parcel/watcher"
```

### README.md

```markdown
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
```

### schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "$schema": {
      "type": "string"
    },
    "siteName": {
      "default": "Documentation",
      "type": "string"
    },
    "outputDir": {
      "default": "./docs-build",
      "type": "string"
    },
    "basePath": {
      "default": "/",
      "type": "string"
    },
    "version": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "object",
          "properties": {
            "file": {
              "type": "string"
            },
            "field": {
              "default": "version",
              "type": "string"
            }
          },
          "required": [
            "file",
            "field"
          ],
          "additionalProperties": false
        }
      ]
    },
    "exclude": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "theme": {
      "default": "default",
      "type": "string",
      "enum": [
        "default",
        "minimal"
      ]
    },
    "customCss": {
      "type": "string"
    },
    "routes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "source": {
            "type": "string"
          },
          "meta": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          }
        },
        "required": [
          "path",
          "source"
        ],
        "additionalProperties": false
      }
    },
    "componentRoutes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "tag": {
            "type": "string"
          },
          "script": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "navCategory": {
            "type": "string"
          },
          "navOrder": {
            "type": "number"
          },
          "hidden": {
            "default": false,
            "type": "boolean"
          }
        },
        "required": [
          "path",
          "tag",
          "script",
          "hidden"
        ],
        "additionalProperties": false
      }
    },
    "evidenceGalleries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "navCategory": {
            "type": "string"
          },
          "navOrder": {
            "type": "number"
          },
          "hidden": {
            "default": false,
            "type": "boolean"
          }
        },
        "required": [
          "source",
          "path",
          "hidden"
        ],
        "additionalProperties": false
      }
    },
    "sidebar": {
      "default": {
        "auto": true,
        "collapsedDepth": 1,
        "exclude": []
      },
      "type": "object",
      "properties": {
        "auto": {
          "default": true,
          "type": "boolean"
        },
        "collapsedDepth": {
          "default": 1,
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        "exclude": {
          "default": [],
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "auto",
        "collapsedDepth",
        "exclude"
      ],
      "additionalProperties": false
    },
    "toc": {
      "default": {
        "enabled": true,
        "minDepth": 2,
        "maxDepth": 4
      },
      "type": "object",
      "properties": {
        "enabled": {
          "default": true,
          "type": "boolean"
        },
        "minDepth": {
          "default": 2,
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        "maxDepth": {
          "default": 4,
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        }
      },
      "required": [
        "enabled",
        "minDepth",
        "maxDepth"
      ],
      "additionalProperties": false
    },
    "markdown": {
      "default": {
        "gfm": true,
        "smartypants": true,
        "shikiTheme": "github-dark"
      },
      "type": "object",
      "properties": {
        "gfm": {
          "default": true,
          "type": "boolean"
        },
        "smartypants": {
          "default": true,
          "type": "boolean"
        },
        "shikiTheme": {
          "default": "github-dark",
          "type": "string"
        }
      },
      "required": [
        "gfm",
        "smartypants",
        "shikiTheme"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "siteName",
    "outputDir",
    "basePath",
    "exclude",
    "theme",
    "sidebar",
    "toc",
    "markdown"
  ],
  "additionalProperties": false
}
```

### scripts/next-version.mjs

```javascript
#!/usr/bin/env node
/**
 * Resolve the next version to publish.
 *
 *   node scripts/next-version.mjs <publishedVersion|none> <localVersion>
 *
 * The npm registry is the source of truth: the next version is normally the
 * published version with its patch incremented. If the local package.json has
 * been manually raised higher than that (a deliberate minor or major release),
 * the local version wins instead.
 */

/** Parse "1.2.3" into [1, 2, 3]. Returns null when malformed. */
function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Numeric semver ordering: negative when a < b, positive when a > b. */
function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function main(argv) {
  const [publishedRaw, localRaw] = argv;
  if (!publishedRaw || !localRaw) {
    throw new Error("usage: next-version.mjs <published|none> <local>");
  }

  const local = parse(localRaw);
  if (!local) throw new Error(`invalid local version: ${localRaw}`);

  // Never published yet: ship the local version untouched.
  if (publishedRaw.trim() === "none") return localRaw.trim();

  const published = parse(publishedRaw);
  if (!published) throw new Error(`invalid published version: ${publishedRaw}`);

  const candidate = [published[0], published[1], published[2] + 1];
  return compare(local, candidate) > 0 ? localRaw.trim() : candidate.join(".");
}

try {
  process.stdout.write(main(process.argv.slice(2)));
} catch (err) {
  process.stderr.write(`[next-version] ${err.message}\n`);
  process.exit(1);
}
```

### src/assets.ts

```typescript
import { createRequire } from "node:module";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import { GALLERY_JS, GALLERY_JS_FILENAME } from "./evidence/client-script.js";
import { GALLERY_CSS, GALLERY_CSS_FILENAME } from "./evidence/styles.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists, outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

const require = createRequire(import.meta.url);

/** Copy assets referenced by each page next to its emitted index.html. */
export async function copyAssets(
  items: { file: FileNode; parsed: ParsedMarkdown }[],
  config: ResolvedConfig,
): Promise<void> {
  for (const { file, parsed } of items) {
    const srcDir = path.dirname(file.sourcePath);
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    for (const rel of parsed.assets) {
      const [clean] = rel.split(/[?#]/);
      const srcAbs = path.resolve(srcDir, clean);
      if (!(await exists(srcAbs))) {
        console.warn(`[static-docs] missing asset: ${clean} (from ${file.relativePath})`);
        continue;
      }
      const destAbs = path.resolve(outDir, clean);
      await copyFileEnsured(srcAbs, destAbs);
    }
  }
}

/**
 * Copy the self-contained mermaid runtime bundle into `<output>/assets/`.
 * Called once per build when at least one page contains a mermaid diagram.
 */
export async function copyMermaidRuntime(config: ResolvedConfig): Promise<void> {
  const src = require.resolve("mermaid/dist/mermaid.min.js");
  const dest = path.join(config.outputDirAbs, "assets", "mermaid.min.js");
  await copyFileEnsured(src, dest);
}

/** Copy each component route's bundle next to that route's index.html. */
export async function copyComponentScripts(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.component) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    await copyFileEnsured(
      file.component.scriptSourceAbs,
      path.join(outDir, file.component.scriptFileName),
    );
  }
}

/** Copy every image referenced by each gallery's manifest next to its index.html. */
export async function copyEvidenceAssets(files: FileNode[], config: ResolvedConfig): Promise<void> {
  for (const file of files) {
    if (!file.evidence) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    const seen = new Set<string>();
    for (const entry of file.evidence.manifest.evidence) {
      for (const shot of Object.values(entry.browsers)) {
        if (seen.has(shot.file)) continue;
        seen.add(shot.file);
        const srcAbs = path.resolve(file.evidence.sourceDirAbs, shot.file);
        if (!(await exists(srcAbs))) {
          console.warn(
            `[static-docs] missing evidence image: ${shot.file} (gallery ${file.routePath})`,
          );
          continue;
        }
        await copyFileEnsured(srcAbs, path.join(outDir, shot.file));
      }
    }
  }
}

/** Emit the gallery client JS and CSS next to each gallery route's index.html. */
export async function copyEvidenceRuntime(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.evidence) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    await outputFile(path.join(outDir, GALLERY_JS_FILENAME), GALLERY_JS);
    await outputFile(path.join(outDir, GALLERY_CSS_FILENAME), GALLERY_CSS);
  }
}
```

### src/builder.ts

```typescript
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  copyAssets,
  copyComponentScripts,
  copyEvidenceAssets,
  copyEvidenceRuntime,
  copyMermaidRuntime,
} from "./assets.js";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { renderEvidencePage } from "./evidence/render.js";
import { buildNavTree } from "./nav.js";
import { parseMarkdown } from "./parser/index.js";
import { renderComponentPage, renderPage } from "./renderer/page.js";
import { resolveRoutes } from "./router.js";
import { compileTheme } from "./theme.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

export interface BuildResult {
  config: ResolvedConfig;
  pages: number;
}

export async function build(configPath = "static-docs.config.json"): Promise<BuildResult> {
  const config = await loadConfig(configPath);
  const files = await resolveRoutes(config);
  if (files.length === 0) {
    console.warn("[static-docs] no markdown files found.");
  }
  const navTree = buildNavTree(files);

  await rm(config.outputDirAbs, { recursive: true, force: true });

  const assetVersion = Date.now().toString(36);
  const rendered: { file: FileNode; parsed: ParsedMarkdown }[] = [];
  for (const file of files) {
    const outPath = path.join(config.outputDirAbs, outFileFor(file.routePath));
    if (file.evidence) {
      await outputFile(outPath, await renderEvidencePage({ file, navTree, config, assetVersion }));
      continue;
    }
    if (file.component) {
      await outputFile(outPath, renderComponentPage({ file, navTree, config, assetVersion }));
      continue;
    }
    const parsed = await parseMarkdown(file, config);
    const html = renderPage({ file, parsed, navTree, config, assetVersion });
    await outputFile(outPath, html);
    rendered.push({ file, parsed });
  }

  await copyAssets(rendered, config);
  await copyComponentScripts(files, config);
  await copyEvidenceAssets(files, config);
  await copyEvidenceRuntime(files, config);
  if (rendered.some((r) => r.parsed.hasMermaid)) {
    await copyMermaidRuntime(config);
  }
  await compileTheme(config);

  console.log(`[static-docs] built ${files.length} page(s) → ${config.outputDir}`);
  return { config, pages: files.length };
}
```

### src/cli.ts

```typescript
#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { cac } from "cac";
import { build } from "./builder.js";
import { toJsonSchema } from "./config.js";
import { dev } from "./dev.js";

const cli = cac("static-docs");

cli
  .command("build", "Build the static docs site")
  .option("--config <path>", "Path to config file", {
    default: "static-docs.config.json",
  })
  .action(async (options: { config: string }) => {
    try {
      await build(options.config);
    } catch (err) {
      console.error(`[static-docs] ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli
  .command("dev", "Start the dev server with live reload")
  .option("--config <path>", "Path to config file", {
    default: "static-docs.config.json",
  })
  .option("--port <port>", "Port", { default: 4321 })
  .action(async (options: { config: string; port: number }) => {
    try {
      await dev(options.config, Number(options.port));
    } catch (err) {
      console.error(`[static-docs] ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli
  .command("schema", "Write JSON Schema for the config to schema.json")
  .option("--out <path>", "Output path", { default: "schema.json" })
  .action(async (options: { out: string }) => {
    await writeFile(options.out, JSON.stringify(toJsonSchema(), null, 2));
    console.log(`[static-docs] wrote ${options.out}`);
  });

cli.help();
cli.version(__PKG_VERSION__);
cli.parse();
```

### src/config.ts

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const RouteSchema = z.object({
  path: z.string(),
  source: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * A custom element tag must contain a hyphen, start with an ASCII letter, and
 * contain no whitespace or HTML-significant characters. The hyphen rule is the
 * HTML spec requirement; the character restrictions also stop a config value
 * from breaking out of the tag it is interpolated into.
 */
export function isValidCustomElementTag(tag: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag);
}

export const ComponentRouteSchema = z.object({
  path: z.string(),
  tag: z.string().refine(isValidCustomElementTag, {
    message:
      'must be a valid custom element name: lowercase, containing a hyphen (e.g. "my-workbench")',
  }),
  script: z.string(),
  title: z.string().optional(),
  navCategory: z.string().optional(),
  navOrder: z.number().optional(),
  hidden: z.boolean().default(false),
});

export type ComponentRoute = z.infer<typeof ComponentRouteSchema>;

export const EvidenceGallerySchema = z.object({
  source: z.string(),
  path: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  navCategory: z.string().optional(),
  navOrder: z.number().optional(),
  hidden: z.boolean().default(false),
});

export type EvidenceGallery = z.infer<typeof EvidenceGallerySchema>;

export const VersionSchema = z.union([
  z.string(),
  z.object({
    file: z.string(),
    field: z.string().default("version"),
  }),
]);

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  siteName: z.string().default("Documentation"),
  outputDir: z.string().default("./docs-build"),
  basePath: z.string().default("/"),
  version: VersionSchema.optional(),
  exclude: z.array(z.string()).default([]),
  theme: z.enum(["default", "minimal"]).default("default"),
  customCss: z.string().optional(),
  routes: z.array(RouteSchema).optional(),
  componentRoutes: z.array(ComponentRouteSchema).optional(),
  evidenceGalleries: z.array(EvidenceGallerySchema).optional(),
  sidebar: z
    .object({
      auto: z.boolean().default(true),
      collapsedDepth: z.number().int().default(1),
      exclude: z.array(z.string()).default([]),
    })
    .default({ auto: true, collapsedDepth: 1, exclude: [] }),
  toc: z
    .object({
      enabled: z.boolean().default(true),
      minDepth: z.number().int().default(2),
      maxDepth: z.number().int().default(4),
    })
    .default({ enabled: true, minDepth: 2, maxDepth: 4 }),
  markdown: z
    .object({
      gfm: z.boolean().default(true),
      smartypants: z.boolean().default(true),
      shikiTheme: z.string().default("github-dark"),
    })
    .default({ gfm: true, smartypants: true, shikiTheme: "github-dark" }),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ResolvedConfig extends Config {
  rootDir: string; // dir containing the config file
  outputDirAbs: string; // absolute output dir
  versionString?: string; // resolved documentation version, if any
}

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const abs = path.resolve(configPath);
  const rootDir = path.dirname(abs);
  let raw: unknown = {};
  try {
    raw = JSON.parse(await readFile(abs, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Config not found: ${abs}`);
    }
    throw new Error(`Failed to parse config ${abs}: ${(err as Error).message}`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${msg}`);
  }
  const cfg = parsed.data;
  return {
    ...cfg,
    rootDir,
    outputDirAbs: path.resolve(rootDir, cfg.outputDir),
    versionString: await resolveVersion(cfg.version, rootDir),
  };
}

async function resolveVersion(
  version: Config["version"],
  rootDir: string,
): Promise<string | undefined> {
  if (version === undefined) return undefined;
  if (typeof version === "string") {
    const v = version.trim();
    return v || undefined;
  }
  const fileAbs = path.resolve(rootDir, version.file);
  try {
    const data = JSON.parse(await readFile(fileAbs, "utf8"));
    const value = data?.[version.field];
    if (typeof value === "string" && value.trim()) return value.trim();
    console.warn(
      `[static-docs] version: field "${version.field}" not found or not a string in ${version.file}`,
    );
    return undefined;
  } catch {
    console.warn(`[static-docs] version: could not read ${version.file}`);
    return undefined;
  }
}

export function toJsonSchema(): unknown {
  return z.toJSONSchema(ConfigSchema);
}
```

### src/dev.ts

```typescript
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import chokidar from "chokidar";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { exists } from "./utils/fs.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

const RELOAD_SNIPPET = `<script>
(function(){var s=new EventSource("/__reload");s.onmessage=function(){location.reload()};})();
</script>`;

export async function dev(configPath = "static-docs.config.json", port = 4321): Promise<void> {
  const config = await loadConfig(configPath);
  const outDir = config.outputDirAbs;
  const clients = new Set<http.ServerResponse>();

  async function rebuild() {
    try {
      await build(configPath);
    } catch (err) {
      console.error("[static-docs] build error:", (err as Error).message);
    }
  }
  await rebuild();

  const server = http.createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/__reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    let filePath = path.join(outDir, decodeURIComponent(url));
    if (url.endsWith("/")) filePath = path.join(filePath, "index.html");
    if (!(await exists(filePath))) {
      const withIndex = path.join(filePath, "index.html");
      if (await exists(withIndex)) filePath = withIndex;
    }
    if (!(await exists(filePath))) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    let body: Buffer | string = await readFile(filePath);
    if (ext === ".html") {
      body = body.toString("utf8").replace("</body>", `${RELOAD_SNIPPET}</body>`);
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  });

  server.listen(port, () => {
    console.log(`[static-docs] dev server → http://localhost:${port}`);
  });

  const watchTargets = ["**/*.md", path.basename(configPath)];
  if (config.customCss) watchTargets.push(config.customCss);
  for (const r of config.componentRoutes ?? []) {
    watchTargets.push(r.script);
  }
  for (const g of config.evidenceGalleries ?? []) {
    watchTargets.push(path.join(g.source, "**/*"));
  }
  const watcher = chokidar.watch(watchTargets, {
    cwd: config.rootDir,
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "**/docs-build/**", "**/.git/**"],
  });
  watcher.on("all", async () => {
    await rebuild();
    for (const res of clients) res.write("data: reload\n\n");
  });
}
```

### src/evidence/client-script.ts

```typescript
export const GALLERY_JS_FILENAME = "evidence-gallery.js";

/**
 * Client runtime for evidence gallery pages. Plain script (no modules) so it
 * works when opened from file:// as well. Contract: see render.ts for the
 * data-ev-* attributes this script drives.
 */
export const GALLERY_JS = `(function () {
  "use strict";

  function currentId() {
    return decodeURIComponent(location.hash.replace(/^#/, ""));
  }

  function modalFor(id) {
    if (!id) return null;
    return document.querySelector('.ev-modal[data-ev-id="' + CSS.escape(id) + '"]');
  }

  function syncFromHash() {
    var id = currentId();
    var anyOpen = false;
    document.querySelectorAll(".ev-modal").forEach(function (m) {
      var open = m.getAttribute("data-ev-id") === id;
      m.toggleAttribute("hidden", !open);
      if (open) anyOpen = true;
    });
    document.body.classList.toggle("ev-locked", anyOpen);
  }

  function closeModals() {
    document.querySelectorAll(".ev-modal").forEach(function (m) {
      m.setAttribute("hidden", "");
    });
    document.body.classList.remove("ev-locked");
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function switchBrowser(tab) {
    var modal = tab.closest(".ev-modal");
    if (!modal) return;
    modal.querySelectorAll(".ev-tab").forEach(function (t) {
      t.classList.toggle("is-active", t === tab);
    });
    var shot = modal.querySelector(".ev-modal-shot");
    if (!shot) return;
    var img = shot.querySelector("img");
    var file = tab.getAttribute("data-ev-browser");
    var missing = tab.getAttribute("data-ev-missing") === "1";
    if (img) {
      if (missing) {
        shot.innerHTML = '<div class="ev-missing">Screenshot missing: ' + file + "</div>";
      } else {
        img.setAttribute("src", file);
      }
    } else if (!missing) {
      shot.innerHTML = "<img src=\\"" + file + "\\" alt=\\"\\">";
    }
  }

  function applyFilter(btn) {
    var value = btn.getAttribute("data-ev-filter");
    document.querySelectorAll(".ev-filter").forEach(function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    document.querySelectorAll(".ev-card").forEach(function (card) {
      var status = card.getAttribute("data-status");
      card.toggleAttribute("hidden", value !== "all" && status !== value);
    });
  }

  function copyPermalink(btn) {
    var id = btn.getAttribute("data-ev-copy");
    var url = location.origin + location.pathname + "#" + encodeURIComponent(id);
    var done = function () {
      var prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = prev; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    var opener = t.closest("[data-ev-open]");
    if (opener) {
      location.hash = encodeURIComponent(opener.getAttribute("data-ev-open"));
      return;
    }
    if (t.closest("[data-ev-close]")) { closeModals(); return; }
    var tab = t.closest(".ev-tab");
    if (tab) { switchBrowser(tab); return; }
    var filter = t.closest(".ev-filter");
    if (filter) { applyFilter(filter); return; }
    var copy = t.closest("[data-ev-copy]");
    if (copy) { copyPermalink(copy); }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeModals();
  });

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash();
})();
`;
```

### src/evidence/manifest.ts

```typescript
import { readFile } from "node:fs/promises";
import { z } from "zod";

export const BrowserShotSchema = z.object({
  file: z.string().min(1),
  status: z.enum(["passed", "failed"]),
});

export const EvidenceEntrySchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  shows: z.string().min(1),
  proves: z.string().min(1),
  spec: z.string().optional(),
  test: z.string().optional(),
  status: z.enum(["passed", "failed"]),
  browsers: z.record(z.string(), BrowserShotSchema),
});

export const EvidenceManifestSchema = z.looseObject({
  generatedAt: z.string().min(1),
  evidence: z.array(EvidenceEntrySchema),
});

export type BrowserShot = z.infer<typeof BrowserShotSchema>;
export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;
export type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;

/** Load and validate an evidence manifest; throws with actionable messages. */
export async function loadEvidenceManifest(manifestPath: string): Promise<EvidenceManifest> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Evidence manifest not found: ${manifestPath}`);
    }
    throw new Error(`Failed to parse evidence manifest ${manifestPath}: ${(err as Error).message}`);
  }
  const parsed = EvidenceManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid evidence manifest ${manifestPath}:\n${msg}`);
  }
  const seen = new Set<string>();
  for (const entry of parsed.data.evidence) {
    if (seen.has(entry.id)) {
      throw new Error(
        `Invalid evidence manifest ${manifestPath}: duplicate evidence id "${entry.id}"`,
      );
    }
    seen.add(entry.id);
  }
  return parsed.data;
}
```

### src/evidence/render.ts

```typescript
import path from "node:path";
import type { ResolvedConfig } from "../config.js";
import { htmlShell } from "../renderer/layout.js";
import { renderSidebar } from "../renderer/sidebar.js";
import type { FileNode, NavNode } from "../types.js";
import { exists } from "../utils/fs.js";
import { withBase } from "../utils/path.js";
import { GALLERY_JS_FILENAME } from "./client-script.js";
import type { EvidenceEntry, EvidenceManifest } from "./manifest.js";
import { GALLERY_CSS_FILENAME } from "./styles.js";

export interface EvidencePageContext {
  file: FileNode;
  navTree: NavNode[];
  config: ResolvedConfig;
  assetVersion?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstShotFile(entry: EvidenceEntry): string | undefined {
  return Object.values(entry.browsers)[0]?.file;
}

async function missingImages(
  sourceDirAbs: string,
  manifest: EvidenceManifest,
): Promise<Set<string>> {
  const files = new Set<string>();
  for (const entry of manifest.evidence) {
    for (const shot of Object.values(entry.browsers)) files.add(shot.file);
  }
  const missing = new Set<string>();
  for (const f of files) {
    if (!(await exists(path.join(sourceDirAbs, f)))) missing.add(f);
  }
  return missing;
}

function badge(status: "passed" | "failed"): string {
  return `<span class="ev-badge ev-badge-${status}">${status}</span>`;
}

function thumbHtml(file: string | undefined, missing: Set<string>, title: string): string {
  if (file && !missing.has(file)) {
    return `<img src="${esc(file)}" alt="${esc(title)}" loading="lazy">`;
  }
  const label = file ? `Screenshot missing: ${esc(file)}` : "No screenshot";
  return `<div class="ev-missing">${label}</div>`;
}

function cardHtml(entry: EvidenceEntry, missing: Set<string>): string {
  return `<button type="button" class="ev-card" data-ev-open="${esc(entry.id)}" data-status="${entry.status}">
  <div class="ev-thumb">${thumbHtml(firstShotFile(entry), missing, entry.title)}</div>
  <div class="ev-card-body">
    <p class="ev-card-title">${esc(entry.title)}</p>
    ${badge(entry.status)}
    <p class="ev-card-shows">${esc(entry.shows)}</p>
  </div>
</button>`;
}

function modalHtml(entry: EvidenceEntry, missing: Set<string>): string {
  const tabs = Object.entries(entry.browsers)
    .map(([name, shot], i) => {
      const miss = missing.has(shot.file) ? ' data-ev-missing="1"' : "";
      return `<button type="button" class="ev-tab${i === 0 ? " is-active" : ""}" data-ev-browser="${esc(shot.file)}"${miss}>${esc(name)} ${badge(shot.status)}</button>`;
    })
    .join("\n    ");
  const refs = [
    entry.spec ? `<dt>Spec</dt><dd><code>${esc(entry.spec)}</code></dd>` : "",
    entry.test ? `<dt>Test</dt><dd>${esc(entry.test)}</dd>` : "",
  ].join("\n    ");
  return `<div class="ev-modal" data-ev-id="${esc(entry.id)}" hidden>
  <button type="button" class="ev-modal-backdrop" data-ev-close aria-label="Close"></button>
  <div class="ev-modal-panel" role="dialog" aria-modal="true" aria-label="${esc(entry.title)}">
    <div class="ev-modal-head">
      <h2 class="ev-modal-title">${esc(entry.title)}</h2>
      <button type="button" class="ev-modal-close" data-ev-close aria-label="Close">&times;</button>
    </div>
    ${badge(entry.status)}
    <div class="ev-tabs">
    ${tabs}
    </div>
    <div class="ev-modal-shot">${thumbHtml(firstShotFile(entry), missing, entry.title)}</div>
    <dl class="ev-prose">
    <dt>Shows</dt><dd>${esc(entry.shows)}</dd>
    <dt>Proves</dt><dd>${esc(entry.proves)}</dd>
    ${refs}
    </dl>
    <div class="ev-modal-actions">
      <button type="button" class="ev-copy" data-ev-copy="${esc(entry.id)}">Copy permalink</button>
    </div>
  </div>
</div>`;
}

/** Render an evidence-gallery route as a full HTML page. */
export async function renderEvidencePage(ctx: EvidencePageContext): Promise<string> {
  const { file, navTree, config, assetVersion } = ctx;
  const spec = file.evidence;
  if (!spec) {
    throw new Error(`renderEvidencePage: ${file.routePath} has no evidence spec`);
  }

  const missing = await missingImages(spec.sourceDirAbs, spec.manifest);
  const entries = spec.manifest.evidence;
  const passed = entries.filter((e) => e.status === "passed").length;
  const failed = entries.length - passed;

  const contentHtml = `<div class="ev-gallery">
<p class="ev-summary"><strong>${entries.length}</strong> evidence &middot; <strong>${passed}</strong> passed &middot; <strong>${failed}</strong> failed &middot; generated <time datetime="${esc(spec.manifest.generatedAt)}">${esc(spec.manifest.generatedAt)}</time></p>
<div class="ev-filters">
  <button type="button" class="ev-filter is-active" data-ev-filter="all">All</button>
  <button type="button" class="ev-filter" data-ev-filter="passed">Passed</button>
  <button type="button" class="ev-filter" data-ev-filter="failed">Failed</button>
</div>
<div class="ev-grid">
${entries.map((e) => cardHtml(e, missing)).join("\n")}
</div>
${entries.map((e) => modalHtml(e, missing)).join("\n")}
</div>`;

  const v = assetVersion ? `?v=${assetVersion}` : "";
  const routeBase = withBase(file.routePath, config.basePath);

  return htmlShell({
    title: String(file.frontmatter.title ?? config.siteName),
    siteName: config.siteName,
    description: file.frontmatter.description ? String(file.frontmatter.description) : undefined,
    basePath: config.basePath,
    contentHtml,
    sidebarHtml: renderSidebar(navTree, file.routePath, config.basePath),
    tocHtml: "",
    showToc: false,
    assetVersion,
    version: config.versionString,
    fullBleed: true,
    headExtra: `<link rel="stylesheet" href="${esc(`${routeBase}/${GALLERY_CSS_FILENAME}`)}${v}">`,
    bodyScript: `<script src="${esc(`${routeBase}/${GALLERY_JS_FILENAME}`)}${v}" defer></script>`,
  });
}
```

### src/evidence/styles.ts

```typescript
export const GALLERY_CSS_FILENAME = "evidence-gallery.css";

/** Standalone gallery styles (ev-* classes), independent of the Tailwind theme. */
export const GALLERY_CSS = `.ev-gallery { font-family: inherit; }
.ev-summary { display: flex; flex-wrap: wrap; gap: 1rem; align-items: baseline; margin-bottom: 1rem; color: #475569; }
.ev-summary strong { color: #0f172a; }
.ev-filters { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.ev-filter { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9999px; padding: 0.25rem 0.9rem; font-size: 0.85rem; cursor: pointer; }
.ev-filter.is-active { background: #0f172a; color: #fff; border-color: #0f172a; }
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.ev-card { text-align: left; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #fff; padding: 0; cursor: pointer; overflow: hidden; transition: box-shadow 0.15s; }
.ev-card:hover { box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12); }
.ev-thumb { aspect-ratio: 16 / 10; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ev-thumb img { width: 100%; height: 100%; object-fit: cover; }
.ev-card-body { padding: 0.75rem 0.9rem; }
.ev-card-title { font-weight: 600; color: #0f172a; margin: 0 0 0.25rem; font-size: 0.95rem; }
.ev-card-shows { color: #64748b; font-size: 0.8rem; margin: 0.35rem 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ev-badge { display: inline-block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 9999px; padding: 0.1rem 0.55rem; }
.ev-badge-passed { background: #dcfce7; color: #166534; }
.ev-badge-failed { background: #fee2e2; color: #991b1b; }
.ev-missing { color: #b91c1c; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 0.375rem; padding: 2rem 1rem; text-align: center; font-size: 0.85rem; width: 100%; }
.ev-modal { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.ev-modal[hidden] { display: none; }
.ev-modal-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.6); border: 0; padding: 0; cursor: pointer; }
.ev-modal-panel { position: relative; background: #fff; border-radius: 0.75rem; max-width: 960px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem 1.75rem; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3); }
.ev-modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
.ev-modal-title { margin: 0; font-size: 1.25rem; color: #0f172a; }
.ev-modal-close { border: 0; background: transparent; font-size: 1.4rem; line-height: 1; cursor: pointer; color: #64748b; }
.ev-modal-close:hover { color: #0f172a; }
.ev-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.ev-tab { border: 1px solid #cbd5e1; background: #fff; border-radius: 0.375rem; padding: 0.3rem 0.7rem; font-size: 0.8rem; cursor: pointer; display: inline-flex; gap: 0.4rem; align-items: center; }
.ev-tab.is-active { border-color: #0f172a; box-shadow: inset 0 0 0 1px #0f172a; }
.ev-modal-shot img { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.375rem; }
.ev-prose dt { font-weight: 600; color: #0f172a; margin-top: 0.9rem; font-size: 0.85rem; }
.ev-prose dd { margin: 0.2rem 0 0; color: #334155; font-size: 0.9rem; }
.ev-prose code { background: #f1f5f9; border-radius: 0.25rem; padding: 0.1rem 0.35rem; font-size: 0.8rem; }
.ev-modal-actions { margin-top: 1.25rem; display: flex; justify-content: flex-end; }
.ev-copy { border: 1px solid #cbd5e1; background: #fff; border-radius: 0.375rem; padding: 0.4rem 0.9rem; font-size: 0.85rem; cursor: pointer; }
.ev-copy:hover { background: #f8fafc; }
body.ev-locked { overflow: hidden; }
`;
```

### src/globals.d.ts

```typescript
/** Replaced at build time by tsup with the version from package.json. */
declare const __PKG_VERSION__: string;
```

### src/index.ts

```typescript
export type { BuildResult } from "./builder.js";
export { build } from "./builder.js";
export type { Config, ResolvedConfig } from "./config.js";
export { ConfigSchema, loadConfig, toJsonSchema } from "./config.js";
export { resolveRoutes } from "./router.js";
export type {
  ComponentSpec,
  FileNode,
  Frontmatter,
  NavNode,
  ParsedMarkdown,
  TocEntry,
} from "./types.js";
export const version = __PKG_VERSION__;
```

### src/nav.ts

```typescript
import type { FileNode, NavNode } from "./types.js";

function titleFor(node: FileNode): string {
  if (node.frontmatter.title) return String(node.frontmatter.title);
  const segs = node.routePath.split("/").filter(Boolean);
  const last = segs[segs.length - 1] ?? "Home";
  return humanize(last);
}

function humanize(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderFor(file: FileNode): number {
  if (typeof file.frontmatter.navOrder === "number") {
    return file.frontmatter.navOrder;
  }
  return file.routePath === "/" ? -1 : 0;
}

/**
 * Build a directory-grouped nav tree.
 *
 * - `navCategory` frontmatter overrides directory grouping (flat category).
 * - A folder's index page (README/index, whose route equals the folder path)
 *   is merged into the folder node itself, so the folder header becomes the
 *   clickable link instead of appearing as a confusing duplicate sibling.
 */
export function buildNavTree(files: FileNode[]): NavNode[] {
  const root: NavNode = { title: "", order: 0, children: [] };
  const dirNodes = new Map<string, NavNode>(); // key: "packages/download-list"

  /** Ensure a chain of directory nodes exists; returns the deepest one. */
  function ensureDir(segs: string[]): NavNode {
    let cursor = root;
    let key = "";
    for (const seg of segs) {
      key = key ? `${key}/${seg}` : seg;
      let child = dirNodes.get(key);
      if (!child) {
        child = { title: humanize(seg), order: 0, children: [] };
        dirNodes.set(key, child);
        cursor.children.push(child);
      }
      cursor = child;
    }
    return cursor;
  }

  function ensureCategory(name: string): NavNode {
    let child = root.children.find(
      (c) => !c.routePath && c.title.toLowerCase() === name.toLowerCase(),
    );
    if (!child) {
      child = { title: name, order: 0, children: [] };
      root.children.push(child);
    }
    return child;
  }

  const visible = files.filter((f) => !f.frontmatter.hidden);

  // Pass 1: create every directory node so index detection works regardless
  // of the order files are processed in.
  for (const file of visible) {
    if (file.frontmatter.navCategory) continue;
    const segs = file.routePath.split("/").filter(Boolean);
    ensureDir(segs.slice(0, -1));
  }

  // Pass 2: place each file, merging folder-index pages into their folder node.
  for (const file of visible) {
    const segs = file.routePath.split("/").filter(Boolean);

    if (file.frontmatter.navCategory) {
      const cat = ensureCategory(String(file.frontmatter.navCategory));
      cat.children.push({
        title: titleFor(file),
        routePath: file.routePath,
        order: orderFor(file),
        children: [],
      });
      continue;
    }

    const key = segs.join("/");
    const dir = dirNodes.get(key);
    if (dir) {
      // This file is the index of an existing folder: make the folder clickable.
      dir.routePath = file.routePath;
      dir.order = orderFor(file);
      if (file.frontmatter.title) dir.title = String(file.frontmatter.title);
      continue;
    }

    ensureDir(segs.slice(0, -1)).children.push({
      title: titleFor(file),
      routePath: file.routePath,
      order: orderFor(file),
      children: [],
    });
  }

  sortTree(root);
  return root.children;
}

function sortTree(node: NavNode): void {
  node.children.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
  node.children.forEach(sortTree);
}
```

### src/parser/index.ts

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";
import type { ResolvedConfig } from "../config.js";
import type { FileNode, ParsedMarkdown, TocEntry } from "../types.js";
import { rehypeRewriteLinks } from "./links.js";
import { type MermaidState, rehypeMermaid } from "./mermaid.js";
import { extractMeta } from "./meta.js";
import { nestToc, rehypeCollectToc } from "./toc.js";

/** No-op unified plugin used to conditionally skip remark plugins. */
function noop() {
  return () => {};
}

export async function parseMarkdown(
  file: FileNode,
  config: ResolvedConfig,
): Promise<ParsedMarkdown> {
  const raw = await readFile(file.sourcePath, "utf8");
  const { data: frontmatter } = extractMeta(raw);

  const tocFlat: TocEntry[] = [];
  const assets: string[] = [];
  const mermaidState: MermaidState = { found: false };
  const currentRelDir = path.posix.dirname(file.relativePath);

  const gfm = config.markdown.gfm ? remarkGfm : noop;
  const smart = config.markdown.smartypants ? remarkSmartypants : noop;

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(gfm)
    .use(smart)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeMermaid, mermaidState)
    .use(rehypePrettyCode, {
      theme: config.markdown.shikiTheme as PrettyCodeOptions["theme"],
      keepBackground: true,
    })
    .use(rehypeCollectToc, {
      minDepth: config.toc.minDepth,
      maxDepth: config.toc.maxDepth,
      collect: tocFlat,
    })
    .use(rehypeRewriteLinks, {
      currentRelDir: currentRelDir === "." ? "" : currentRelDir,
      basePath: config.basePath,
      assets,
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const fileVal = await processor.process(raw);
  return {
    html: String(fileVal),
    toc: nestToc(tocFlat),
    frontmatter,
    assets,
    hasMermaid: mermaidState.found,
  };
}
```

### src/parser/links.ts

```typescript
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { resolveInternalLink } from "../utils/path.js";

export interface LinkOptions {
  currentRelDir: string; // posix dir of the current md file, relative to root
  basePath: string;
  assets: string[]; // collect referenced local asset paths
}

const EXTERNAL = /^([a-z]+:)?\/\//i;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|mp4|webm)$/i;

export function rehypeRewriteLinks(options: LinkOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href !== "string") return;
        if (EXTERNAL.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return;
        if (/\.md(#.*)?$/i.test(href) && node.properties) {
          node.properties.href = resolveInternalLink(href, options.currentRelDir, options.basePath);
        }
      } else if (node.tagName === "img") {
        const src = node.properties?.src;
        if (typeof src === "string" && !EXTERNAL.test(src) && ASSET_EXT.test(src)) {
          options.assets.push(src);
        }
      }
    });
  };
}
```

### src/parser/mermaid.ts

```typescript
import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

export interface MermaidState {
  found: boolean;
}

/**
 * Rewrites fenced ```mermaid code blocks into `<pre class="mermaid">…</pre>`
 * nodes that the client-side mermaid runtime renders into SVG.
 *
 * Must run BEFORE rehype-pretty-code so the diagram source is left as plain
 * text instead of being syntax-highlighted. Sets `state.found` when at least
 * one diagram is present, so the caller knows to inject the mermaid script.
 */
export function rehypeMermaid(state: MermaidState) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const code = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!code) return;
      const classes = code.properties?.className;
      const isMermaid = Array.isArray(classes) && classes.includes("language-mermaid");
      if (!isMermaid) return;

      const source = hastToString(code);
      state.found = true;
      node.properties = { className: ["mermaid"] };
      node.children = [{ type: "text", value: source }];
    });
  };
}
```

### src/parser/meta.ts

```typescript
import matter from "gray-matter";
import type { Frontmatter } from "../types.js";

export function extractMeta(raw: string): {
  content: string;
  data: Frontmatter;
} {
  const parsed = matter(raw);
  return { content: parsed.content, data: parsed.data as Frontmatter };
}
```

### src/parser/toc.ts

```typescript
import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";
import type { TocEntry } from "../types.js";

export interface TocOptions {
  minDepth: number;
  maxDepth: number;
  collect: TocEntry[]; // flat list, nested later
}

export function rehypeCollectToc(options: TocOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (!m) return;
      const depth = Number(m[1]);
      if (depth < options.minDepth || depth > options.maxDepth) return;
      const id = node.properties?.id;
      if (typeof id !== "string") return;
      options.collect.push({
        depth,
        text: hastToString(node),
        slug: id,
        children: [],
      });
    });
  };
}

/** Turn a flat, ordered heading list into a nested tree by depth. */
export function nestToc(flat: TocEntry[]): TocEntry[] {
  const roots: TocEntry[] = [];
  const stack: TocEntry[] = [];
  for (const entry of flat) {
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) {
      stack.pop();
    }
    if (stack.length === 0) roots.push(entry);
    else stack[stack.length - 1].children.push(entry);
    stack.push(entry);
  }
  return roots;
}
```

### src/renderer/layout.ts

```typescript
import { withBase } from "../utils/path.js";

export interface LayoutData {
  title: string;
  siteName: string;
  description?: string;
  basePath: string;
  contentHtml: string;
  sidebarHtml: string;
  tocHtml: string;
  showToc: boolean;
  assetVersion?: string;
  mermaid?: boolean;
  version?: string;
  fullBleed?: boolean; // content fills the main column instead of a prose article
  bodyScript?: string; // pre-rendered <script> tag appended before </body>
  headExtra?: string; // pre-rendered tags appended at the end of <head>
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prefix a "v" only when the value starts with a bare digit (e.g. 1.2.3). */
function formatVersion(v: string): string {
  return /^\d/.test(v) ? `v${v}` : v;
}

export function htmlShell(d: LayoutData): string {
  const base = d.basePath.endsWith("/") ? d.basePath : `${d.basePath}/`;
  const themeHref =
    withBase("theme.css", d.basePath) + (d.assetVersion ? `?v=${d.assetVersion}` : "");
  const meta = d.description ? `<meta name="description" content="${esc(d.description)}">` : "";
  const tocAside =
    d.showToc && d.tocHtml
      ? `<aside class="hidden lg:block w-64 shrink-0 pl-8 py-12"><div class="sticky top-20"><p class="toc-heading">On this page</p><nav class="toc">${d.tocHtml}</nav></div></aside>`
      : "";

  const mermaidSrc = withBase("assets/mermaid.min.js", d.basePath);
  const mermaidScript = d.mermaid
    ? `<script src="${mermaidSrc}${d.assetVersion ? `?v=${d.assetVersion}` : ""}"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: "default" });</script>`
    : "";

  const versionBadge = d.version
    ? `<span class="site-version">${esc(formatVersion(d.version))}</span>`
    : "";

  const mainClass = d.fullBleed
    ? "min-w-0 flex-1 flex flex-col px-6 py-6 md:px-8"
    : "min-w-0 flex-1 px-6 py-12 md:px-12";
  const mainInner = d.fullBleed
    ? d.contentHtml
    : `<article class="prose prose-slate max-w-none">${d.contentHtml}</article>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)} | ${esc(d.siteName)}</title>
${meta}
<link rel="stylesheet" href="${themeHref}">
${d.headExtra ?? ""}
</head>
<body class="bg-white text-slate-900 antialiased">
<header class="sticky top-0 z-50 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
  <details class="md:hidden">
    <summary class="cursor-pointer list-none select-none rounded p-2 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">&#9776;</summary>
    <div class="absolute left-0 top-full max-h-[80vh] w-72 overflow-y-auto border-b border-r border-slate-200 bg-white p-4 shadow-lg">
      <nav class="site-nav">${d.sidebarHtml}</nav>
    </div>
  </details>
  <a href="${base}" class="text-lg font-semibold tracking-tight">${esc(d.siteName)}</a>${versionBadge}
</header>
<div class="flex w-full">
  <aside class="hidden md:block w-72 shrink-0 border-r border-slate-200 px-4 py-12">
    <div class="sticky top-20"><nav class="site-nav">${d.sidebarHtml}</nav></div>
  </aside>
  <main class="${mainClass}">${mainInner}</main>
  ${tocAside}
</div>
${mermaidScript}
${d.bodyScript ?? ""}
</body>
</html>`;
}
```

### src/renderer/page.ts

```typescript
import type { ResolvedConfig } from "../config.js";
import type { FileNode, NavNode, ParsedMarkdown } from "../types.js";
import { withBase } from "../utils/path.js";
import { htmlShell } from "./layout.js";
import { renderSidebar } from "./sidebar.js";
import { renderToc } from "./toc-panel.js";

export interface PageContext {
  file: FileNode;
  parsed: ParsedMarkdown;
  navTree: NavNode[];
  config: ResolvedConfig;
  assetVersion?: string;
}

export function renderPage(ctx: PageContext): string {
  const { file, parsed, navTree, config } = ctx;
  const fm = parsed.frontmatter;
  const title =
    (fm.title && String(fm.title)) ||
    file.routePath.split("/").filter(Boolean).pop() ||
    config.siteName;
  const showToc = config.toc.enabled && fm.toc !== false && parsed.toc.length > 0;

  return htmlShell({
    title: String(title),
    siteName: config.siteName,
    description: fm.description ? String(fm.description) : undefined,
    basePath: config.basePath,
    contentHtml: parsed.html,
    sidebarHtml: renderSidebar(navTree, file.routePath, config.basePath),
    tocHtml: renderToc(parsed.toc),
    showToc,
    assetVersion: ctx.assetVersion,
    mermaid: parsed.hasMermaid,
    version: config.versionString,
  });
}

export interface ComponentPageContext {
  file: FileNode;
  navTree: NavNode[];
  config: ResolvedConfig;
  assetVersion?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a route that mounts a pre-built web component instead of Markdown. */
export function renderComponentPage(ctx: ComponentPageContext): string {
  const { file, navTree, config } = ctx;
  const spec = file.component;
  if (!spec) {
    throw new Error(`renderComponentPage: ${file.routePath} has no component`);
  }

  const title = String(file.frontmatter.title ?? config.siteName);
  // Base-path-absolute so it resolves correctly regardless of trailing slash on the route URL.
  const src =
    withBase(`${file.routePath}/${spec.scriptFileName}`, config.basePath) +
    (ctx.assetVersion ? `?v=${ctx.assetVersion}` : "");

  return htmlShell({
    title,
    siteName: config.siteName,
    description: file.frontmatter.description ? String(file.frontmatter.description) : undefined,
    basePath: config.basePath,
    contentHtml: `<div class="wb-host"><${spec.tag}></${spec.tag}></div>`,
    sidebarHtml: renderSidebar(navTree, file.routePath, config.basePath),
    tocHtml: "",
    showToc: false,
    assetVersion: ctx.assetVersion,
    version: config.versionString,
    fullBleed: true,
    bodyScript: `<script type="module" src="${esc(src)}"></script>`,
  });
}
```

### src/renderer/sidebar.ts

```typescript
import type { NavNode } from "../types.js";
import { withBase } from "../utils/path.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function href(routePath: string, basePath: string): string {
  const url = withBase(routePath, basePath);
  // Trailing slash so relative asset URLs on the target page resolve under the route directory.
  return url.endsWith("/") ? url : `${url}/`;
}

export function renderSidebar(nav: NavNode[], currentRoute: string, basePath: string): string {
  return `<ul class="nav-list">${nav
    .map((n) => renderNode(n, currentRoute, basePath, 0))
    .join("")}</ul>`;
}

function leaf(node: NavNode, current: string, basePath: string): string {
  const active = node.routePath === current ? " nav-item-active" : "";
  // Leaf nodes always carry a routePath; group headers are the only nodes without one.
  const target = node.routePath ?? "/";
  return `<li><a class="nav-item${active}" href="${href(
    target,
    basePath,
  )}">${esc(node.title)}</a></li>`;
}

function renderNode(node: NavNode, current: string, basePath: string, depth: number): string {
  const isGroup = node.children.length > 0;
  if (!isGroup) return leaf(node, current, basePath);

  const childHtml = node.children.map((c) => renderNode(c, current, basePath, depth + 1)).join("");
  const active = node.routePath === current ? " nav-item-active" : "";

  // Top-level sections keep the small-caps header.
  if (depth === 0) {
    const header = node.routePath
      ? `<a class="nav-section-title nav-section-link${active}" href="${href(
          node.routePath,
          basePath,
        )}">${esc(node.title)}</a>`
      : `<span class="nav-section-title">${esc(node.title)}</span>`;
    return `<li class="nav-section">${header}<ul class="nav-sublist">${childHtml}</ul></li>`;
  }

  // Nested folders render as an emphasized parent with a guided branch.
  const header = node.routePath
    ? `<a class="nav-item nav-parent${active}" href="${href(
        node.routePath,
        basePath,
      )}">${esc(node.title)}</a>`
    : `<span class="nav-parent-label">${esc(node.title)}</span>`;
  return `<li class="nav-tree">${header}<ul class="nav-branch">${childHtml}</ul></li>`;
}
```

### src/renderer/toc-panel.ts

```typescript
import type { TocEntry } from "../types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderToc(toc: TocEntry[]): string {
  if (toc.length === 0) return "";
  return `<ul class="toc-list">${toc.map(renderEntry).join("")}</ul>`;
}

function renderEntry(entry: TocEntry): string {
  const deep = entry.depth >= 4 ? " toc-link-deep" : "";
  const children = entry.children.length
    ? `<ul class="toc-sublist">${entry.children.map(renderEntry).join("")}</ul>`
    : "";
  return `<li><a class="toc-link${deep}" href="#${entry.slug}">${esc(
    entry.text,
  )}</a>${children}</li>`;
}
```

### src/router.ts

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import { loadEvidenceManifest } from "./evidence/manifest.js";
import { scanRepo } from "./scanner.js";
import type { FileNode, Frontmatter } from "./types.js";
import { exists } from "./utils/fs.js";
import { toRoutePath } from "./utils/path.js";

/** Build FileNodes from config routes and componentRoutes, else scan the repo. */
export async function resolveRoutes(config: ResolvedConfig): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  const seen = new Set<string>();

  const markdownNodes =
    config.routes && config.routes.length > 0
      ? await markdownRouteNodes(config)
      : await scanRepo(config);

  for (const node of markdownNodes) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  for (const node of await componentRouteNodes(config)) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  for (const node of await evidenceGalleryNodes(config)) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  return nodes;
}

function claim(seen: Set<string>, routePath: string): boolean {
  if (seen.has(routePath)) {
    console.warn(`[static-docs] duplicate route "${routePath}" ignored`);
    return false;
  }
  seen.add(routePath);
  return true;
}

async function markdownRouteNodes(config: ResolvedConfig): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.routes ?? []) {
    const sourcePath = path.resolve(config.rootDir, r.source);
    const relativePath = path.relative(config.rootDir, sourcePath).replace(/\\/g, "/");
    const fileFm = await readFrontmatter(sourcePath);
    const frontmatter: Frontmatter = { ...fileFm, ...(r.meta as Frontmatter) };
    nodes.push({
      sourcePath,
      relativePath,
      routePath: normalizeRoute(r.path),
      frontmatter,
    });
  }
  return nodes;
}

async function componentRouteNodes(config: ResolvedConfig): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.componentRoutes ?? []) {
    const routePath = normalizeRoute(r.path);
    const scriptSourceAbs = path.resolve(config.rootDir, r.script);
    if (!(await exists(scriptSourceAbs))) {
      throw new Error(`Component route "${routePath}": script not found: ${scriptSourceAbs}`);
    }
    nodes.push({
      sourcePath: "",
      relativePath: path.relative(config.rootDir, scriptSourceAbs).replace(/\\/g, "/"),
      routePath,
      frontmatter: {
        title: r.title ?? defaultTitle(routePath),
        navOrder: r.navOrder,
        navCategory: r.navCategory,
        hidden: r.hidden,
        toc: false,
      },
      component: {
        tag: r.tag,
        scriptSourceAbs,
        scriptFileName: path.basename(scriptSourceAbs),
      },
    });
  }
  return nodes;
}

async function evidenceGalleryNodes(config: ResolvedConfig): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const g of config.evidenceGalleries ?? []) {
    const routePath = normalizeRoute(g.path);
    const sourceDirAbs = path.resolve(config.rootDir, g.source);
    const manifest = await loadEvidenceManifest(path.join(sourceDirAbs, "manifest.json"));
    nodes.push({
      sourcePath: "",
      relativePath: `${path.relative(config.rootDir, sourceDirAbs).replace(/\\/g, "/")}/manifest.json`,
      routePath,
      frontmatter: {
        title: g.title ?? defaultTitle(routePath),
        description: g.description,
        navOrder: g.navOrder,
        navCategory: g.navCategory,
        hidden: g.hidden,
        toc: false,
      },
      evidence: { sourceDirAbs, manifest },
    });
  }
  return nodes;
}

function defaultTitle(routePath: string): string {
  const last = routePath.split("/").filter(Boolean).pop() ?? "Home";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRoute(p: string): string {
  const clean = p.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (clean === "" || clean === "/") return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

async function readFrontmatter(file: string): Promise<Frontmatter> {
  try {
    const raw = await readFile(file, "utf8");
    return matter(raw).data as Frontmatter;
  } catch {
    return {};
  }
}

export { toRoutePath };
```

### src/scanner.ts

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, Frontmatter } from "./types.js";
import { toRoutePath } from "./utils/path.js";

const DEFAULT_IGNORE = ["**/node_modules/**", "**/.git/**", "**/docs-build/**"];

export async function scanRepo(config: ResolvedConfig): Promise<FileNode[]> {
  const ignore = [...DEFAULT_IGNORE, ...config.exclude, ...config.sidebar.exclude];
  const entries = await fg("**/*.md", {
    cwd: config.rootDir,
    ignore,
    dot: false,
    onlyFiles: true,
  });
  const nodes: FileNode[] = [];
  const seen = new Map<string, string>();
  for (const rel of entries.sort()) {
    const sourcePath = path.join(config.rootDir, rel);
    const relativePath = rel.replace(/\\/g, "/");
    const fm = await readFrontmatter(sourcePath);
    const routePath = toRoutePath(relativePath);
    if (seen.has(routePath)) {
      console.warn(
        `[static-docs] route collision: "${routePath}" from ${seen.get(routePath)} and ${relativePath} (keeping first)`,
      );
      continue;
    }
    seen.set(routePath, relativePath);
    nodes.push({ sourcePath, relativePath, routePath, frontmatter: fm });
  }
  return nodes;
}

async function readFrontmatter(file: string): Promise<Frontmatter> {
  const raw = await readFile(file, "utf8");
  const { data } = matter(raw);
  return data as Frontmatter;
}
```

### src/theme.ts

```typescript
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedConfig } from "./config.js";
import { exists, outputFile } from "./utils/fs.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)); // dist/ at runtime

async function themeCssPath(theme: string): Promise<string> {
  // Search dist-relative and src-relative locations.
  const candidates = [
    path.resolve(here, "themes", theme, "theme.css"),
    path.resolve(here, "..", "src", "themes", theme, "theme.css"),
  ];
  for (const c of candidates) if (await exists(c)) return c;
  throw new Error(`Theme "${theme}" CSS not found. Looked in:\n${candidates.join("\n")}`);
}

function tailwindBin(): string {
  // @tailwindcss/cli exposes a bin; resolve its package then the bin path.
  const pkgJson = require.resolve("@tailwindcss/cli/package.json");
  const dir = path.dirname(pkgJson);
  const pkg = require("@tailwindcss/cli/package.json") as {
    bin?: Record<string, string> | string;
  };
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.tailwindcss;
  if (!rel) throw new Error("Cannot locate @tailwindcss/cli binary");
  return path.resolve(dir, rel);
}

export async function compileTheme(config: ResolvedConfig): Promise<void> {
  const themeCss = await themeCssPath(config.theme);
  const outDir = config.outputDirAbs;
  const entryPath = path.join(outDir, "_entry.css");
  const themeImport = JSON.stringify(themeCss.replace(/\\/g, "/"));
  const sourceGlob = JSON.stringify(path.join(outDir, "**/*.html").replace(/\\/g, "/"));

  let entry = `@import ${themeImport};\n@source ${sourceGlob};\n`;
  if (config.customCss) {
    const customAbs = path.resolve(config.rootDir, config.customCss);
    entry += `@import ${JSON.stringify(customAbs.replace(/\\/g, "/"))};\n`;
  }
  await outputFile(entryPath, entry);

  const outCss = path.join(outDir, "theme.css");
  await runTailwind(entryPath, outCss);
  await rm(entryPath, { force: true });
}

function runTailwind(input: string, output: string): Promise<void> {
  const bin = tailwindBin();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, "-i", input, "-o", output, "--minify"], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Tailwind CLI exited with code ${code}`)),
    );
  });
}
```

### src/themes/default/index.ts

```typescript
export const meta = { name: "default", description: "Clean Tailwind docs theme" };
```

### src/themes/default/theme.css

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-brand-500: #0ea5e9;
  --color-brand-600: #0284c7;
  --font-sans: "Inter", system-ui, sans-serif;
}

/* Site navigation */
.site-nav .nav-list,
.site-nav .nav-sublist,
.site-nav .nav-branch {
  list-style: none;
  margin: 0;
  padding: 0;
}
/* Top-level section headers (small-caps) */
.site-nav .nav-section-title {
  display: block;
  margin: 1.25rem 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-slate-500);
}
.site-nav .nav-section:first-child .nav-section-title {
  margin-top: 0;
}
.site-nav a.nav-section-link:hover {
  color: var(--color-slate-900);
}
/* Leaf and parent items */
.site-nav .nav-item {
  display: block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-slate-600);
  text-decoration: none;
}
.site-nav .nav-item:hover {
  background: var(--color-slate-100);
  color: var(--color-slate-900);
}
.site-nav .nav-item-active {
  background: var(--color-brand-500);
  color: #fff;
  font-weight: 600;
}
/* Nested folder: emphasized parent + guided branch */
.site-nav .nav-parent {
  font-weight: 600;
  color: var(--color-slate-700);
}
.site-nav .nav-parent-label {
  display: block;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-slate-500);
}
.site-nav .nav-branch {
  margin-left: 0.5rem;
  padding-left: 0.5rem;
  border-left: 1px solid var(--color-slate-200);
}

/* Right TOC panel */
.toc-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-slate-500);
  margin-bottom: 0.5rem;
}
.toc .toc-list,
.toc .toc-sublist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc .toc-sublist {
  margin-left: 0.75rem;
}
.toc .toc-link {
  display: block;
  padding: 0.15rem 0 0.15rem 0.5rem;
  font-size: 0.85rem;
  color: var(--color-slate-500);
  text-decoration: none;
  border-left: 2px solid transparent;
}
.toc .toc-link:hover {
  color: var(--color-brand-600);
  border-left-color: var(--color-brand-500);
}
.toc .toc-link-deep {
  font-size: 0.8rem;
  color: var(--color-slate-400);
}

/* Documentation version badge in the header */
.site-version {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 9999px;
  background: var(--color-slate-100);
  color: var(--color-slate-600);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

/* Headings link to themselves via rehype-autolink-headings (behavior: wrap) */
.prose :where(h1, h2, h3, h4, h5, h6) a {
  color: inherit;
  text-decoration: none;
}

/* Inline code: drop the typographic backticks, render as a subtle chip */
.prose :not(pre) > code::before,
.prose :not(pre) > code::after {
  content: "";
}
.prose :not(pre) > code {
  background: #f1f5f9;
  color: #0f172a;
  padding: 0.12em 0.35em;
  border-radius: 0.25rem;
  font-weight: 500;
  font-size: 0.85em;
}

/* Tables: bordered, filled header, zebra rows */
.prose table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e2e8f0;
  font-size: 0.875em;
  margin: 1.5rem 0;
}
.prose thead {
  background: #f1f5f9;
}
.prose thead th {
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #0f172a;
  border-bottom: 1px solid #cbd5e1;
}
.prose tbody td {
  padding: 0.5rem 0.75rem;
  vertical-align: top;
  border-top: 1px solid #e2e8f0;
  border-left: 1px solid #e2e8f0;
}
.prose tbody td:first-child {
  border-left: none;
}
.prose thead th + th {
  border-left: 1px solid #cbd5e1;
}
.prose tbody tr:nth-child(even) {
  background: #f8fafc;
}

/* Mermaid diagrams (client-rendered SVG) */
.prose pre.mermaid {
  background: none;
  color: inherit;
  padding: 0;
  margin: 1.5rem 0;
  text-align: center;
  overflow-x: auto;
}
.prose pre.mermaid:not([data-processed]) {
  visibility: hidden;
}
.prose pre.mermaid svg {
  display: inline-block;
  max-width: 100%;
  height: auto;
}

/* Host for web-component routes: fills the main content column */
.wb-host {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: calc(100vh - 3.5rem); /* viewport minus the sticky header */
  min-width: 0;
}
.wb-host > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
```

### src/themes/minimal/theme.css

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-sans: system-ui, sans-serif;
}

.site-nav .nav-list,
.site-nav .nav-sublist,
.site-nav .nav-branch {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-nav .nav-item {
  display: block;
  padding: 0.2rem 0;
  color: var(--color-slate-700);
  text-decoration: none;
  font-size: 0.9rem;
}
.site-nav .nav-item:hover {
  text-decoration: underline;
}
.site-nav .nav-item-active {
  font-weight: 700;
}
.site-nav .nav-section-title {
  display: block;
  margin-top: 0.75rem;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-slate-500);
}
.site-nav .nav-section:first-child .nav-section-title {
  margin-top: 0;
}
.site-nav .nav-parent {
  font-weight: 600;
}
.site-nav .nav-parent-label {
  display: block;
  padding: 0.2rem 0;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-slate-500);
}
.site-nav .nav-branch {
  margin-left: 0.5rem;
  padding-left: 0.6rem;
  border-left: 1px solid var(--color-slate-200);
}
.toc-heading {
  font-weight: 600;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
.toc .toc-list,
.toc .toc-sublist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc .toc-sublist {
  margin-left: 0.75rem;
}
.toc .toc-link {
  display: block;
  padding: 0.1rem 0;
  font-size: 0.85rem;
  color: var(--color-slate-600);
  text-decoration: none;
}
.toc .toc-link:hover {
  text-decoration: underline;
}

/* Documentation version badge in the header */
.site-version {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-slate-500);
}

/* Inline code: drop the typographic backticks */
.prose :not(pre) > code::before,
.prose :not(pre) > code::after {
  content: "";
}
.prose :not(pre) > code {
  background: #f3f4f6;
  padding: 0.1em 0.3em;
  border-radius: 0.2rem;
  font-weight: 500;
  font-size: 0.85em;
}

/* Tables: bordered with a filled header */
.prose table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #d1d5db;
  font-size: 0.9em;
  margin: 1.25rem 0;
}
.prose thead {
  background: #f3f4f6;
}
.prose thead th {
  padding: 0.45rem 0.7rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #9ca3af;
}
.prose tbody td {
  padding: 0.45rem 0.7rem;
  vertical-align: top;
  border-top: 1px solid #e5e7eb;
}
.prose tbody tr:nth-child(even) {
  background: #f9fafb;
}

/* Mermaid diagrams (client-rendered SVG) */
.prose pre.mermaid {
  background: none;
  color: inherit;
  padding: 0;
  margin: 1.5rem 0;
  text-align: center;
  overflow-x: auto;
}
.prose pre.mermaid:not([data-processed]) {
  visibility: hidden;
}
.prose pre.mermaid svg {
  display: inline-block;
  max-width: 100%;
  height: auto;
}

/* Host for web-component routes: fills the main content column */
.wb-host {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: calc(100vh - 3.5rem); /* viewport minus the sticky header */
  min-width: 0;
}
.wb-host > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
```

### src/types.ts

```typescript
import type { EvidenceManifest } from "./evidence/manifest.js";

export interface Frontmatter {
  title?: string;
  description?: string;
  navOrder?: number;
  navCategory?: string;
  hidden?: boolean;
  toc?: boolean;
  layout?: string;
  [key: string]: unknown;
}

export interface ComponentSpec {
  tag: string; // custom element tag to render
  scriptSourceAbs: string; // absolute path to the pre-built bundle
  scriptFileName: string; // file name emitted next to the route's index.html
}

export interface EvidenceSpec {
  sourceDirAbs: string; // absolute path to the gallery source dir
  manifest: EvidenceManifest; // validated manifest
}

export interface FileNode {
  sourcePath: string; // absolute path to .md; "" for component routes
  relativePath: string; // relative to repo root, posix
  routePath: string; // e.g. "/guides/start" or "/" for home
  frontmatter: Frontmatter;
  component?: ComponentSpec; // set for web-component routes
  evidence?: EvidenceSpec; // set for evidence-gallery routes
}

export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
  children: TocEntry[];
}

export interface NavNode {
  title: string;
  routePath?: string; // undefined for pure category folders
  order: number;
  hidden?: boolean;
  children: NavNode[];
}

export interface ParsedMarkdown {
  html: string;
  toc: TocEntry[];
  frontmatter: Frontmatter;
  assets: string[]; // relative asset paths referenced in the md
  hasMermaid: boolean; // true if the page contains a mermaid diagram
}
```

### src/utils/fs.ts

```typescript
import { access, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function outputFile(file: string, data: string): Promise<void> {
  await ensureDir(path.dirname(file));
  await writeFile(file, data, "utf8");
}

export async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function copyFileEnsured(src: string, dest: string): Promise<void> {
  await ensureDir(path.dirname(dest));
  await cp(src, dest);
}
```

### src/utils/path.ts

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Convert a repo-relative posix md path to a pretty route path. */
export function toRoutePath(relPath: string): string {
  let p = relPath.replace(/\\/g, "/").replace(/\.md$/i, "");
  // README or index files map to their directory root
  p = p.replace(/\/(readme|index)$/i, "");
  p = p.replace(/^(readme|index)$/i, "");
  p = p.replace(/^\/+|\/+$/g, "");
  return `/${p}`; // "/" for root, "/guides/start" otherwise
}

/** Resolve an internal ./other.md link relative to the current route dir. */
export function resolveInternalLink(href: string, currentRelDir: string, basePath: string): string {
  const [pathPart, hash = ""] = href.split("#");
  const cleaned = pathPart.replace(/\\/g, "/");
  // join currentRelDir + cleaned, normalize .. and .
  const segments = `${currentRelDir}/${cleaned}`.split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  let joined = stack.join("/");
  joined = joined.replace(/\.md$/i, "");
  joined = joined.replace(/\/(readme|index)$/i, "").replace(/^(readme|index)$/i, "");
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const url = (base + joined).replace(/\/+/g, "/");
  const withSlash = url.endsWith("/") ? url : `${url}/`;
  return hash ? `${withSlash}#${hash}` : withSlash;
}

export function outFileFor(routePath: string): string {
  const clean = routePath.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/index.html` : "index.html";
}

/** Join basePath + routePath into a base-path-absolute URL, e.g. "/base/", "/guides/start" -> "/base/guides/start". */
export function withBase(routePath: string, basePath: string): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return (base + routePath.replace(/^\/+/, "")).replace(/\/+/g, "/");
}
```

### tests/build.test.ts

```typescript
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/builder.js";
import { exists } from "../src/utils/fs.js";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const MANIFEST = {
  generatedAt: "2026-09-16T13:27:10.400Z",
  evidence: [
    {
      id: "empty-list",
      title: "Leere Dokumentliste",
      shows: "Leerzustand",
      proves: "Rendert den Leerzustand",
      status: "passed",
      browsers: {
        chromium: { file: "empty-list-chromium.png", status: "passed" },
        webkit: { file: "empty-list-webkit.png", status: "passed" },
      },
    },
    {
      id: "missing-shot",
      title: "Fehlender Screenshot",
      shows: "Platzhalter",
      proves: "Fehlende Bilder brechen den Build nicht",
      status: "failed",
      browsers: {
        chromium: { file: "does-not-exist.png", status: "failed" },
      },
    },
  ],
};

describe("build with evidenceGalleries", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "build-"));
    await mkdir(path.join(dir, "shots"), { recursive: true });
    await writeFile(path.join(dir, "shots", "manifest.json"), JSON.stringify(MANIFEST));
    await writeFile(path.join(dir, "shots", "empty-list-chromium.png"), PNG);
    await writeFile(path.join(dir, "shots", "empty-list-webkit.png"), PNG);
    await writeFile(path.join(dir, "index.md"), "# Home\n");
    await writeFile(
      path.join(dir, "static-docs.config.json"),
      JSON.stringify({
        outputDir: "./out",
        evidenceGalleries: [{ source: "./shots", path: "/e2e-evidence", title: "E2E Evidence" }],
      }),
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("emits the gallery page, runtime, and images", async () => {
    const { config } = await build(path.join(dir, "static-docs.config.json"));
    const galleryHtml = await readFile(
      path.join(config.outputDirAbs, "e2e-evidence", "index.html"),
      "utf8",
    );
    expect(galleryHtml).toContain('data-ev-id="empty-list"');
    expect(galleryHtml).toContain('data-ev-open="missing-shot"');
    expect(galleryHtml).toContain("Screenshot missing: does-not-exist.png");
    expect(galleryHtml).toContain("evidence-gallery.js");
    expect(galleryHtml).toContain("evidence-gallery.css");
    expect(galleryHtml).toContain("E2E Evidence"); // sidebar title
    expect(
      await exists(path.join(config.outputDirAbs, "e2e-evidence", "evidence-gallery.js")),
    ).toBe(true);
    expect(
      await exists(path.join(config.outputDirAbs, "e2e-evidence", "empty-list-chromium.png")),
    ).toBe(true);
    // missing image: warned but not copied, build succeeded
    expect(await exists(path.join(config.outputDirAbs, "e2e-evidence", "does-not-exist.png"))).toBe(
      false,
    );
  });
});
```

### tests/config.test.ts

```typescript
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("evidenceGalleries config", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cfg-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("parses a full evidence gallery entry", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        evidenceGalleries: [
          {
            source: "./e2e-screenshots",
            path: "/e2e-evidence",
            title: "E2E Test Evidence",
            description: "Proof",
            navCategory: "Quality",
            navOrder: 10,
            hidden: false,
          },
        ],
      }),
    );
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries).toHaveLength(1);
    expect(cfg.evidenceGalleries?.[0]).toMatchObject({
      source: "./e2e-screenshots",
      path: "/e2e-evidence",
      title: "E2E Test Evidence",
      navCategory: "Quality",
      navOrder: 10,
      hidden: false,
    });
  });

  it("defaults hidden to false and leaves optionals undefined", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        evidenceGalleries: [{ source: "./shots", path: "evidence" }],
      }),
    );
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries?.[0].hidden).toBe(false);
    expect(cfg.evidenceGalleries?.[0].title).toBeUndefined();
  });

  it("rejects an entry without source", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(p, JSON.stringify({ evidenceGalleries: [{ path: "/x" }] }));
    await expect(loadConfig(p)).rejects.toThrow("Invalid config");
  });

  it("is optional", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(p, JSON.stringify({}));
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries).toBeUndefined();
  });
});
```

### tests/evidence/manifest.test.ts

```typescript
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EvidenceManifestSchema, loadEvidenceManifest } from "../../src/evidence/manifest.js";

const VALID = {
  generatedAt: "2026-09-16T13:27:10.400Z",
  evidence: [
    {
      id: "authenticated-list",
      title: "Authentifizierte Dokumentliste",
      shows: "Breadcrumbs und Dokumenttabelle",
      proves: "Angemeldete Benutzer sehen die Liste",
      spec: "specs/authenticated-list.spec.ts",
      test: "renders authenticated list",
      status: "passed",
      browsers: {
        chromium: { file: "authenticated-list-chromium.png", status: "passed" },
        firefox: { file: "authenticated-list-firefox.png", status: "failed" },
      },
    },
  ],
};

describe("EvidenceManifestSchema", () => {
  it("accepts a valid manifest and keeps unknown fields", () => {
    const raw = { ...VALID, futureField: 1 };
    raw.evidence = [{ ...VALID.evidence[0], metadata: "present" }];
    const parsed = EvidenceManifestSchema.parse(raw);
    expect(parsed.evidence[0].id).toBe("authenticated-list");
    expect((parsed.evidence[0] as Record<string, unknown>).metadata).toBe("present");
  });

  it("rejects a missing required field", () => {
    const bad = structuredClone(VALID);
    delete (bad.evidence[0] as Record<string, unknown>).shows;
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const bad = structuredClone(VALID);
    (bad.evidence[0] as Record<string, unknown>).status = "flaky";
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid per-browser status", () => {
    const bad = structuredClone(VALID);
    bad.evidence[0].browsers.chromium.status = "flaky" as never;
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("loadEvidenceManifest", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "evidence-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads a valid manifest from disk", async () => {
    const p = path.join(dir, "manifest.json");
    await writeFile(p, JSON.stringify(VALID));
    const manifest = await loadEvidenceManifest(p);
    expect(manifest.evidence).toHaveLength(1);
  });

  it("throws a clear error when the file is missing", async () => {
    await expect(loadEvidenceManifest(path.join(dir, "manifest.json"))).rejects.toThrow(
      "Evidence manifest not found",
    );
  });

  it("throws with Zod issues when invalid", async () => {
    const p = path.join(dir, "manifest.json");
    await writeFile(p, JSON.stringify({ generatedAt: "x", evidence: [{}] }));
    await expect(loadEvidenceManifest(p)).rejects.toThrow("Invalid evidence manifest");
  });

  it("rejects duplicate evidence ids", async () => {
    const p = path.join(dir, "manifest.json");
    const dup = {
      ...VALID,
      evidence: [VALID.evidence[0], VALID.evidence[0]],
    };
    await writeFile(p, JSON.stringify(dup));
    await expect(loadEvidenceManifest(p)).rejects.toThrow(
      'duplicate evidence id "authenticated-list"',
    );
  });
});
```

### tests/router.test.ts

```typescript
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { resolveRoutes } from "../src/router.js";

const MANIFEST = {
  generatedAt: "2026-09-16T13:27:10.400Z",
  evidence: [
    {
      id: "empty-list",
      title: "Leere Dokumentliste",
      shows: "Leerzustand",
      proves: "Rendert den Leerzustand",
      status: "passed",
      browsers: {
        chromium: { file: "empty-list-chromium.png", status: "passed" },
      },
    },
  ],
};

describe("resolveRoutes with evidenceGalleries", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "router-"));
    await mkdir(path.join(dir, "shots"), { recursive: true });
    await writeFile(path.join(dir, "shots", "manifest.json"), JSON.stringify(MANIFEST));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function configFor(gallery: Record<string, unknown>) {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        routes: [],
        evidenceGalleries: [gallery],
      }),
    );
    return loadConfig(p);
  }

  it("creates an evidence FileNode with normalized route and frontmatter", async () => {
    const cfg = await configFor({
      source: "./shots",
      path: "e2e-evidence",
      title: "E2E Test Evidence",
      description: "Proof",
      navCategory: "Quality",
      navOrder: 10,
    });
    const nodes = await resolveRoutes(cfg);
    const node = nodes.find((n) => n.routePath === "/e2e-evidence");
    expect(node).toBeDefined();
    expect(node?.evidence).toBeDefined();
    expect(node?.evidence?.sourceDirAbs).toBe(path.join(dir, "shots"));
    expect(node?.evidence?.manifest.evidence[0].id).toBe("empty-list");
    expect(node?.frontmatter).toMatchObject({
      title: "E2E Test Evidence",
      description: "Proof",
      navCategory: "Quality",
      navOrder: 10,
      hidden: false,
      toc: false,
    });
    expect(node?.sourcePath).toBe("");
  });

  it("derives a default title from the route path", async () => {
    const cfg = await configFor({ source: "./shots", path: "/e2e-evidence" });
    const nodes = await resolveRoutes(cfg);
    expect(nodes[0].frontmatter.title).toBe("E2e Evidence");
  });

  it("throws when the manifest is missing", async () => {
    const cfg = await configFor({ source: "./nope", path: "/evidence" });
    await expect(resolveRoutes(cfg)).rejects.toThrow("Evidence manifest not found");
  });
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### tsup.config.ts

```typescript
import { createRequire } from "node:module";
import { defineConfig } from "tsup";

// The config is an ES module, so createRequire avoids JSON import assertions,
// whose syntax varies across Node versions.
const pkg = createRequire(import.meta.url)("./package.json") as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
```

## Stats

- Files listed: 50
- Files embedded: 49 (106.2 KB)
- Skipped (binary): 0
- Skipped (over --max-bytes): 1
- Skipped (over --max-total-bytes budget): 0
- Generated in: 34ms
