# StaticDocs Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. This project uses **dogfood verification** (build + typecheck), not a unit-test suite, per the approved spec. Each task ends with a typecheck and a commit.

**Goal:** Build `@org/static-docs`, a TypeScript ESM CLI + API that compiles a repo's Markdown into a zero-JS static docs site (left nav, content, right TOC).

**Architecture:** Unified (remark/rehype) parses Markdown → HTML AST with slugged headings, TOC extraction, and `.md`→pretty-URL link rewriting. Pure string renderers build a Tailwind-classed HTML shell. `@tailwindcss/cli` compiles theme CSS against emitted HTML using an explicit `@source` directive. A `dev` command watches and serves with dev-only live reload.

**Tech Stack:** Node 18+ ESM, TypeScript 5.9, tsup, cac, zod 4, unified 11 (remark-parse/gfm/frontmatter/smartypants, remark-rehype, rehype-slug/autolink-headings/pretty-code/stringify), gray-matter, fast-glob, chokidar 4, tailwindcss v4 + @tailwindcss/cli.

---

## File structure

```
package.json, tsconfig.json, tsup.config.ts, .gitignore
bin/static-docs.js
schema.json                      # generated from zod
src/
  index.ts        # export { build } and types
  cli.ts          # cac commands: build, dev
  config.ts       # zod schema, loadConfig, defaults, writeSchema
  types.ts        # shared interfaces
  scanner.ts      # discover .md -> FileNode[]
  router.ts       # FileNode -> pretty routePath + outFile, collisions
  nav.ts          # buildNavTree from FileNode[]
  parser/
    meta.ts       # gray-matter frontmatter
    links.ts      # rehype plugin: ./x.md -> pretty URL
    toc.ts        # rehype plugin: collect headings -> TocEntry[]
    index.ts      # parseMarkdown(source, config) -> { html, toc, frontmatter, assets }
  renderer/
    layout.ts     # htmlShell(...)
    sidebar.ts    # renderSidebar(navTree, currentRoute, basePath)
    toc-panel.ts  # renderToc(tocTree)
    page.ts       # renderPage(ctx)
  theme.ts        # compileTheme(config, outputDir)
  assets.ts       # copyAssets(files, config)
  builder.ts      # build(configPath)
  dev.ts          # dev(configPath, port)
  themes/
    default/theme.css
    minimal/theme.css
  utils/
    fs.ts         # ensureDir, outputFile, exists
    path.ts       # slugify, toRoutePath, resolveInternalLink
```

---

## Task 1: Project bootstrap

**Files:** Create `package.json`, `tsconfig.json`, `tsup.config.ts`, `bin/static-docs.js`, `src/index.ts`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@org/static-docs",
  "version": "0.1.0",
  "description": "Turn Markdown into a zero-JS static documentation site.",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=18" },
  "bin": { "static-docs": "bin/static-docs.js" },
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "bin", "src/themes", "schema.json", "assets"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "schema": "node dist/cli.js schema",
    "docs": "node dist/cli.js build"
  },
  "dependencies": {
    "@tailwindcss/cli": "^4.3.3",
    "tailwindcss": "^4.3.3",
    "cac": "^7.0.0",
    "chokidar": "^4.0.3",
    "fast-glob": "^3.3.3",
    "gray-matter": "^4.0.3",
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
    "unified": "^11.0.5",
    "unist-util-visit": "^5.1.0",
    "hast-util-to-string": "^3.0.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

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

- [ ] **Step 3: Write `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node18",
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
```

- [ ] **Step 4: Write `bin/static-docs.js`**

```js
#!/usr/bin/env node
import("../dist/cli.js");
```

- [ ] **Step 5: Write placeholder `src/index.ts`**

```ts
export const version = "0.1.0";
```

- [ ] **Step 6: Install and verify**

Run: `npm install && npx tsc --noEmit`
Expected: installs cleanly; typecheck passes (no errors).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: bootstrap static-docs package"
```

---

## Task 2: Shared types

**Files:** Create `src/types.ts`.

- [ ] **Step 1: Write `src/types.ts`**

```ts
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

export interface FileNode {
  sourcePath: string;    // absolute path to .md
  relativePath: string;  // relative to repo root, posix
  routePath: string;     // e.g. "/guides/start" or "/" for home
  frontmatter: Frontmatter;
}

export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
  children: TocEntry[];
}

