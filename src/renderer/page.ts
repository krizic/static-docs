import type { ResolvedConfig } from "../config.js";
import type { FileNode, NavNode, ParsedMarkdown } from "../types.js";
import { renderSidebar } from "./sidebar.js";
import { renderToc } from "./toc-panel.js";
import { htmlShell } from "./layout.js";

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
  const showToc =
    config.toc.enabled && fm.toc !== false && parsed.toc.length > 0;

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
  // The bundle is emitted next to this page's index.html, so a relative src
  // works under any basePath without rewriting.
  const src =
    "./" +
    spec.scriptFileName +
    (ctx.assetVersion ? `?v=${ctx.assetVersion}` : "");

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
