---
title: Web-Component Routes Plan
description: Implementation plan for attaching pre-built web components to routes.
hidden: true
---

# Web-Component Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users declare routes in `static-docs.config.json` that mount a pre-built web component filling the page content area, listed in the sidebar alongside Markdown pages.

**Architecture:** Component routes are validated in config, converted into ordinary `FileNode`s carrying a synthetic frontmatter plus a `component` spec, then flow through the existing nav tree unchanged. The build branches on `file.component` to skip Markdown parsing, render a full-bleed shell, and copy the bundle next to the route's `index.html`.

**Tech Stack:** TypeScript (ESM, NodeNext), Zod v4 for config schema, Tailwind v4 for themes, tsup for bundling, cac for the CLI. No test runner is configured — verification is via `pnpm typecheck`, `pnpm build`, and building a scratch fixture site.

## Global Constraints

- Node `>=18`, ESM only. All relative imports MUST use the `.js` extension (NodeNext resolution).
- Package manager is `pnpm`. Build with `pnpm build` (runs `tsup` then `tsc --emitDeclarationOnly --declaration`); typecheck with `pnpm typecheck`.
- Log prefix for all console output is `[static-docs] `.
- All user-supplied strings interpolated into HTML MUST pass through the existing `esc()` helper in the module doing the interpolation.
- `componentRoutes` is additive: when absent or empty, build output MUST be unchanged.
- Component bundles are single self-contained ES modules. No code-splitting, no CDN URLs, no attributes/props passed from config.
- Component routes have no table of contents.
- There is no test runner in this repo. "Run the tests" means running the typecheck/build/fixture commands given verbatim in each task.

---

### Task 1: Config schema for `componentRoutes`

**Files:**
- Modify: `src/config.ts`
- Test: `/tmp/md2web-check/task1.mjs` (throwaway verification script)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ComponentRouteSchema` (Zod object) exported from `src/config.ts`
  - `ComponentRoute` type = `z.infer<typeof ComponentRouteSchema>` with fields `path: string`, `tag: string`, `script: string`, `title?: string`, `navCategory?: string`, `navOrder?: number`, `hidden: boolean` (defaulted to `false`)
  - `ConfigSchema` gains `componentRoutes?: ComponentRoute[]`
  - `isValidCustomElementTag(tag: string): boolean` exported from `src/config.ts`

- [ ] **Step 1: Add the tag validator and schema**

In `src/config.ts`, directly below the existing `RouteSchema` declaration, add:

```ts
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
      "must be a valid custom element name: lowercase, containing a hyphen (e.g. \"my-workbench\")",
  }),
  script: z.string(),
  title: z.string().optional(),
  navCategory: z.string().optional(),
  navOrder: z.number().optional(),
  hidden: z.boolean().default(false),
});

export type ComponentRoute = z.infer<typeof ComponentRouteSchema>;
```

- [ ] **Step 2: Register it on `ConfigSchema`**

In `src/config.ts`, inside the `ConfigSchema` object literal, add the new key immediately after the existing `routes` line so the two routing keys sit together:

```ts
  routes: z.array(RouteSchema).optional(),
  componentRoutes: z.array(ComponentRouteSchema).optional(),
```

- [ ] **Step 3: Verify it typechecks and builds**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 4: Verify the schema accepts and rejects the right shapes**

Create the throwaway script `/tmp/md2web-check/task1.mjs`. `ConfigSchema` is already exported from `src/index.ts`, and tsup emits only `dist/index.js` and `dist/cli.js`, so import from `dist/index.js`:

```js
import { ConfigSchema } from "/Users/vkrizic/src/md2web/dist/index.js";

const good = ConfigSchema.safeParse({
  componentRoutes: [{ path: "/wb", tag: "my-wb", script: "./a.js" }],
});
console.log("good ok:", good.success, "| hidden default:", good.data?.componentRoutes?.[0]?.hidden);

const badTag = ConfigSchema.safeParse({
  componentRoutes: [{ path: "/wb", tag: "nohyphen", script: "./a.js" }],
});
console.log("bad tag rejected:", !badTag.success);

const inject = ConfigSchema.safeParse({
  componentRoutes: [{ path: "/wb", tag: "a-b><script>", script: "./a.js" }],
});
console.log("injection rejected:", !inject.success);

