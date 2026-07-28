---
title: Web-Component Routes
description: Attach pre-built web components to routes that render full-bleed inside the docs layout.
hidden: true
---

# Web-Component Routes — Design

## Problem

StaticDocs turns Markdown into static pages. Every route must be backed by a
`.md` source. There is no way to surface something interactive — a workbench for
a component the user's repo builds, a live playground, a dashboard — inside the
documentation site.

Users want to point a route at a **pre-built web component bundle** and have it
appear in the sidebar like any other page, then fill the page body when opened.

## Goals

- Declare routes in config that mount a custom element instead of Markdown.
- Those routes appear in the sidebar alongside Markdown pages, with the same
  ordering, grouping, and active-state behavior.
- The component fills the content area of the page (header and sidebar remain).
- The component's JS bundle is copied into the build output and loaded on that
  route only.
- The dev server rebuilds and live-reloads when the bundle changes.

## Non-Goals

- Passing attributes or props to the element from config. The element is
  rendered bare; it configures itself. (Deferred until a real need appears.)
- Bundling, compiling, or transpiling the component. The user supplies a
  **pre-built, self-contained ES module**.
- Code-splitting. A bundle that emits sibling chunk files is out of scope; only
  the single declared file is copied.
- Remote/CDN script URLs. Local paths only.
- A table of contents for component routes. There are no headings to extract.

## Configuration

A new top-level `componentRoutes` array:

```jsonc
{
  "siteName": "My Docs",
  "componentRoutes": [
    {
      "path": "/workbench",
      "tag": "my-workbench",
      "script": "./dist/workbench.js",
      "title": "Workbench",
      "navCategory": "Tools",
      "navOrder": 5,
      "hidden": false
    }
  ]
}
```

| Field | Required | Type | Meaning |
|-------|----------|------|---------|
| `path` | yes | string | Route path. Normalized like `routes[].path` (leading slash added, trailing slashes stripped). |
| `tag` | yes | string | Custom element tag name to render. |
| `script` | yes | string | Path to the pre-built ES-module bundle, resolved relative to the config file's directory. |
| `title` | no | string | Sidebar label. Defaults to the humanized last path segment. |
| `navCategory` | no | string | Flat sidebar category, same semantics as the `navCategory` frontmatter key. |
| `navOrder` | no | number | Sidebar ordering, same semantics as the `navOrder` frontmatter key. |
| `hidden` | no | boolean | When true the page is still built but omitted from the sidebar. Defaults to false. |

### Validation

`tag` must contain a hyphen and no whitespace or `<`/`>`/`/` characters — this
is both the HTML custom-element requirement and the guard that stops a config
value from breaking out of the tag it is interpolated into. Invalid tags fail
the build with a clear message rather than emitting malformed HTML.

A `componentRoutes` entry whose `script` does not exist on disk fails the build
with a message naming the route and the missing path. This is a hard error, not
a warning: a component route without its bundle renders a permanently empty
page, which is worse than a failed build.

## Architecture

### Data model

`FileNode` gains an optional `component` field:

```ts
export interface ComponentSpec {
  tag: string;
  scriptSourceAbs: string; // absolute path to the source bundle
  scriptFileName: string;  // file name emitted next to index.html
}

export interface FileNode {
  sourcePath: string;      // "" for component routes
  relativePath: string;
  routePath: string;
  frontmatter: Frontmatter;
  component?: ComponentSpec;
}
```

Component routes are represented as ordinary `FileNode`s carrying a **synthetic
frontmatter** assembled from the config fields (`title`, `navOrder`,
`navCategory`, `hidden`). This is the key decision: it means component routes
flow through `buildNavTree` untouched, so sidebar grouping, ordering,
folder-index merging, and active-link highlighting all work with no changes to
`nav.ts` or `sidebar.ts`.

### Router

`resolveRoutes` currently early-returns `scanRepo(config)` when `config.routes`
is empty, which would skip component routes entirely. It is restructured to:

1. Produce Markdown nodes — from `config.routes` if present, otherwise from
   `scanRepo`.
2. Append component nodes.
3. Apply one shared duplicate-path check across both, so a component route
   colliding with a Markdown route is reported and skipped consistently.

Route-path normalization (`normalizeRoute`) is reused for `componentRoutes`.

