import matter from "gray-matter";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import { scanRepo } from "./scanner.js";
import type { FileNode, Frontmatter } from "./types.js";
import { exists } from "./utils/fs.js";
import { toRoutePath } from "./utils/path.js";

/** Build FileNodes from config routes and componentRoutes, else scan the repo. */
export async function resolveRoutes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  const seen = new Set<string>();

  const markdownNodes =
    config.routes && config.routes.length > 0
      ? await markdownRouteNodes(config)
      : await scanRepo(config);

  for (const node of markdownNodes) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  for (const node of await componentRouteNodes(config)) {
    if (claim(seen, node.routePath)) nodes.push(node);
  }
  return nodes;
}

function claim(seen: Set<string>, routePath: string): boolean {
  if (seen.has(routePath)) {
    console.warn(`[static-docs] duplicate route "${routePath}" ignored`);
    return false;
  }
  seen.add(routePath);
  return true;
}

async function markdownRouteNodes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.routes ?? []) {
    const sourcePath = path.resolve(config.rootDir, r.source);
    const relativePath = path
      .relative(config.rootDir, sourcePath)
      .replace(/\\/g, "/");
    const fileFm = await readFrontmatter(sourcePath);
    const frontmatter: Frontmatter = { ...fileFm, ...(r.meta as Frontmatter) };
    nodes.push({
      sourcePath,
      relativePath,
      routePath: normalizeRoute(r.path),
      frontmatter,
    });
  }
  return nodes;
}

async function componentRouteNodes(
  config: ResolvedConfig,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for (const r of config.componentRoutes ?? []) {
    const routePath = normalizeRoute(r.path);
    const scriptSourceAbs = path.resolve(config.rootDir, r.script);
    if (!(await exists(scriptSourceAbs))) {
      throw new Error(
        `Component route "${routePath}": script not found: ${scriptSourceAbs}`,
      );
    }
    nodes.push({
      sourcePath: "",
      relativePath: path
        .relative(config.rootDir, scriptSourceAbs)
        .replace(/\\/g, "/"),
      routePath,
      frontmatter: {
        title: r.title ?? defaultTitle(routePath),
        navOrder: r.navOrder,
        navCategory: r.navCategory,
        hidden: r.hidden,
        toc: false,
      },
      component: {
        tag: r.tag,
        scriptSourceAbs,
        scriptFileName: path.basename(scriptSourceAbs),
      },
    });
  }
  return nodes;
}

function defaultTitle(routePath: string): string {
  const last = routePath.split("/").filter(Boolean).pop() ?? "Home";
  return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
