import fg from "fast-glob";
import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, Frontmatter } from "./types.js";
import { toRoutePath } from "./utils/path.js";

const DEFAULT_IGNORE = ["node_modules/**", ".git/**", "**/docs-build/**"];

export async function scanRepo(config: ResolvedConfig): Promise<FileNode[]> {
  const ignore = [...DEFAULT_IGNORE, ...config.sidebar.exclude];
  const entries = await fg("**/*.md", {
    cwd: config.rootDir,
    ignore,
    dot: false,
    onlyFiles: true,
  });
  const nodes: FileNode[] = [];
  const seen = new Map<string, string>();
  for (const rel of entries.sort()) {
    const sourcePath = path.join(config.rootDir, rel);
    const relativePath = rel.replace(/\\/g, "/");
    const fm = await readFrontmatter(sourcePath);
    const routePath = toRoutePath(relativePath);
    if (seen.has(routePath)) {
      console.warn(
        `[static-docs] route collision: "${routePath}" from ${seen.get(routePath)} and ${relativePath} (keeping first)`,
      );
      continue;
    }
    seen.set(routePath, relativePath);
    nodes.push({ sourcePath, relativePath, routePath, frontmatter: fm });
  }
  return nodes;
}

async function readFrontmatter(file: string): Promise<Frontmatter> {
  const raw = await readFile(file, "utf8");
  const { data } = matter(raw);
  return data as Frontmatter;
}
