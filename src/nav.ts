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
    for (const seg of groupSegs) {
      const label = humanize(seg);
      let child = cursor.children.find(
        (c) => c.title.toLowerCase() === label.toLowerCase() && !c.routePath,
      );
      if (!child) {
        child = { title: label, order: 0, children: [] };
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
