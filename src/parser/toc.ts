import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element } from "hast";
import type { TocEntry } from "../types.js";

export interface TocOptions {
  minDepth: number;
  maxDepth: number;
  collect: TocEntry[]; // flat list, nested later
}

export function rehypeCollectToc(options: TocOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (!m) return;
      const depth = Number(m[1]);
      if (depth < options.minDepth || depth > options.maxDepth) return;
      const id = node.properties?.id;
      if (typeof id !== "string") return;
      options.collect.push({
        depth,
        text: toString(node),
        slug: id,
        children: [],
      });
    });
  };
}

/** Turn a flat, ordered heading list into a nested tree by depth. */
export function nestToc(flat: TocEntry[]): TocEntry[] {
  const roots: TocEntry[] = [];
  const stack: TocEntry[] = [];
  for (const entry of flat) {
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) {
      stack.pop();
    }
    if (stack.length === 0) roots.push(entry);
    else stack[stack.length - 1].children.push(entry);
    stack.push(entry);
  }
  return roots;
}
