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
  return `<ul class="nav-list">${nav
    .map((n) => renderNode(n, currentRoute, basePath))
    .join("")}</ul>`;
}

function renderNode(node: NavNode, current: string, basePath: string): string {
  if (node.routePath) {
    const active = node.routePath === current;
    return `<li><a class="nav-item${active ? " nav-item-active" : ""}" href="${href(
      node.routePath,
      basePath,
    )}">${esc(node.title)}</a></li>`;
  }
  const children = node.children
    .map((c) => renderNode(c, current, basePath))
    .join("");
  return `<li class="nav-group"><span class="nav-group-title">${esc(
    node.title,
  )}</span><ul class="nav-sublist">${children}</ul></li>`;
}
