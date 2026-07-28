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
  const base = d.basePath.endsWith("/") ? d.basePath : d.basePath + "/";
  const themeHref =
    (base + "theme.css").replace(/\/+/g, "/") +
    (d.assetVersion ? `?v=${d.assetVersion}` : "");
  const meta = d.description
    ? `<meta name="description" content="${esc(d.description)}">`
    : "";
  const tocAside =
    d.showToc && d.tocHtml
      ? `<aside class="hidden lg:block w-64 shrink-0 pl-8 py-12"><div class="sticky top-20"><p class="toc-heading">On this page</p><nav class="toc">${d.tocHtml}</nav></div></aside>`
      : "";

  const mermaidSrc = (base + "assets/mermaid.min.js").replace(/\/+/g, "/");
  const mermaidScript = d.mermaid
    ? `<script src="${mermaidSrc}${d.assetVersion ? `?v=${d.assetVersion}` : ""}"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: "default" });</script>`
    : "";

  const versionBadge = d.version
    ? `<span class="site-version">${esc(formatVersion(d.version))}</span>`
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
<header class="sticky top-0 z-50 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
  <details class="md:hidden">
    <summary class="cursor-pointer list-none select-none rounded p-2 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">&#9776;</summary>
    <div class="absolute left-0 top-full max-h-[80vh] w-72 overflow-y-auto border-b border-r border-slate-200 bg-white p-4 shadow-lg">
      <nav class="site-nav">${d.sidebarHtml}</nav>
    </div>
  </details>
  <a href="${base}" class="text-lg font-semibold tracking-tight">${esc(d.siteName)}</a>${versionBadge}
</header>
<div class="mx-auto flex w-full max-w-screen-2xl">
  <aside class="hidden md:block w-72 shrink-0 border-r border-slate-200 px-4 py-12">
    <div class="sticky top-20"><nav class="site-nav">${d.sidebarHtml}</nav></div>
  </aside>
  <main class="min-w-0 flex-1 px-6 py-12 md:px-12">
    <article class="prose prose-slate max-w-none">${d.contentHtml}</article>
  </main>
  ${tocAside}
</div>
${mermaidScript}
</body>
</html>`;
}
