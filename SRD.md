## 1. Product Definition

**Working Name:** `StaticDocs` (`@org/static-docs`)  
**Type:** Node.js CLI + programmatic API distributed via NPM.  
**Goal:** Turn a repository’s Markdown files into a multi-page, deeply-linked, static documentation site with zero runtime JavaScript overhead. The user installs the package, drops a JSON config in repo root, and runs a build command to emit a folder of HTML, CSS, and assets.

---

## 2. High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Repository    │────▶│   StaticDocs     │────▶│  Output Folder  │
│                 │     │   Build Engine   │     │ (docs-build/)   │
│ • *.md files    │     │                  │     │                 │
│ • config.json   │     │ 1. Load Config   │     │ • index.html    │
│ • /assets       │     │ 2. Scan / Route  │     │ • /*/index.html │
└─────────────────┘     │ 3. Parse MD▶HTML │     │ • theme.css     │
                        │ 4. Extract TOC   │     │ • sitemap       │
                        │ 5. Render Shell  │     └─────────────────┘
                        │ 6. Write Files   │
                        └──────────────────┘
```

**Build Pipeline (per file)**
1. **Ingest** — Load JSON config; resolve `basePath`.
2. **Graph** — Build a file graph from explicit `routes` OR auto-scan (`**/*.md`, excluding `node_modules`, `.git`, config `exclude` globs).
3. **Parse** — For each MD file: extract YAML frontmatter (meta), parse Markdown → HTML AST, generate slugged IDs for headings.
4. **TOC Extract** — Walk the AST to capture `h1..h6` hierarchy for the right-hand context panel.
5. **Render** — Inject content into a Tailwind-styled HTML shell (Left Nav + Main Content + Right TOC).
6. **Asset Pipeline** — Compile/bundle theme CSS; copy referenced local images/assets.
7. **Emit** — Write pretty URLs (`/guides/start/index.html`).

---

## 3. Recommended Tech Stack

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Runtime** | Node.js 18+ (ESM) | Native `fs`, `path`, `fetch`, modern syntax. |
| **Language** | TypeScript | Self-documenting; publish `.d.ts` for API consumers. |
| **CLI** | `cac` or `commander` | Lightweight argument + command parsing (`build`, `dev`, `--config`). |
| **Markdown** | `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-stringify` | Industry standard; plugin-based. `remark-gfm` covers tables, strikethrough, task lists, autolinks. |
| **Heading Slugs** | `rehype-slug` + `rehype-autolink-headings` | Makes all titles deeply linkable out of the box. |
| **Syntax Highlight** | `rehype-pretty-code` (or `highlight.js` via plugin) | Zero-runtime highlighting; generates static `<pre>` blocks at build time. |
| **Frontmatter** | `gray-matter` | Parse YAML meta blocks inside `.md` files. |
| **File Discovery** | `fast-glob` | Reliable cross-platform globbing. |
| **Config Validation** | `zod` | Runtime validation of user JSON config with great error messages. |
| **HTML Generation** | Template literals + a small tagged-template helper (or Preact SSR) | Avoid shipping a heavy client framework. The site is static HTML; components are pure functions returning strings with Tailwind classes. |
| **Tailwind v4** | `@tailwindcss/cli` (standalone) | v4 is CSS-first. The library ships theme CSS entry files that `@import "tailwindcss"`. Build step invokes the Tailwind binary against generated HTML/templates. |
| **Dev Experience** | Optional `chokidar` + local HTTP server | `static-docs dev` watches MD/JSON changes and rebuilds + serves. |

---

## 4. Configuration & Contract Design

### A. Repository Config (`static-docs.config.json`)
Placed in repo root. Every key is optional except implied defaults.

```json
{
  "$schema": "./node_modules/static-docs/schema.json",
  "siteName": "My Project Docs",
  "outputDir": "./docs-build",
  "basePath": "/",
  "theme": "default",
  "customCss": "./docs/styles/overrides.css",
  "routes": [
    { "path": "/", "source": "./README.md", "meta": { "title": "Home" } },
    { "path": "/api/core", "source": "./packages/core/README.md" }
  ],
  "sidebar": {
    "auto": true,
    "collapsedDepth": 1,
    "exclude": ["node_modules/**", "**/CHANGELOG.md", "**/.github/**"]
  },
  "toc": {
    "enabled": true,
    "minDepth": 2,
    "maxDepth": 4
  },
  "markdown": {
    "gfm": true,
    "smartypants": true
  }
}
```

**Routing Rules**
- If `routes` array is provided, it is the source of truth. `path` becomes the URL route.
- If `routes` is omitted, the **Scanner** runs: all `**/*.md` files (respecting `sidebar.exclude`) become routes relative to repo root.
  - Example: `./docs/getting-started/install.md` → `/docs/getting-started/install/`

### B. Markdown Meta (YAML Frontmatter)
Any `.md` file can declare compiler-specific metadata at the top:

```yaml
---
title: Installation Guide
description: How to install the package via NPM
navOrder: 1
navCategory: Getting Started
hidden: false
toc: true
layout: default
---
```

**Reserved Meta Keys**
- `title` — Page title (`<title>` + nav label fallback).
- `description` — Meta description tag.
- `navOrder` — Integer to sort pages within a directory/category.
- `navCategory` — Override grouping in the left sidebar.
- `hidden` — If `true`, file is built but omitted from navigation.
- `toc` — Boolean to toggle right-hand context panel per page.
- `layout` — Future-proofing for different page shells.

---

## 5. Key Technical Modules

### 1. Scanner (`src/scanner.ts`)
- Accepts `baseDir` (repo root) and `exclude` globs.
- Returns `FileNode[]`: `{ sourcePath, relativePath, routePath, frontmatter }`.
- Must resolve collisions (e.g., two files mapping to the same route) with a warning.

### 2. Router (`src/router.ts`)
- Maps `FileNode` → `Route`.
- Pretty URLs: output file is `${routePath}/index.html`.
- Resolves explicit `routes` overrides first; fills gaps with scanned files.

### 3. Parser / Transformer (`src/parser/`)
- **Pipeline** (Unified):
  ```
  md string → remark-parse → remark-frontmatter → remark-gfm → 
  remark-rehype → rehype-slug → rehype-autolink-headings → 
  rehype-pretty-code → rehype-stringify → html string
  ```
- **TOC Extractor**: Run a separate plugin before stringify to grab heading text + depth + generated slug.
- **Asset Detection**: Find relative image/links (`./assets/diagram.png`) so the builder can copy them.

### 4. Renderer (`src/renderer/`)
Pure functions generating HTML strings.

- **`renderPage(page, navTree, tocTree)`**: Full document shell.
- **`renderSidebar(navTree, currentRoute)`**: Recursive `<ul>` for left panel; highlights active route.
- **`renderToc(tocTree)`**: Right panel nested list linking to `#heading-id`s.
- **Layout HTML Skeleton**:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>{title} | {siteName}</title>
    <link rel="stylesheet" href="{basePath}theme.css">
  </head>
  <body class="bg-white text-slate-900 antialiased">
    <!-- Top Nav (mobile hamburger + site title) -->
    <header class="sticky top-0 z-50 ...">...</header>
    
    <div class="flex max-w-8xl mx-auto">
      <!-- Left Sidebar (site nav) -->
      <aside class="hidden lg:block w-72 ...">...</aside>
      
      <!-- Main Content -->
      <main class="flex-1 min-w-0 px-8 py-12">
        <article class="prose prose-slate max-w-none">
          {content}
        </article>
      </main>
      
      <!-- Right Context Panel (TOC) -->
      <aside class="hidden xl:block w-64 ...">
        <nav class="toc">
          {tocHtml}
        </nav>
      </aside>
    </div>
  </body>
  </html>
  ```

### 5. Theme / CSS Pipeline (`src/themes/`)
Because you want **Tailwind v4**, the approach should be:

- **Ship pre-designed theme CSS files** inside the package (`/themes/default.css`, `/themes/minimal.css`).
- Each theme CSS file contains:
  ```css
  @import "tailwindcss";
  
  @theme {
    --color-brand-500: #0ea5e9;
    --font-sans: 'Inter', system-ui, sans-serif;
    /* ...design tokens */
  }
  
  /* Component utility classes for sidebar, toc, prose, code blocks */
  @utility toc-link { ... }
  @utility nav-item-active { ... }
  ```
- **Build-time compilation**: The CLI writes a temporary entry CSS that imports the selected theme, runs `@tailwindcss/cli -i entry.css -o docs-build/theme.css`, scanning the library’s template HTML for classes.
- **User override**: If `customCss` is provided, the CLI `@import`s it after the theme, allowing users to override tokens without needing to know Tailwind internals.

### 6. Builder (`src/builder.ts`)
Orchestrator. Pseudocode:
```ts
async function build(configPath) {
  const config = await loadConfig(configPath);
  const files = config.routes ? manualRoutes(config) : await scanRepo(config);
  const navTree = buildNavTree(files);
  
  await fs.ensureDir(config.outputDir);
  
  for (const file of files) {
    const { html, toc } = await parseMarkdown(file.sourcePath, config);
    const pageHtml = renderPage({ ...file, html, toc, navTree, config });
    const outPath = path.join(config.outputDir, file.routePath, 'index.html');
    await fs.outputFile(outPath, pageHtml);
  }
  
  await compileTheme(config);
  await copyAssets(files, config);
}
```

---

## 6. Project Skeleton (Library Repo)

```
static-docs/
├── package.json
├── tsconfig.json
├── README.md
├── bin/
│   └── static-docs.js          # CLI entry (#!/usr/bin/env node)
├── src/
│   ├── cli.ts                  # Command definitions (build, dev)
│   ├── config.ts               # Zod schema, config loader, defaults
│   ├── builder.ts              # Main build orchestrator
│   ├── scanner.ts              # Auto-discovery of *.md
│   ├── router.ts               # Route resolution
│   ├── parser/
│   │   ├── index.ts            # Unified pipeline factory
│   │   ├── toc.ts              # AST walker to extract headings
│   │   └── meta.ts             # Frontmatter extractor
│   ├── renderer/
│   │   ├── layout.ts           # HTML shell template
│   │   ├── sidebar.ts          # Left nav recursive component
│   │   ├── toc-panel.ts        # Right context panel
│   │   └── page.ts             # Combines all into final HTML
│   ├── themes/
│   │   ├── default/
│   │   │   ├── theme.css       # Tailwind v4 entry + tokens
│   │   │   └── index.ts        # Theme metadata
│   │   └── minimal/
│   │       └── theme.css
│   └── utils/
│       ├── fs.ts
│       └── path.ts
├── schema.json                 # JSON Schema for IDE autocomplete
└── assets/
    └── favicon.ico
