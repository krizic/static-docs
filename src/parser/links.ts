import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import type { AssetRef } from "../types.js";
import { resolveInternalLink, withBase } from "../utils/path.js";

export interface LinkOptions {
  currentRelDir: string; // posix dir of the current md file, relative to root
  basePath: string;
  /** Absolute dir of the current md file; enables asset rewriting when set. */
  sourceDirAbs?: string;
  /** Absolute project root; assets inside it keep their relative layout. */
  rootDirAbs?: string;
  /** Source label used in warnings. */
  sourceLabel?: string;
  assets: AssetRef[]; // collect referenced local assets
}

const EXTERNAL = /^([a-z][a-z0-9+.-]*:)?\/\//i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|pdf|mp4|webm|ogg|mp3|wav)$/i;

/** Output dir (relative to the build root) where referenced media is emitted. */
export const MEDIA_DIR = "assets/media";

function isLocal(url: string): boolean {
  return !EXTERNAL.test(url) && !SCHEME.test(url) && !url.startsWith("#") && !url.startsWith("/");
}

/**
 * Resolve a local asset reference to its absolute source path and the
 * output-relative destination it will be copied to. Returns undefined for
 * non-local URLs or when the source file does not exist.
 */
function planAsset(url: string, options: LinkOptions): { ref: AssetRef; url: string } | undefined {
  if (!options.sourceDirAbs || !isLocal(url)) return undefined;
  const match = /^([^?#]*)([?#].*)?$/.exec(url);
  const pathPart = match?.[1] ?? url;
  const suffix = match?.[2] ?? "";
  if (!ASSET_EXT.test(pathPart)) return undefined;
  let decoded = pathPart;
  try {
    decoded = decodeURI(pathPart);
  } catch {
    // keep raw
  }
  const source = path.resolve(options.sourceDirAbs, decoded);
  if (!existsSync(source)) {
    console.warn(
      `[static-docs] missing asset: ${pathPart}${options.sourceLabel ? ` (from ${options.sourceLabel})` : ""}`,
    );
    return undefined;
  }
  const root = options.rootDirAbs ?? options.sourceDirAbs;
  const rel = path.relative(root, source);
  let dest: string;
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    dest = `${MEDIA_DIR}/${rel.split(path.sep).join("/")}`;
  } else {
    const hash = createHash("sha1").update(source).digest("hex").slice(0, 8);
    dest = `${MEDIA_DIR}/_external/${hash}/${path.basename(source)}`;
  }
  options.assets.push({ source, dest });
  return { ref: { source, dest }, url: encodeURI(withBase(dest, options.basePath)) + suffix };
}

function rewriteProp(node: Element, prop: string, options: LinkOptions): void {
  const value = node.properties?.[prop];
  if (typeof value !== "string") return;
  const planned = planAsset(value, options);
  if (planned && node.properties) node.properties[prop] = planned.url;
}

const RAW_ATTR =
  /(<(?:img|source|video|audio|a)\b[^>]*?\s(?:src|href|poster)\s*=\s*)(["'])(.*?)\2/gi;

export function rehypeRewriteLinks(options: LinkOptions) {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === "raw") {
        // Inline HTML in markdown, e.g. <img src="./diagram.png" width="300">
        node.value = node.value.replace(
          RAW_ATTR,
          (all: string, pre: string, q: string, url: string) => {
            const planned = planAsset(url, options);
            return planned ? `${pre}${q}${planned.url}${q}` : all;
          },
        );
        return;
      }
      if (node.type !== "element") return;
      const el = node as Element;
      if (el.tagName === "a") {
        const href = el.properties?.href;
        if (typeof href !== "string") return;
        if (EXTERNAL.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return;
        if (/\.md(#.*)?$/i.test(href) && el.properties) {
          el.properties.href = resolveInternalLink(href, options.currentRelDir, options.basePath);
          return;
        }
        rewriteProp(el, "href", options);
      } else if (el.tagName === "img" || el.tagName === "source") {
        rewriteProp(el, "src", options);
      } else if (el.tagName === "video" || el.tagName === "audio") {
        rewriteProp(el, "src", options);
        rewriteProp(el, "poster", options);
      }
    });
  };
}
