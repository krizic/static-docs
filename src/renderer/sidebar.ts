import type { NavNode } from "../types.js";
import { withBase } from "../utils/path.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function href(routePath: string, basePath: string): string {
  const url = withBase(routePath, basePath);
  // Trailing slash so relative asset URLs on the target page resolve under the route directory.
  return url.endsWith("/") ? url : url + "/";
}

export function renderSidebar(
  nav: NavNode[],
  currentRoute: string,
  basePath: string,
): string {
  return `<ul class="nav-list">${nav
    .map((n) => renderNode(n, currentRoute, basePath, 0))
    .join("")}</ul>`;
}

function leaf(node: NavNode, current: string, basePath: string): string {
  const active = node.routePath === current ? " nav-item-active" : "";
  return `<li><a class="nav-item${active}" href="${href(
    node.routePath!,
    basePath,
  )}">${esc(node.title)}</a></li>`;
}

function renderNode(
  node: NavNode,
  current: string,
  basePath: string,
  depth: number,
): string {
  const isGroup = node.children.length > 0;
  if (!isGroup) return leaf(node, current, basePath);

  const childHtml = node.children
    .map((c) => renderNode(c, current, basePath, depth + 1))
    .join("");
  const active = node.routePath === current ? " nav-item-active" : "";

  // Top-level sections keep the small-caps header.
  if (depth === 0) {
    const header = node.routePath
      ? `<a class="nav-section-title nav-section-link${active}" href="${href(
          node.routePath,
          basePath,
        )}">${esc(node.title)}</a>`
      : `<span class="nav-section-title">${esc(node.title)}</span>`;
    return `<li class="nav-section">${header}<ul class="nav-sublist">${childHtml}</ul></li>`;
  }

  // Nested folders render as an emphasized parent with a guided branch.
  const header = node.routePath
    ? `<a class="nav-item nav-parent${active}" href="${href(
        node.routePath,
        basePath,
      )}">${esc(node.title)}</a>`
    : `<span class="nav-parent-label">${esc(node.title)}</span>`;
  return `<li class="nav-tree">${header}<ul class="nav-branch">${childHtml}</ul></li>`;
}
