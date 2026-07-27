# StaticDocs (`@org/static-docs`) — Design

Date: 2026-07-27
Source requirements: `SRD.md`

## 1. Product

A TypeScript ESM Node.js package (Node 18+) providing a `static-docs` CLI
(`build`, `dev`) and a programmatic `build()` API. It turns a repository's
Markdown files into a multi-page, deeply-linked, **zero-runtime-JS** static
documentation site: left navigation, main content, right table-of-contents
panel. Built with `tsup`, ships `.d.ts` for API consumers.

## 2. Confirmed decisions

| Topic | Decision |
|-------|----------|
| Scope | Full SRD, including Sprint 4 (`dev` server, syntax highlighting, asset copy, self-dogfooding) |
| Tailwind | Always compile with `@tailwindcss/cli` (bundled dependency); ship theme entry CSS |
| Client JS | Zero JS in `build` output; CSS-only interactions; dev-only live-reload script |
| `.md` links | Rewrite `./other.md` → pretty URL `./other/` at build time |
| Package name | `@org/static-docs`, CLI binary `static-docs` |
| Tests | No unit suite; dogfooding build is the acceptance check |
| Syntax highlight | `rehype-pretty-code` (Shiki), default Shiki theme `github-dark` |
| Nav grouping | Directory-based, using `navCategory`/frontmatter; static TOC, deep levels de-emphasized (no JS collapse) |
| MDX | Not supported in v1 (`.md` only) |

## 3. Architecture / build pipeline (SRD §2)

Per file:
1. **Ingest** — load JSON config, resolve `basePath`, validate with zod.
2. **Graph** — explicit `routes` if present, else scan `**/*.md` respecting
   `sidebar.exclude` (+ `node_modules`, `.git`).
3. **Parse** — frontmatter (gray-matter) + unified MD→HTML AST, slugged heading IDs.
4. **TOC extract** — walk AST for `h1..h6`, filtered by `toc.minDepth/maxDepth`.
5. **Render** — inject content into Tailwind HTML shell (left nav + main + right TOC).
6. **Asset pipeline** — compile theme CSS via Tailwind CLI; copy referenced local assets.
7. **Emit** — pretty URLs (`/guides/start/index.html`).

## 4. Modules (SRD §6 skeleton)

```
static-docs/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── bin/static-docs.js            # #!/usr/bin/env node -> dist/cli.js
├── src/
│   ├── cli.ts                    # cac: build, dev, --config
│   ├── index.ts                  # programmatic API (export build)
│   ├── config.ts                 # zod schema, loader, defaults, JSON Schema export
│   ├── builder.ts                # orchestrator (build)
│   ├── dev.ts                    # chokidar watcher + http server + live reload
│   ├── scanner.ts                # fast-glob discovery -> FileNode[]
│   ├── router.ts                 # FileNode -> Route, pretty URLs, collisions
│   ├── nav.ts                    # buildNavTree (directory grouping, navOrder)
│   ├── parser/
│   │   ├── index.ts              # unified pipeline factory + parseMarkdown
│   │   ├── toc.ts                # heading extractor (rehype)
│   │   ├── meta.ts               # frontmatter extraction
│   │   └── links.ts              # rewrite ./x.md -> pretty URL
│   ├── renderer/
│   │   ├── layout.ts             # full HTML shell
│   │   ├── sidebar.ts            # recursive left nav, active highlight
│   │   ├── toc-panel.ts          # right context panel
│   │   └── page.ts               # renderPage combiner
│   ├── themes/
│   │   ├── default/theme.css
│   │   ├── default/index.ts
│   │   └── minimal/theme.css
│   ├── theme.ts                  # compileTheme (Tailwind CLI)
│   ├── assets.ts                 # copyAssets
│   └── utils/{fs.ts,path.ts}
├── schema.json                   # generated JSON Schema
└── assets/favicon.ico
```

### Key types
```ts
interface FileNode {
  sourcePath: string;      // abs path to .md
  relativePath: string;    // relative to repo root
  routePath: string;       // e.g. /guides/start
  frontmatter: Frontmatter;
}
interface Route { node: FileNode; outFile: string; }
interface TocEntry { depth: number; text: string; slug: string; children: TocEntry[]; }
interface NavNode { title: string; routePath?: string; order: number; children: NavNode[]; }
```

## 5. Parser pipeline

```
md string
  → remark-parse
  → remark-frontmatter (yaml)
  → remark-gfm
  → remark-rehype
  → rehype-slug
  → rehype-autolink-headings
  → rehype-pretty-code (Shiki, github-dark)
  → [rewrite .md links → pretty URLs]
  → rehype-stringify
  → html string
```
TOC extracted from the rehype AST before stringify. `smartypants` applied when
`markdown.smartypants` is true (via `remark-smartypants`).

## 6. Config & frontmatter (SRD §4)

`static-docs.config.json` shape and reserved frontmatter keys exactly as SRD §4.
zod schema validates and applies defaults:
`outputDir=./docs-build`, `basePath=/`, `theme=default`,
`sidebar.auto=true`, `sidebar.collapsedDepth=1`,
`toc.enabled=true/minDepth=2/maxDepth=4`,
`markdown.gfm=true/smartypants=true`.
`hidden: true` builds the page but omits it from nav.

## 7. Renderer

Pure functions returning HTML strings with Tailwind utility classes.
- `renderPage(page, navTree, tocTree, config)` — full document shell (SRD §5.4).
- `renderSidebar(navTree, currentRoute)` — recursive `<ul>`, active highlight,
  directory grouping via `navCategory`/dir name, `navOrder` sorting.
- `renderToc(tocTree)` — nested anchors to `#slug`; H4+ de-emphasized.
- Mobile nav via CSS-only (`<details>`/checkbox); no JS in output.

## 8. Theme pipeline

`compileTheme(config)`:
1. Write temp entry CSS: `@import "<selected theme>.css";` then, if `customCss`,
   `@import "<customCss>";`.
2. Invoke `@tailwindcss/cli -i <entry> -o <outputDir>/theme.css --content <outputDir>/**/*.html`
   so utility classes in the emitted HTML are included.
3. Themes use Tailwind v4 `@theme` tokens + `@utility` classes for sidebar, toc,
   prose, code blocks.

## 9. CLI & dev

- `static-docs build [--config path]` → runs `build()`.
- `static-docs dev [--config path] [--port]` → chokidar watches `**/*.md` +
  config; rebuild on change; Node `http` static server; injects a small
  live-reload script **only in dev** (SSE or poll). Production `build` output
  contains no JS.

## 10. Verification (dogfood)

No unit tests. Acceptance: the package builds its own `README.md` + `docs/`
into `docs-build/` without errors, producing `index.html`, nested
`*/index.html`, and `theme.css`. Manual spot-check of generated HTML/CSS.

## 11. Assumptions

- `@tailwindcss/cli` bundled as a dependency (always-compile path needs no user setup).
- `@org` scope is a placeholder; publish config prepared but package not published.
- Node 18+ ESM runtime; `fetch`/`fs` native.