```

---

## 7. MVP Phase 1 — Team Starting Point

**Goal:** A working CLI that turns one or more `.md` files into a folder of styled HTML with sidebars and TOC.

### Sprint 0: Bootstrap (Day 1)
- [ ] Init repo with TypeScript + ESM + `tsup`/`unbuild` for bundling.
- [ ] Set up `cac` CLI with `build` command and `--config` flag.
- [ ] Define `zod` config schema and JSON Schema export.

### Sprint 1: Core Engine (Days 2–4)
- [ ] Implement `scanner.ts` (auto-glob) + `router.ts` (pretty URLs).
- [ ] Wire `unified` pipeline: `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-slug` → `rehype-stringify`.
- [ ] Build `toc.ts` AST walker; return nested TOC object.
- [ ] Build string-based `renderer` (sidebar + page shell + TOC panel).

### Sprint 2: Tailwind v4 Theme (Days 5–6)
- [ ] Create `default/theme.css` using `@import "tailwindcss"` and `@theme` tokens.
- [ ] Write `compileTheme()` utility that invokes `@tailwindcss/cli` programmatically.
- [ ] Ensure all renderer HTML uses Tailwind utility classes that get picked up by the CSS build.

### Sprint 3: Integration (Day 7)
- [ ] Connect builder pipeline: scan → parse → render → write → compile CSS.
- [ ] Support `static-docs.config.json` overrides for routes.
- [ ] Handle frontmatter (`gray-matter`) and inject `<title>`, meta tags.

### Sprint 4: Polish & Dogfooding (Day 8+)
- [ ] Add `dev` command with file watcher + local server.
- [ ] Syntax highlighting (`rehype-pretty-code`).
- [ ] Copy local assets referenced in Markdown.
- [ ] Internal test: use the library to build docs for itself.

---

## 8. Brainstorming Questions for the Team

Before coding, align on these decisions:

1. **MDX Support?**  
   Should we support `.mdx` (JSX in Markdown) or stay strictly `.md` for v1? MDX requires a runtime/JSX transform; it complicates static extraction.

2. **Client-side JavaScript?**  
   Do we ship *zero* JS (pure CSS for sidebar toggles)? Or a tiny vanilla-JS bundle for mobile nav/search? The user said “static,” so prefer zero JS, but search might need a small pre-indexed JS snippet.

3. **Tailwind v4 Distribution Strategy**  
   Do we ship fully pre-compiled CSS per theme (zero Tailwind dependency for users)? Or do we require users to have `@tailwindcss/cli` installed?  
   *Recommendation:* Ship pre-compiled CSS for the default theme so it works out of the box; allow advanced users to point to a custom `.css` entry that imports Tailwind.

4. **Link Strategy Between Pages**  
   If a user writes `[See Guide](./other.md)`, should we rewrite that to `./other/` (pretty URL) at build time?

5. **Multi-repo / Monorepo Structure**  
   Should the scanner be smart enough to group routes by package folders (`/packages/core`, `/packages/ui`) automatically, or is that purely config-driven?

6. **Right-panel TOC Depth**  
   Do we collapse deeper levels (H4+) by default and expand on scroll? Pure CSS or light JS?

