export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Convert a repo-relative posix md path to a pretty route path. */
export function toRoutePath(relPath: string): string {
  let p = relPath.replace(/\\/g, "/").replace(/\.md$/i, "");
  // README or index files map to their directory root
  p = p.replace(/\/(readme|index)$/i, "");
  p = p.replace(/^(readme|index)$/i, "");
  p = p.replace(/^\/+|\/+$/g, "");
  return "/" + p; // "/" for root, "/guides/start" otherwise
}

/** Resolve an internal ./other.md link relative to the current route dir. */
export function resolveInternalLink(
  href: string,
  currentRelDir: string,
  basePath: string,
): string {
  const [pathPart, hash = ""] = href.split("#");
  const cleaned = pathPart.replace(/\\/g, "/");
  // join currentRelDir + cleaned, normalize .. and .
  const segments = (currentRelDir + "/" + cleaned).split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  let joined = stack.join("/");
  joined = joined.replace(/\.md$/i, "");
  joined = joined
    .replace(/\/(readme|index)$/i, "")
    .replace(/^(readme|index)$/i, "");
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const url = (base + joined).replace(/\/+/g, "/");
  const withSlash = url.endsWith("/") ? url : url + "/";
  return hash ? `${withSlash}#${hash}` : withSlash;
}

export function outFileFor(routePath: string): string {
  const clean = routePath.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/index.html` : "index.html";
}
