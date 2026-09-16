import { readFile } from "node:fs/promises";
import path from "node:path";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";
import type { ResolvedConfig } from "../config.js";
import type { FileNode, ParsedMarkdown, TocEntry } from "../types.js";
import { rehypeRewriteLinks } from "./links.js";
import { type MermaidState, rehypeMermaid } from "./mermaid.js";
import { extractMeta } from "./meta.js";
import { nestToc, rehypeCollectToc } from "./toc.js";

/** No-op unified plugin used to conditionally skip remark plugins. */
function noop() {
  return () => {};
}

export async function parseMarkdown(
  file: FileNode,
  config: ResolvedConfig,
): Promise<ParsedMarkdown> {
  const raw = await readFile(file.sourcePath, "utf8");
  const { data: frontmatter } = extractMeta(raw);

  const tocFlat: TocEntry[] = [];
  const assets: string[] = [];
  const mermaidState: MermaidState = { found: false };
  const currentRelDir = path.posix.dirname(file.relativePath);

  const gfm = config.markdown.gfm ? remarkGfm : noop;
  const smart = config.markdown.smartypants ? remarkSmartypants : noop;

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(gfm)
    .use(smart)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeMermaid, mermaidState)
    .use(rehypePrettyCode, {
      theme: config.markdown.shikiTheme as PrettyCodeOptions["theme"],
      keepBackground: true,
    })
    .use(rehypeCollectToc, {
      minDepth: config.toc.minDepth,
      maxDepth: config.toc.maxDepth,
      collect: tocFlat,
    })
    .use(rehypeRewriteLinks, {
      currentRelDir: currentRelDir === "." ? "" : currentRelDir,
      basePath: config.basePath,
      assets,
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const fileVal = await processor.process(raw);
  return {
    html: String(fileVal),
    toc: nestToc(tocFlat),
    frontmatter,
    assets,
    hasMermaid: mermaidState.found,
  };
}
