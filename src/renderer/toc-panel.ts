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
  return `<li><a class="toc-link${deep}" href="#${entry.slug}">${esc(
    entry.text,
  )}</a>${children}</li>`;
}
