import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, Frontmatter } from "./types.js";
import { toRoutePath } from "./utils/path.js";
import { scanRepo } from "./scanner.js";

/** Build FileNodes from explicit config.routes, filling gaps with a scan. */
export async function resolveRoutes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  if (!config.routes || config.routes.length === 0) {
    return scanRepo(config);
  }
  const nodes: FileNode[] = [];
  const seen = new Set<string>();
  for (const r of config.routes) {
    const sourcePath = path.resolve(config.rootDir, r.source);
    const relativePath = path
      .relative(config.rootDir, sourcePath)
      .replace(/\\/g, "/");
    const routePath = normalizeRoute(r.path);
    const fileFm = await readFrontmatter(sourcePath);
    const frontmatter: Frontmatter = { ...fileFm, ...(r.meta as Frontmatter) };
    if (seen.has(routePath)) {
      console.warn(`[static-docs] duplicate route "${routePath}" ignored`);
      continue;
    }
    seen.add(routePath);
    nodes.push({ sourcePath, relativePath, routePath, frontmatter });
  }
  return nodes;
}

function normalizeRoute(p: string): string {
  const clean = p.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (clean === "" || clean === "/") return "/";
  return clean.startsWith("/") ? clean : "/" + clean;
}

async function readFrontmatter(file: string): Promise<Frontmatter> {
  try {
    const raw = await readFile(file, "utf8");
    return matter(raw).data as Frontmatter;
  } catch {
    return {};
  }
}

export { toRoutePath };