const empty = ConfigSchema.safeParse({});
console.log("absent ok:", empty.success, "| value:", empty.data?.componentRoutes);
```

Run: `mkdir -p /tmp/md2web-check && node /tmp/md2web-check/task1.mjs`
Expected output:
```
good ok: true | hidden default: false
bad tag rejected: true
injection rejected: true
absent ok: true | value: undefined
```

- [ ] **Step 5: Regenerate the JSON schema**

Run: `pnpm run schema`
Then confirm the new key landed: `grep -c componentRoutes schema.json`
Expected: a count of `1` or greater.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts schema.json
git commit -m "feat(config): add componentRoutes schema with custom element tag validation"
```

---

### Task 2: `ComponentSpec` type and router support

**Files:**
- Modify: `src/types.ts`
- Modify: `src/router.ts`
- Test: `/tmp/md2web-check/fixture/` (scratch fixture site) + `/tmp/md2web-check/task2.mjs`

**Interfaces:**
- Consumes: `ComponentRoute`, `ComponentRouteSchema` from Task 1 (`src/config.ts`).
- Produces:
  - `ComponentSpec` interface exported from `src/types.ts`:
    `{ tag: string; scriptSourceAbs: string; scriptFileName: string }`
  - `FileNode.component?: ComponentSpec`
  - `resolveRoutes(config: ResolvedConfig): Promise<FileNode[]>` — same signature as today, now also returning component nodes.

- [ ] **Step 1: Add the types**

In `src/types.ts`, add above the `FileNode` interface:

```ts
export interface ComponentSpec {
  tag: string; // custom element tag to render
  scriptSourceAbs: string; // absolute path to the pre-built bundle
  scriptFileName: string; // file name emitted next to the route's index.html
}
```

Then add the optional field to `FileNode`. `sourcePath` is `""` for component routes:

```ts
export interface FileNode {
  sourcePath: string; // absolute path to .md; "" for component routes
  relativePath: string; // relative to repo root, posix
  routePath: string; // e.g. "/guides/start" or "/" for home
  frontmatter: Frontmatter;
  component?: ComponentSpec; // set for web-component routes
}
```

- [ ] **Step 2: Restructure `resolveRoutes`**

`resolveRoutes` currently early-returns `scanRepo(config)` when `config.routes` is empty, which would silently drop component routes. Replace the whole `resolveRoutes` function in `src/router.ts` with:

```ts
/** Build FileNodes from config routes and componentRoutes, else scan the repo. */
export async function resolveRoutes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  const seen = new Set<string>();

  const markdownNodes =
    config.routes && config.routes.length > 0
      ? await markdownRouteNodes(config)
      : await scanRepo(config);

  for (const node of markdownNodes) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  for (const node of componentRouteNodes(config)) {
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

async function markdownRouteNodes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.routes ?? []) {
    const sourcePath = path.resolve(config.rootDir, r.source);
    const relativePath = path
      .relative(config.rootDir, sourcePath)
      .replace(/\\/g, "/");
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
```

Note the duplicate-route warning moved out of the markdown loop into `claim`, so it now covers both kinds of route. Keep the existing `normalizeRoute` and `readFrontmatter` helpers as they are.

- [ ] **Step 3: Build the component nodes**

Append to `src/router.ts`:

```ts
function componentRouteNodes(config: ResolvedConfig): FileNode[] {
  return (config.componentRoutes ?? []).map((r) => {
    const routePath = normalizeRoute(r.path);
    const scriptSourceAbs = path.resolve(config.rootDir, r.script);
    return {
      sourcePath: "",
      relativePath: path
        .relative(config.rootDir, scriptSourceAbs)
        .replace(/\\/g, "/"),
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
    };
  });
}

function defaultTitle(routePath: string): string {
  const last = routePath.split("/").filter(Boolean).pop() ?? "Home";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
```

No new type import is needed — `FileNode` and `Frontmatter` are already imported in this file, and `component` is satisfied structurally.

- [ ] **Step 4: Export `resolveRoutes` and `ComponentSpec` for verification**

tsup builds only `src/index.ts` and `src/cli.ts` with `splitting: false`, so `dist/router.js` does not exist and internals must be reached through `dist/index.js`. In `src/index.ts`, add:

```ts
export { resolveRoutes } from "./router.js";
```

and add `ComponentSpec` to the existing type export block from `./types.js`:

```ts
export type {
  FileNode,
  NavNode,
  TocEntry,
  Frontmatter,
  ParsedMarkdown,
  ComponentSpec,
} from "./types.js";
```

- [ ] **Step 5: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 6: Create the scratch fixture used by this and later tasks**

