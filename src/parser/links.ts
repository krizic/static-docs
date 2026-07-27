import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import { resolveInternalLink } from "../utils/path.js";

export interface LinkOptions {
  currentRelDir: string; // posix dir of the current md file, relative to root
  basePath: string;
  assets: string[]; // collect referenced local asset paths
}

const EXTERNAL = /^([a-z]+:)?\/\//i;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|mp4|webm)$/i;

export function rehypeRewriteLinks(options: LinkOptions) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href !== "string") return;
        if (
          EXTERNAL.test(href) ||
          href.startsWith("#") ||
          href.startsWith("mailto:")
        )
          return;
        if (/\.md(#.*)?$/i.test(href)) {
          node.properties!.href = resolveInternalLink(
            href,
            options.currentRelDir,
            options.basePath,
          );
        }
      } else if (node.tagName === "img") {
        const src = node.properties?.src;
        if (typeof src === "string" && !EXTERNAL.test(src) && ASSET_EXT.test(src)) {
          options.assets.push(src);
        }
      }
    });
  };
}
