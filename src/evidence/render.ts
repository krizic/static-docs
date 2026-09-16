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