### Build

The build loop branches on `file.component`:

- **Markdown node** — unchanged: `parseMarkdown` → `renderPage`.
- **Component node** — skip parsing entirely, call `renderComponentPage`, and
  copy the bundle to the route's output directory.

Only Markdown nodes are handed to `copyAssets` and the Mermaid check, so the
existing `rendered` array keeps its `ParsedMarkdown` type and neither function
needs to reason about a missing parse result.

### Rendering

`htmlShell` gains two optional fields on `LayoutData`:

- `fullBleed?: boolean` — when true, the `<main>` content is emitted as a
  full-height host `<div>` instead of the `prose` `<article>`, and the vertical
  padding is dropped so the component reaches the edges of the content column.
- `bodyScript?: string` — a pre-rendered `<script type="module" src="…">` tag
  appended near `</body>`.

The component page body is:

```html
<div class="wb-host"><my-workbench></my-workbench></div>
```

`showToc` is forced false for component routes and the TOC aside is omitted, so
the component gets the full remaining width.

The tag name is validated (see above) before interpolation; `title` and other
user strings continue to go through the existing `esc` helper.

### Assets

The bundle is copied to the route's own output directory, next to its
`index.html`:

```
docs-build/
  workbench/
    index.html
    workbench.js
```

and referenced with a **relative** `src="./workbench.js"`. Relative referencing
means the page works under any `basePath` without additional rewriting, and
per-route directories mean two component routes can use bundles with the same
file name without colliding.

The `assetVersion` cache-busting query string already used for `theme.css` is
applied to the script URL too.

### Dev server

`dev.ts` builds its chokidar watch list from `config`. Each component route's
`script` path is added, so rebuilding the user's component triggers a rebuild
and a live reload. Paths are added relative to `rootDir`, matching how
`customCss` is already watched.

### Theme

Both `src/themes/default/theme.css` and `src/themes/minimal/theme.css` get a
`.wb-host` rule: a flex column that fills the available height, with its direct
child stretching to fill it. The host establishes the height contract so the
component author can rely on `height: 100%` working.

The layout's `<main>` must become a flex column with a minimum height derived
from the viewport minus the header, otherwise "fill the page" has nothing to
fill against.

### Schema

`schema.json` is regenerated via `pnpm run schema` so editors get completion and
validation for `componentRoutes`.

## Error Handling

| Situation | Behavior |
|-----------|----------|
| `script` file missing | Build fails with the route path and resolved script path. |
| `tag` is not a valid custom element name | Build fails naming the route and the offending tag. |
| Component route path duplicates another route | Warned and skipped, matching existing duplicate-route behavior. |
| `componentRoutes` absent or empty | No behavior change anywhere; existing sites build identically. |

## Testing

The repository has no test runner configured and no committed
`static-docs.config.json`, so verification is done against a local, untracked
config created for the purpose:

1. `pnpm typecheck` and `pnpm build` pass.
2. `pnpm run schema` regenerates `schema.json` with `componentRoutes` present.
3. A scratch config declaring one component route (pointing at a tiny hand-written
   custom-element bundle) builds a page containing the custom element and its
   copied bundle, shows the route in the sidebar in the expected position, and
   renders the component filling the content area.
4. Removing `componentRoutes` from that config produces output identical to the
   current build, confirming the change is additive.
5. The failure paths are exercised by hand: a missing `script` and an invalid
   `tag` each abort the build with the described message.

## Files Touched

| File | Change |
|------|--------|
| `src/config.ts` | `ComponentRouteSchema`, `componentRoutes` on `ConfigSchema`. |
| `src/types.ts` | `ComponentSpec`, optional `component` on `FileNode`. |
| `src/router.ts` | Restructure `resolveRoutes`; build component nodes; validate. |
| `src/renderer/layout.ts` | `fullBleed` and `bodyScript` support. |
| `src/renderer/page.ts` | `renderComponentPage`. |
| `src/builder.ts` | Branch on `file.component`; copy bundles. |
| `src/assets.ts` | `copyComponentScripts`. |
| `src/dev.ts` | Watch component script paths. |
| `src/themes/*/theme.css` | `.wb-host` rule. |
| `schema.json` | Regenerated. |
| `README.md`, `docs/guides/config.md` | Document `componentRoutes`. |
