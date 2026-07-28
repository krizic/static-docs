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

function orderFor(file: FileNode): number {
  if (typeof file.frontmatter.navOrder === "number") {
    return file.frontmatter.navOrder;
  }
  return file.routePath === "/" ? -1 : 0;
}

/**
 * Build a directory-grouped nav tree.
 *
 * - `navCategory` frontmatter overrides directory grouping (flat category).
 * - A folder's index page (README/index, whose route equals the folder path)
 *   is merged into the folder node itself, so the folder header becomes the
 *   clickable link instead of appearing as a confusing duplicate sibling.
 */
export function buildNavTree(files: FileNode[]): NavNode[] {
  const root: NavNode = { title: "", order: 0, children: [] };
  const dirNodes = new Map<string, NavNode>(); // key: "packages/download-list"

  /** Ensure a chain of directory nodes exists; returns the deepest one. */
  function ensureDir(segs: string[]): NavNode {
    let cursor = root;
    let key = "";
    for (const seg of segs) {
      key = key ? `${key}/${seg}` : seg;
      let child = dirNodes.get(key);
      if (!child) {
        child = { title: humanize(seg), order: 0, children: [] };
        dirNodes.set(key, child);
        cursor.children.push(child);
      }
      cursor = child;
    }
    return cursor;
  }

  function ensureCategory(name: string): NavNode {
    let child = root.children.find(
      (c) => !c.routePath && c.title.toLowerCase() === name.toLowerCase(),
    );
    if (!child) {
      child = { title: name, order: 0, children: [] };
      root.children.push(child);
    }
    return child;
  }

  const visible = files.filter((f) => !f.frontmatter.hidden);

  // Pass 1: create every directory node so index detection works regardless
  // of the order files are processed in.
  for (const file of visible) {
    if (file.frontmatter.navCategory) continue;
    const segs = file.routePath.split("/").filter(Boolean);
    ensureDir(segs.slice(0, -1));
  }

  // Pass 2: place each file, merging folder-index pages into their folder node.
  for (const file of visible) {
    const segs = file.routePath.split("/").filter(Boolean);

    if (file.frontmatter.navCategory) {
      const cat = ensureCategory(String(file.frontmatter.navCategory));
      cat.children.push({
        title: titleFor(file),
        routePath: file.routePath,
        order: orderFor(file),
        children: [],
      });
      continue;
    }

    const key = segs.join("/");
    const dir = dirNodes.get(key);
    if (dir) {
      // This file is the index of an existing folder: make the folder clickable.
      dir.routePath = file.routePath;
      dir.order = orderFor(file);
      if (file.frontmatter.title) dir.title = String(file.frontmatter.title);
      continue;
    }

    ensureDir(segs.slice(0, -1)).children.push({
      title: titleFor(file),
      routePath: file.routePath,
      order: orderFor(file),
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