```bash
mkdir -p /tmp/md2web-check/fixture/dist
cd /tmp/md2web-check/fixture
```

Create `/tmp/md2web-check/fixture/README.md`:

```markdown
---
title: Home
navOrder: 0
---

# Fixture Home

Some body text.
```

Create `/tmp/md2web-check/fixture/dist/workbench.js`:

```js
class MyWorkbench extends HTMLElement {
  connectedCallback() {
    this.innerHTML = "<h1>Workbench mounted</h1>";
  }
}
customElements.define("my-workbench", MyWorkbench);
```

Create `/tmp/md2web-check/fixture/static-docs.config.json`:

```json
{
  "siteName": "Fixture",
  "outputDir": "./out",
  "componentRoutes": [
    {
      "path": "/workbench",
      "tag": "my-workbench",
      "script": "./dist/workbench.js",
      "title": "Workbench",
      "navOrder": 5
    }
  ]
}
```

- [ ] **Step 7: Verify the router emits a component node**

Create `/tmp/md2web-check/task2.mjs`:

```js
import { loadConfig, resolveRoutes } from "/Users/vkrizic/src/md2web/dist/index.js";

const cfg = await loadConfig("/tmp/md2web-check/fixture/static-docs.config.json");
const nodes = await resolveRoutes(cfg);
const wb = nodes.find((n) => n.routePath === "/workbench");
console.log("found:", !!wb);
console.log("tag:", wb?.component?.tag);
console.log("fileName:", wb?.component?.scriptFileName);
console.log("title:", wb?.frontmatter.title);
console.log("markdown routes still present:", nodes.some((n) => n.sourcePath !== ""));
```

