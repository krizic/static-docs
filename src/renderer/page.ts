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
  });
}
