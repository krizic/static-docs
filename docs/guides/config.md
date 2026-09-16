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