export interface NavNode {
  title: string;
  routePath?: string;  // undefined for pure category folders
  order: number;
  hidden?: boolean;
  children: NavNode[];
}

export interface ParsedMarkdown {
  html: string;
  toc: TocEntry[];
  frontmatter: Frontmatter;
  assets: string[];  // relative asset paths referenced in the md
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: shared types"
```

---

## Task 3: Config (zod schema, loader, JSON Schema)

**Files:** Create `src/config.ts`. Modify `src/index.ts` (re-export later).

- [ ] **Step 1: Write `src/config.ts`**

```ts
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const RouteSchema = z.object({
  path: z.string(),
  source: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  siteName: z.string().default("Documentation"),
  outputDir: z.string().default("./docs-build"),
  basePath: z.string().default("/"),
  theme: z.enum(["default", "minimal"]).default("default"),
  customCss: z.string().optional(),
  routes: z.array(RouteSchema).optional(),
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
  rootDir: string;        // dir containing the config file
  outputDirAbs: string;   // absolute output dir
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
  };
}

export function toJsonSchema(): unknown {
  return z.toJSONSchema(ConfigSchema);
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: config schema and loader"
```

---

## Task 4: Path utils and fs utils

**Files:** Create `src/utils/path.ts`, `src/utils/fs.ts`.

- [ ] **Step 1: Write `src/utils/path.ts`**

```ts
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
  return "/" + p; // "/" for root, "/guides/start" otherwise
}

/** Resolve an internal ./other.md link relative to the current route dir. */
export function resolveInternalLink(
  href: string,
  currentRelDir: string,
  basePath: string,
): string {
  const [pathPart, hash = ""] = href.split("#");
  const cleaned = pathPart.replace(/\\/g, "/");
  // join currentRelDir + cleaned, normalize .. and .
  const segments = (currentRelDir + "/" + cleaned).split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  let joined = stack.join("/");
  joined = joined.replace(/\.md$/i, "");
  joined = joined.replace(/\/(readme|index)$/i, "").replace(/^(readme|index)$/i, "");
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const url = (base + joined).replace(/\/+/g, "/");
  const withSlash = url.endsWith("/") ? url : url + "/";
  return hash ? `${withSlash}#${hash}` : withSlash;
}

export function outFileFor(routePath: string): string {
  const clean = routePath.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/index.html` : "index.html";
}
```

- [ ] **Step 2: Write `src/utils/fs.ts`**

```ts
import { mkdir, writeFile, access, cp } from "node:fs/promises";
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

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: path and fs utils"
```

---

## Task 5: Scanner and Router

**Files:** Create `src/scanner.ts`, `src/router.ts`.

- [ ] **Step 1: Write `src/scanner.ts`**

```ts
import fg from "fast-glob";
import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, Frontmatter } from "./types.js";
import { toRoutePath } from "./utils/path.js";

const DEFAULT_IGNORE = ["node_modules/**", ".git/**", "**/docs-build/**"];

export async function scanRepo(config: ResolvedConfig): Promise<FileNode[]> {
  const ignore = [...DEFAULT_IGNORE, ...config.sidebar.exclude];
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

- [ ] **Step 2: Write `src/router.ts`**

```ts
import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, Frontmatter } from "./types.js";
import { toRoutePath } from "./utils/path.js";
import { scanRepo } from "./scanner.js";

/** Build FileNodes from explicit config.routes, filling gaps with a scan. */
export async function resolveRoutes(config: ResolvedConfig): Promise<FileNode[]> {
  if (!config.routes || config.routes.length === 0) {
    return scanRepo(config);
  }
  const nodes: FileNode[] = [];
  const seen = new Set<string>();
  for (const r of config.routes) {
    const sourcePath = path.resolve(config.rootDir, r.source);
    const relativePath = path
      .relative(config.rootDir, sourcePath)
      .replace(/\\/g, "/");
    const routePath = normalizeRoute(r.path);
    const fileFm = await readFrontmatter(sourcePath);
    const frontmatter: Frontmatter = { ...fileFm, ...(r.meta as Frontmatter) };
    if (seen.has(routePath)) {
      console.warn(`[static-docs] duplicate route "${routePath}" ignored`);
      continue;
    }
    seen.add(routePath);
    nodes.push({ sourcePath, relativePath, routePath, frontmatter });
  }
  return nodes;
}

function normalizeRoute(p: string): string {
  const clean = p.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (clean === "" || clean === "/") return "/";
  return clean.startsWith("/") ? clean : "/" + clean;
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

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: scanner and router"
```

---

## Task 6: Nav tree builder

**Files:** Create `src/nav.ts`.

- [ ] **Step 1: Write `src/nav.ts`**

```ts
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

/** Build a directory-grouped nav tree, honoring navCategory + navOrder + hidden. */
export function buildNavTree(files: FileNode[]): NavNode[] {
  const root: NavNode = { title: "", order: 0, children: [] };

  for (const file of files) {
    if (file.frontmatter.hidden) continue;
    const segs = file.routePath.split("/").filter(Boolean);
    const category = file.frontmatter.navCategory
      ? String(file.frontmatter.navCategory)
      : undefined;

    // Grouping path: explicit navCategory overrides directory grouping.
    const groupSegs = category ? [category] : segs.slice(0, -1);

    let cursor = root;
    let acc = "";
    for (const seg of groupSegs) {
      acc += "/" + seg;
      let child = cursor.children.find(
        (c) => c.title.toLowerCase() === humanize(seg).toLowerCase() && !c.routePath,
      );
      if (!child) {
        child = { title: humanize(seg), order: 0, children: [] };
        cursor.children.push(child);
      }
      cursor = child;
    }

    const order =
      typeof file.frontmatter.navOrder === "number"
        ? file.frontmatter.navOrder
        : file.routePath === "/"
          ? -1
          : 0;

    cursor.children.push({
      title: titleFor(file),
      routePath: file.routePath,
      order,
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

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: nav tree builder"
```

---

## Task 7: Parser — meta, links, toc plugins

**Files:** Create `src/parser/meta.ts`, `src/parser/links.ts`, `src/parser/toc.ts`.

- [ ] **Step 1: Write `src/parser/meta.ts`**

```ts
import matter from "gray-matter";
import type { Frontmatter } from "../types.js";

export function extractMeta(raw: string): { content: string; data: Frontmatter } {
  const parsed = matter(raw);
  return { content: parsed.content, data: parsed.data as Frontmatter };
}
```

- [ ] **Step 2: Write `src/parser/links.ts`** (rehype plugin rewriting `.md` links)

```ts
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
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
        if (EXTERNAL.test(href) || href.startsWith("#") || href.startsWith("mailto:"))
          return;
        if (/\.md(#.*)?$/i.test(href)) {
          node.properties!.href = resolveInternalLink(
            href,
            options.currentRelDir,
            options.basePath,
          );
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

- [ ] **Step 3: Write `src/parser/toc.ts`** (rehype plugin collecting headings)

```ts
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element } from "hast";
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
        text: toString(node),
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

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: parser plugins (meta, links, toc)"
```

---

## Task 8: Parser — unified pipeline

**Files:** Create `src/parser/index.ts`.

- [ ] **Step 1: Write `src/parser/index.ts`**

```ts
import path from "node:path";
import { readFile } from "node:fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import type { ResolvedConfig } from "../config.js";
import type { FileNode, ParsedMarkdown, TocEntry } from "../types.js";
import { extractMeta } from "./meta.js";
import { rehypeRewriteLinks } from "./links.js";
import { rehypeCollectToc, nestToc } from "./toc.js";

export async function parseMarkdown(
  file: FileNode,
  config: ResolvedConfig,
): Promise<ParsedMarkdown> {
  const raw = await readFile(file.sourcePath, "utf8");
  const { data: frontmatter } = extractMeta(raw);

  const tocFlat: TocEntry[] = [];
  const assets: string[] = [];
  const currentRelDir = path.posix.dirname(file.relativePath);

  let processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]);
  if (config.markdown.gfm) processor = processor.use(remarkGfm);
  if (config.markdown.smartypants) processor = processor.use(remarkSmartypants);

  processor = processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypePrettyCode, { theme: config.markdown.shikiTheme, keepBackground: true })
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
  };
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: unified markdown pipeline"
```

---

## Task 9: Renderers

**Files:** Create `src/renderer/sidebar.ts`, `src/renderer/toc-panel.ts`, `src/renderer/layout.ts`, `src/renderer/page.ts`.

- [ ] **Step 1: Write `src/renderer/sidebar.ts`**

```ts
import type { NavNode } from "../types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function href(routePath: string, basePath: string): string {
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const clean = routePath.replace(/^\/+/, "");
  return (base + clean).replace(/\/+/g, "/");
}

export function renderSidebar(
  nav: NavNode[],
  currentRoute: string,
  basePath: string,
): string {
  return `<ul class="nav-list">${nav.map((n) => renderNode(n, currentRoute, basePath)).join("")}</ul>`;
}

function renderNode(node: NavNode, current: string, basePath: string): string {
  if (node.routePath) {
    const active = node.routePath === current;
    return `<li><a class="nav-item${active ? " nav-item-active" : ""}" href="${href(node.routePath, basePath)}">${esc(node.title)}</a></li>`;
  }
  const children = node.children
    .map((c) => renderNode(c, current, basePath))
    .join("");
  return `<li class="nav-group"><span class="nav-group-title">${esc(node.title)}</span><ul class="nav-sublist">${children}</ul></li>`;
}
```

- [ ] **Step 2: Write `src/renderer/toc-panel.ts`**

```ts
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
  return `<li><a class="toc-link${deep}" href="#${entry.slug}">${esc(entry.text)}</a>${children}</li>`;
}
```

- [ ] **Step 3: Write `src/renderer/layout.ts`**

```ts
export interface LayoutData {
  title: string;
  siteName: string;
  description?: string;
  basePath: string;
  contentHtml: string;
  sidebarHtml: string;
  tocHtml: string;
  showToc: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function htmlShell(d: LayoutData): string {
  const base = d.basePath.endsWith("/") ? d.basePath : d.basePath + "/";
  const themeHref = (base + "theme.css").replace(/\/+/g, "/");
  const meta = d.description
    ? `<meta name="description" content="${esc(d.description)}">`
    : "";
  const tocAside = d.showToc && d.tocHtml
    ? `<aside class="hidden xl:block w-64 shrink-0 pl-8 py-12"><div class="sticky top-20"><p class="toc-heading">On this page</p><nav class="toc">${d.tocHtml}</nav></div></aside>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)} | ${esc(d.siteName)}</title>
${meta}
<link rel="stylesheet" href="${themeHref}">
</head>
<body class="bg-white text-slate-900 antialiased">
<header class="sticky top-0 z-50 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
  <details class="lg:hidden">
    <summary class="cursor-pointer select-none rounded p-2 hover:bg-slate-100">☰</summary>
    <div class="absolute left-0 top-full max-h-[80vh] w-72 overflow-y-auto border-b border-r border-slate-200 bg-white p-4 shadow-lg">
      <nav class="site-nav">${d.sidebarHtml}</nav>
    </div>
  </details>
  <a href="${base}" class="text-lg font-semibold tracking-tight">${esc(d.siteName)}</a>
</header>
<div class="mx-auto flex w-full max-w-screen-2xl">
  <aside class="hidden lg:block w-72 shrink-0 border-r border-slate-200 px-4 py-12">
    <div class="sticky top-20"><nav class="site-nav">${d.sidebarHtml}</nav></div>
  </aside>
  <main class="min-w-0 flex-1 px-6 py-12 lg:px-12">
    <article class="prose prose-slate max-w-none">${d.contentHtml}</article>
  </main>
  ${tocAside}
</div>
</body>
</html>`;
}
```

- [ ] **Step 4: Write `src/renderer/page.ts`**

```ts
import type { ResolvedConfig } from "../config.js";
import type { FileNode, NavNode, TocEntry, ParsedMarkdown } from "../types.js";
import { renderSidebar } from "./sidebar.js";
import { renderToc } from "./toc-panel.js";
import { htmlShell } from "./layout.js";

export interface PageContext {
  file: FileNode;
  parsed: ParsedMarkdown;
  navTree: NavNode[];
  config: ResolvedConfig;
}

export function renderPage(ctx: PageContext): string {
  const { file, parsed, navTree, config } = ctx;
  const fm = parsed.frontmatter;
  const title =
    (fm.title && String(fm.title)) ||
    file.routePath.split("/").filter(Boolean).pop() ||
    config.siteName;
  const showToc =
    config.toc.enabled && fm.toc !== false && (parsed.toc.length > 0);

  return htmlShell({
    title: String(title),
    siteName: config.siteName,
    description: fm.description ? String(fm.description) : undefined,
    basePath: config.basePath,
    contentHtml: parsed.html,
    sidebarHtml: renderSidebar(navTree, file.routePath, config.basePath),
    tocHtml: renderToc(parsed.toc),
    showToc,
  });
}
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: html renderers"
```

---

## Task 10: Theme CSS files

**Files:** Create `src/themes/default/theme.css`, `src/themes/default/index.ts`, `src/themes/minimal/theme.css`.

- [ ] **Step 1: Write `src/themes/default/theme.css`**

```css
@import "tailwindcss";

@theme {
  --color-brand-500: #0ea5e9;
  --color-brand-600: #0284c7;
  --font-sans: "Inter", system-ui, sans-serif;
}

/* Site navigation */
.site-nav .nav-list { list-style: none; margin: 0; padding: 0; }
.site-nav .nav-sublist { list-style: none; margin: 0 0 0 0; padding: 0; }
.site-nav .nav-group-title {
  display: block;
  margin: 1rem 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-slate-500);
}
.site-nav .nav-item {
  display: block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-slate-600);
  text-decoration: none;
}
.site-nav .nav-item:hover { background: var(--color-slate-100); color: var(--color-slate-900); }
.site-nav .nav-item-active {
  background: var(--color-brand-500);
  color: #fff;
  font-weight: 600;
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
.toc .toc-list, .toc .toc-sublist { list-style: none; margin: 0; padding: 0; }
.toc .toc-sublist { margin-left: 0.75rem; }
.toc .toc-link {
  display: block;
  padding: 0.15rem 0;
  font-size: 0.85rem;
  color: var(--color-slate-500);
  text-decoration: none;
  border-left: 2px solid transparent;
  padding-left: 0.5rem;
}
.toc .toc-link:hover { color: var(--color-brand-600); border-left-color: var(--color-brand-500); }
.toc .toc-link-deep { font-size: 0.8rem; color: var(--color-slate-400); }
```

- [ ] **Step 2: Write `src/themes/default/index.ts`**

```ts
export const meta = { name: "default", description: "Clean Tailwind docs theme" };
```

- [ ] **Step 3: Write `src/themes/minimal/theme.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: system-ui, sans-serif;
}

.site-nav .nav-list, .site-nav .nav-sublist { list-style: none; margin: 0; padding: 0; }
.site-nav .nav-item { display: block; padding: 0.2rem 0; color: var(--color-slate-700); text-decoration: none; font-size: 0.9rem; }
.site-nav .nav-item:hover { text-decoration: underline; }
.site-nav .nav-item-active { font-weight: 700; }
.site-nav .nav-group-title { display:block; margin-top: 0.75rem; font-weight: 600; font-size: 0.8rem; }
.toc-heading { font-weight: 600; font-size: 0.8rem; margin-bottom: 0.5rem; }
.toc .toc-list, .toc .toc-sublist { list-style: none; margin: 0; padding: 0; }
.toc .toc-sublist { margin-left: 0.75rem; }
.toc .toc-link { display: block; padding: 0.1rem 0; font-size: 0.85rem; color: var(--color-slate-600); text-decoration: none; }
.toc .toc-link:hover { text-decoration: underline; }
```

- [ ] **Step 4: Commit** (no typecheck needed for CSS, but run anyway)

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: default and minimal themes"
```

---

## Task 11: Theme compiler and asset copier

**Files:** Create `src/theme.ts`, `src/assets.ts`.

- [ ] **Step 1: Write `src/theme.ts`**

Compiles theme CSS with the Tailwind v4 CLI. Uses an explicit `@source` pointing
at the emitted HTML (needed because `outputDir` is gitignored and v4 auto-detect
skips gitignored paths). Resolves the theme file from the installed package or
local `src/themes` during dev.

```ts
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { ResolvedConfig } from "./config.js";
import { outputFile, exists } from "./utils/fs.js";

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
  const pkg = require("@tailwindcss/cli/package.json") as { bin?: Record<string, string> | string };
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
}

function runTailwind(input: string, output: string): Promise<void> {
  const bin = tailwindBin();
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [bin, "-i", input, "-o", output, "--minify"],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Tailwind CLI exited with code ${code}`)),
    );
  });
}
```

- [ ] **Step 2: Write `src/assets.ts`**

```ts
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

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
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: theme compiler and asset copier"
```

---

## Task 12: Builder orchestrator

**Files:** Create `src/builder.ts`. Modify `src/index.ts`.

- [ ] **Step 1: Write `src/builder.ts`**

```ts
import path from "node:path";
import { rm } from "node:fs/promises";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { resolveRoutes } from "./router.js";
import { buildNavTree } from "./nav.js";
import { parseMarkdown } from "./parser/index.js";
import { renderPage } from "./renderer/page.js";
import { compileTheme } from "./theme.js";
import { copyAssets } from "./assets.js";
import { outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";
import type { FileNode, ParsedMarkdown } from "./types.js";

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

  const rendered: { file: FileNode; parsed: ParsedMarkdown }[] = [];
  for (const file of files) {
    const parsed = await parseMarkdown(file, config);
    const html = renderPage({ file, parsed, navTree, config });
    const outPath = path.join(config.outputDirAbs, outFileFor(file.routePath));
    await outputFile(outPath, html);
    rendered.push({ file, parsed });
  }

  await copyAssets(rendered, config);
  await compileTheme(config);

  console.log(`[static-docs] built ${rendered.length} page(s) → ${config.outputDir}`);
  return { config, pages: rendered.length };
}
```

- [ ] **Step 2: Rewrite `src/index.ts`**

```ts
export { build } from "./builder.js";
export type { BuildResult } from "./builder.js";
export { loadConfig, ConfigSchema, toJsonSchema } from "./config.js";
export type { Config, ResolvedConfig } from "./config.js";
export type { FileNode, NavNode, TocEntry, Frontmatter, ParsedMarkdown } from "./types.js";
export const version = "0.1.0";
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: build orchestrator"
```

---

## Task 13: Dev server

**Files:** Create `src/dev.ts`.

The dev server rebuilds on change and serves `outputDir`. It injects a small
live-reload script **only in responses served by the dev server** — the emitted
HTML files on disk stay JS-free. Live reload uses Server-Sent Events.

- [ ] **Step 1: Write `src/dev.ts`**

```ts
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
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

export async function dev(
  configPath = "static-docs.config.json",
  port = 4321,
): Promise<void> {
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

  const watcher = chokidar.watch(
    ["**/*.md", path.basename(configPath), config.customCss].filter(Boolean) as string[],
    { cwd: config.rootDir, ignoreInitial: true, ignored: ["**/node_modules/**", "**/docs-build/**", "**/.git/**"] },
  );
  watcher.on("all", async () => {
    await rebuild();
    for (const res of clients) res.write("data: reload\n\n");
  });
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: dev server with live reload"
```

---

## Task 14: CLI

**Files:** Create `src/cli.ts`. Create `schema.json` via command later.

- [ ] **Step 1: Write `src/cli.ts`**

```ts
import { cac } from "cac";
import { writeFile } from "node:fs/promises";
import { build } from "./builder.js";
import { dev } from "./dev.js";
import { toJsonSchema } from "./config.js";

const cli = cac("static-docs");

cli
  .command("build", "Build the static docs site")
  .option("--config <path>", "Path to config file", { default: "static-docs.config.json" })
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
  .option("--config <path>", "Path to config file", { default: "static-docs.config.json" })
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
cli.version("0.1.0");
cli.parse();
```

- [ ] **Step 2: Build the package**

Run: `npm run build`
Expected: tsup emits `dist/index.js`, `dist/cli.js`, and `.d.ts` files with no errors.

- [ ] **Step 3: Generate schema.json**

Run: `node dist/cli.js schema`
Expected: writes `schema.json`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: cli (build, dev, schema)"
```

---

## Task 15: Dogfood — build the project's own docs

**Files:** Create `static-docs.config.json`, `README.md`, `docs/getting-started/install.md`, `docs/guides/config.md`.

- [ ] **Step 1: Write `static-docs.config.json`**

```json
{
  "$schema": "./schema.json",
  "siteName": "StaticDocs",
  "outputDir": "./docs-build",
  "basePath": "/",
  "theme": "default",
  "sidebar": { "auto": true, "collapsedDepth": 1, "exclude": ["docs/superpowers/**"] },
  "toc": { "enabled": true, "minDepth": 2, "maxDepth": 4 },
  "markdown": { "gfm": true, "smartypants": true }
}
```

- [ ] **Step 2: Write `README.md`** with a top-level `# StaticDocs`, an intro paragraph, an `## Install` section with a fenced `bash` code block, a `## Usage` section, and a GFM table. (Real content describing the tool — no placeholders.)

- [ ] **Step 3: Write `docs/getting-started/install.md`** with frontmatter:

```md
---
title: Installation
description: Install and set up StaticDocs
navCategory: Getting Started
navOrder: 1
---

# Installation

## Requirements

## Install via NPM

## Next Steps

See the [configuration guide](../guides/config.md).
```

Fill each section with a sentence or two of real content and a `bash` code block under "Install via NPM".

- [ ] **Step 4: Write `docs/guides/config.md`** with frontmatter (`title: Configuration`, `navCategory: Guides`, `navOrder: 1`), an `# Configuration` heading, several `##`/`###` subheadings covering config keys, and a `json` code block. Include a link back: `[installation](../getting-started/install.md)`.

- [ ] **Step 5: Run the build**

Run: `node dist/cli.js build`
Expected: logs "built N page(s)"; exit 0.

- [ ] **Step 6: Verify output**

Run: `ls -R docs-build`
Expected files exist: `docs-build/index.html`, `docs-build/getting-started/install/index.html`, `docs-build/guides/config/index.html`, `docs-build/theme.css`.

Spot-check: `theme.css` is non-empty; `install/index.html` contains a `nav-item-active` link and a right-hand `toc` list; internal `.md` links were rewritten to `/guides/config/` style (grep for `.md"` should find no internal doc links in emitted HTML).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "docs: dogfood build config and docs"
```

---

## Task 16: README for the package + final verification

**Files:** Ensure `README.md` documents install, `build`/`dev`/`schema` commands, config reference, and frontmatter keys.

- [ ] **Step 1: Verify dev server boots**

Run: `node dist/cli.js dev --port 4399 &` then `sleep 2 && curl -s -o /dev/null -w "%{http_code}" http://localhost:4399/` then kill the process.
Expected: `200`. Emitted `docs-build/index.html` on disk contains **no** `<script>` (JS only injected by dev server responses).

- [ ] **Step 2: Full clean build**

Run: `rm -rf dist docs-build && npm run build && node dist/cli.js build`
Expected: no errors; output regenerated.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "docs: package README and final polish"
```

---

## Self-review notes

- Spec coverage: scanner (T5), router (T5), parser+TOC+links (T7-8), renderers (T9), themes (T10), theme compile via Tailwind CLI with `@source` (T11), asset copy (T11), builder (T12), dev server zero-JS output (T13), CLI + schema.json (T14), frontmatter/meta (T7-8, T9), config (T3), dogfood (T15-16). All SRD §5/§6 modules covered.
- Type consistency: `FileNode`, `NavNode`, `TocEntry`, `ParsedMarkdown`, `ResolvedConfig`, `parseMarkdown(file, config)`, `renderPage(ctx)`, `compileTheme(config)`, `copyAssets(items, config)`, `build(configPath)` used consistently across tasks.
- Zero-JS: only `dev.ts` injects a script, into served responses, never to disk.