Run: `node /tmp/md2web-check/task2.mjs`
Expected output:
```
found: true
tag: my-workbench
fileName: workbench.js
title: Workbench
markdown routes still present: true
```

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/router.ts src/index.ts
git commit -m "feat(router): resolve componentRoutes into FileNodes with a component spec"
```

---

### Task 3: Validate component routes at build time

**Files:**
- Modify: `src/router.ts`

**Interfaces:**
- Consumes: `componentRouteNodes` from Task 2.
- Produces: `resolveRoutes` now throws `Error` for a missing script file. Message format:
  `Component route "/workbench": script not found: /abs/path/dist/workbench.js`

- [ ] **Step 1: Make component node creation async and check the file exists**

Tag validity is already enforced by Zod in Task 1, so only the file check is needed here. In `src/router.ts`, add the import:

```ts
import { exists } from "./utils/fs.js";
```

Then change `componentRouteNodes` to async and add the check. Replace the `return (config.componentRoutes ?? []).map((r) => {` opening and its closing `});` with an explicit loop:

```ts
async function componentRouteNodes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.componentRoutes ?? []) {
    const routePath = normalizeRoute(r.path);
    const scriptSourceAbs = path.resolve(config.rootDir, r.script);
    if (!(await exists(scriptSourceAbs))) {
      throw new Error(
        `Component route "${routePath}": script not found: ${scriptSourceAbs}`,
      );
    }
    nodes.push({
      sourcePath: "",
      relativePath: path
        .relative(config.rootDir, scriptSourceAbs)
        .replace(/\\/g, "/"),
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
```

- [ ] **Step 2: Await it in `resolveRoutes`**

In `resolveRoutes`, change the component loop line to await the call:

```ts
  for (const node of await componentRouteNodes(config)) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
```

- [ ] **Step 3: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 4: Verify the happy path still resolves**

Run: `node /tmp/md2web-check/task2.mjs`
Expected: unchanged output — `found: true`, `tag: my-workbench`, `fileName: workbench.js`, `title: Workbench`, `markdown routes still present: true`.

- [ ] **Step 5: Verify the missing-script failure**

```bash
cd /tmp/md2web-check/fixture
mv dist/workbench.js dist/workbench.js.bak
node /Users/vkrizic/src/md2web/dist/cli.js build --config static-docs.config.json; echo "exit=$?"
mv dist/workbench.js.bak dist/workbench.js
```

Expected: output contains `[static-docs] Component route "/workbench": script not found:` followed by the absolute path, and `exit=1`.

- [ ] **Step 6: Verify the invalid-tag failure**

```bash
cd /tmp/md2web-check/fixture
sed -i '' 's/"my-workbench"/"nohyphen"/' static-docs.config.json
node /Users/vkrizic/src/md2web/dist/cli.js build --config static-docs.config.json; echo "exit=$?"
sed -i '' 's/"nohyphen"/"my-workbench"/' static-docs.config.json
```

Expected: output contains `Invalid config:` and a line mentioning `componentRoutes.0.tag` with the custom-element message, and `exit=1`.

- [ ] **Step 7: Commit**

```bash
git add src/router.ts
git commit -m "feat(router): fail the build when a component route script is missing"
```

---

### Task 4: Full-bleed layout and component page renderer

**Files:**
- Modify: `src/renderer/layout.ts`
- Modify: `src/renderer/page.ts`

**Interfaces:**
- Consumes: `ComponentSpec` (Task 2), `FileNode.component` (Task 2).
- Produces:
  - `LayoutData` gains `fullBleed?: boolean` and `bodyScript?: string`.
  - `renderComponentPage(ctx: ComponentPageContext): string` exported from `src/renderer/page.ts`, where
    `ComponentPageContext = { file: FileNode; navTree: NavNode[]; config: ResolvedConfig; assetVersion?: string }`.

- [ ] **Step 1: Extend `LayoutData`**

In `src/renderer/layout.ts`, add the two optional fields to the `LayoutData` interface, after `version`:

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
  assetVersion?: string;
  mermaid?: boolean;
  version?: string;
  fullBleed?: boolean; // content fills the main column instead of a prose article
  bodyScript?: string; // pre-rendered <script> tag appended before </body>
}
```

- [ ] **Step 2: Render the full-bleed main and the body script**

In `htmlShell`, immediately after the `versionBadge` declaration, add:

```ts
  const mainClass = d.fullBleed
    ? "min-w-0 flex-1 flex flex-col"
    : "min-w-0 flex-1 px-6 py-12 md:px-12";
  const mainInner = d.fullBleed
    ? d.contentHtml
    : `<article class="prose prose-slate max-w-none">${d.contentHtml}</article>`;
```

Then replace the existing `<main>` block in the template literal:

```html
  <main class="min-w-0 flex-1 px-6 py-12 md:px-12">
    <article class="prose prose-slate max-w-none">${d.contentHtml}</article>
  </main>
```

with:

```html
  <main class="${mainClass}">${mainInner}</main>
```

Finally, append the body script by replacing the `${mermaidScript}` line near the end of the template with:

```html
${mermaidScript}
${d.bodyScript ?? ""}
```

- [ ] **Step 3: Add `renderComponentPage`**

In `src/renderer/page.ts`, add the `esc` helper and the new renderer. The file currently imports `FileNode`, `NavNode`, `ParsedMarkdown` from `../types.js`; that import stays as is.

```ts
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
  if (!spec) throw new Error(`renderComponentPage: ${file.routePath} has no component`);

  const title = String(file.frontmatter.title ?? config.siteName);
  // The bundle is emitted next to this page's index.html, so a relative src
  // works under any basePath without rewriting.
  const src =
    "./" + spec.scriptFileName + (ctx.assetVersion ? `?v=${ctx.assetVersion}` : "");

  return htmlShell({
    title,
    siteName: config.siteName,
    description: file.frontmatter.description
      ? String(file.frontmatter.description)
      : undefined,
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

`spec.tag` is not escaped because Task 1's Zod refinement already restricts it to `[a-z0-9-]`; escaping it would corrupt a valid tag. `src` is escaped because the file name comes from an arbitrary path.

- [ ] **Step 4: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/layout.ts src/renderer/page.ts
git commit -m "feat(renderer): full-bleed layout and component page renderer"
```

---

### Task 5: Wire component routes into the build

**Files:**
- Modify: `src/builder.ts`
- Modify: `src/assets.ts`

**Interfaces:**
- Consumes: `renderComponentPage` (Task 4), `FileNode.component` (Task 2), `outFileFor` (existing, `src/utils/path.ts`), `copyFileEnsured` (existing, `src/utils/fs.ts`).
- Produces: `copyComponentScripts(files: FileNode[], config: ResolvedConfig): Promise<void>` exported from `src/assets.ts`.

- [ ] **Step 1: Add the bundle copier**

In `src/assets.ts`, append:

```ts
/** Copy each component route's bundle next to that route's index.html. */
export async function copyComponentScripts(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.component) continue;
    const outDir = path.dirname(
      path.join(config.outputDirAbs, outFileFor(file.routePath)),
    );
    await copyFileEnsured(
      file.component.scriptSourceAbs,
      path.join(outDir, file.component.scriptFileName),
    );
  }
}
```

The existing imports in this file (`path`, `ResolvedConfig`, `FileNode`, `copyFileEnsured`, `outFileFor`) already cover everything needed.

- [ ] **Step 2: Branch the build loop**

In `src/builder.ts`, add `renderComponentPage` to the existing page import and `copyComponentScripts` to the assets import:

```ts
import { renderPage, renderComponentPage } from "./renderer/page.js";
import { copyAssets, copyMermaidRuntime, copyComponentScripts } from "./assets.js";
```

Then replace the build loop:

```ts
  for (const file of files) {
    const parsed = await parseMarkdown(file, config);
    const html = renderPage({ file, parsed, navTree, config, assetVersion });
    const outPath = path.join(config.outputDirAbs, outFileFor(file.routePath));
    await outputFile(outPath, html);
    rendered.push({ file, parsed });
  }
```

with:

```ts
  for (const file of files) {
    const outPath = path.join(config.outputDirAbs, outFileFor(file.routePath));
    if (file.component) {
      await outputFile(
        outPath,
        renderComponentPage({ file, navTree, config, assetVersion }),
      );
      continue;
    }
    const parsed = await parseMarkdown(file, config);
    const html = renderPage({ file, parsed, navTree, config, assetVersion });
    await outputFile(outPath, html);
    rendered.push({ file, parsed });
  }
```

Component nodes never enter `rendered`, so `copyAssets` and the Mermaid check keep operating only on Markdown pages and need no changes.

- [ ] **Step 3: Copy the bundles**

In `src/builder.ts`, directly after the existing `await copyAssets(rendered, config);` line, add:

```ts
  await copyComponentScripts(files, config);
```

- [ ] **Step 4: Fix the page count log**

The final log uses `rendered.length`, which now undercounts. Change it to use `files.length`:

```ts
  console.log(
    `[static-docs] built ${files.length} page(s) → ${config.outputDir}`,
  );
  return { config, pages: files.length };
```

- [ ] **Step 5: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 6: Build the fixture and inspect the output**

```bash
cd /tmp/md2web-check/fixture
rm -rf out
node /Users/vkrizic/src/md2web/dist/cli.js build --config static-docs.config.json
find out -type f | sort
```

Expected: the listing includes `out/workbench/index.html`, `out/workbench/workbench.js`, `out/index.html`, and `out/theme.css`.

- [ ] **Step 7: Verify the emitted markup**

```bash
cd /tmp/md2web-check/fixture
grep -o '<my-workbench></my-workbench>' out/workbench/index.html
grep -o 'type="module" src="./workbench.js[^"]*"' out/workbench/index.html
grep -o 'class="wb-host"' out/workbench/index.html
grep -c 'On this page' out/workbench/index.html
grep -o 'href="/workbench"' out/workbench/index.html | head -1
```

Expected: the first three greps each print one match, the TOC count prints `0`, and the sidebar link match prints `href="/workbench"`.

- [ ] **Step 8: Verify the additive guarantee**

```bash
cd /tmp/md2web-check/fixture
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('static-docs.config.json'));delete c.componentRoutes;fs.writeFileSync('no-comp.json',JSON.stringify(c,null,2))"
rm -rf out
node /Users/vkrizic/src/md2web/dist/cli.js build --config no-comp.json
find out -type f | sort
```

Expected: the listing contains only `out/index.html` and `out/theme.css` — no `workbench/` directory — confirming component routes are purely additive.

Restore the component build before continuing:

```bash
cd /tmp/md2web-check/fixture
rm -rf out && node /Users/vkrizic/src/md2web/dist/cli.js build --config static-docs.config.json
```

- [ ] **Step 9: Commit**

```bash
git add src/builder.ts src/assets.ts
git commit -m "feat(build): render component routes and copy their bundles"
```

---

### Task 6: Theme styles for the component host

**Files:**
- Modify: `src/themes/default/theme.css`
- Modify: `src/themes/minimal/theme.css`

**Interfaces:**
- Consumes: the `.wb-host` class emitted by `renderComponentPage` (Task 4) and the `flex flex-col` main from Task 4.
- Produces: `.wb-host` styling in both themes.

- [ ] **Step 1: Add the rule to the default theme**

Append to `src/themes/default/theme.css`:

```css
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

- [ ] **Step 2: Add the same rule to the minimal theme**

Append the identical block to `src/themes/minimal/theme.css`. The two theme files are independent stylesheets, so the duplication is intentional and matches how `.toc-heading` and `.site-version` are already defined in both.

- [ ] **Step 3: Rebuild the fixture and confirm the class survives Tailwind compilation**

```bash
cd /tmp/md2web-check/fixture
rm -rf out
node /Users/vkrizic/src/md2web/dist/cli.js build --config static-docs.config.json
grep -c 'wb-host' out/theme.css
```

Expected: a count of `1` or greater. If it prints `0`, the custom CSS was dropped — confirm the rule was appended to `src/themes/default/theme.css` and not inside an `@theme` block.

- [ ] **Step 4: Visually verify in a browser**

```bash
cd /tmp/md2web-check/fixture
node /Users/vkrizic/src/md2web/dist/cli.js dev --config static-docs.config.json --port 4399
```

Open `http://localhost:4399/workbench/`. Expected: the sidebar and header are present, "Workbench mounted" renders in the content area, and the host div fills the column height. Stop the server with Ctrl-C when done.

- [ ] **Step 5: Commit**

```bash
git add src/themes/default/theme.css src/themes/minimal/theme.css
git commit -m "feat(themes): add .wb-host full-height styling for component routes"
```

---

### Task 7: Dev server watches component bundles

**Files:**
- Modify: `src/dev.ts`

**Interfaces:**
- Consumes: `config.componentRoutes` (Task 1).
- Produces: no new exports; `dev()` keeps its signature.

- [ ] **Step 1: Add component scripts to the watch list**

In `src/dev.ts`, replace:

```ts
  const watchTargets = ["**/*.md", path.basename(configPath)];
  if (config.customCss) watchTargets.push(config.customCss);
```

with:

```ts
  const watchTargets = ["**/*.md", path.basename(configPath)];
  if (config.customCss) watchTargets.push(config.customCss);
  for (const r of config.componentRoutes ?? []) {
    watchTargets.push(r.script);
  }
```

Chokidar is created with `cwd: config.rootDir`, and `script` paths are already config-relative, so they resolve correctly without further work.

- [ ] **Step 2: Verify typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: both succeed with no errors.

- [ ] **Step 3: Verify live reload on bundle change**

```bash
cd /tmp/md2web-check/fixture
node /Users/vkrizic/src/md2web/dist/cli.js dev --config static-docs.config.json --port 4399
```

With the server running, open `http://localhost:4399/workbench/` in a browser, then in a second terminal run:

```bash
cd /tmp/md2web-check/fixture
sed -i '' 's/Workbench mounted/Workbench reloaded/' dist/workbench.js
```

Expected: the dev-server terminal logs a rebuild and the browser reloads showing "Workbench reloaded". Restore with `sed -i '' 's/Workbench reloaded/Workbench mounted/' dist/workbench.js` and stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/dev.ts
git commit -m "feat(dev): watch component route bundles for live reload"
```

---

### Task 8: Documentation

**Files:**
- Modify: `docs/guides/config.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the final config surface from Tasks 1-7.
- Produces: user-facing docs. Nothing depends on this task.

- [ ] **Step 1: Document `componentRoutes` in the config guide**

In `docs/guides/config.md`, insert a new subsection at the end of the `## Routing` section, immediately after the "Explicit routes" JSON block and before `## Sidebar`:

```markdown
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
```

- [ ] **Step 2: Mention the feature in the README**

In `README.md`, add one bullet to the `## Features` list, after the "Tailwind v4 themes" bullet:

```markdown
- **Web-component routes** — mount a pre-built custom element on its own page.
```

- [ ] **Step 3: Verify the docs site still builds**

Run: `pnpm build && pnpm run schema`
Expected: both succeed. `git diff --stat schema.json` should show no changes, since Task 1 already regenerated it.

- [ ] **Step 4: Commit**

```bash
git add docs/guides/config.md README.md
git commit -m "docs: document componentRoutes"
```

- [ ] **Step 5: Clean up the scratch fixture**

```bash
rm -rf /tmp/md2web-check
```

---

## Verification Summary

After all tasks, the following should hold:

| Check | Command | Expected |
|-------|---------|----------|
| Types | `pnpm typecheck` | clean |
| Build | `pnpm build` | clean |
| Schema | `grep -c componentRoutes schema.json` | `>= 1` |
| Additive | fixture build with `componentRoutes` removed | no `workbench/` directory emitted |
| Missing script | fixture build with the bundle renamed | exits 1 with the `script not found` message |
| Invalid tag | fixture build with `tag: "nohyphen"` | exits 1 with the `Invalid config:` message |
