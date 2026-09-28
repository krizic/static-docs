import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { loadConfig } from "./config.js";
import { exists } from "./utils/fs.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

export interface StaticHandlerOptions {
  /** Directory to serve; resolved to an absolute path. */
  root: string;
  /**
   * URL prefix to strip before resolving, e.g. "/docs" for a site built with
   * `basePath: "/docs"`. Requests without the prefix are served as-is.
   */
  basePath?: string;
  /** Transform applied to every served HTML document (e.g. live-reload injection). */
  transformHtml?: (html: string) => string;
}

function normalizeBasePath(basePath: string | undefined): string | undefined {
  if (!basePath) return undefined;
  const clean = basePath.replace(/\/+$/g, "");
  return clean === "" || clean === "/" ? undefined : clean;
}

/**
 * Builds the canonical directory URL for a resolved directory. The location is
 * derived from the resolved filesystem path rather than echoed back from the
 * request, so it always stays a single-slash, same-origin path.
 */
function directoryLocation(
  root: string,
  basePath: string | undefined,
  candidate: string,
  query: string | undefined,
): string {
  const rel = path.relative(root, candidate);
  const p = rel === "" ? "/" : `/${rel.split(path.sep).map(encodeURIComponent).join("/")}/`;
  const withBase = basePath ? `${basePath}${p}` : p;
  return query ? `${withBase}?${query}` : withBase;
}

type ResolvedRequest = { file: string } | { redirect: string } | { status: 400 | 403 | 404 };

/**
 * Resolves a request path to a file to serve, a redirect to perform, or an
 * error status. Escapes above `root` (path traversal) yield 403, malformed
 * percent-encoding yields 400, and missing files yield 404.
 */
async function resolveRequest(
  root: string,
  basePath: string | undefined,
  url: string,
): Promise<ResolvedRequest> {
  const [rawPath = "/", query] = url.split("?");

  let urlPath = rawPath;
  if (basePath) {
    if (urlPath === basePath) urlPath = "/";
    else if (urlPath.startsWith(`${basePath}/`)) urlPath = urlPath.slice(basePath.length);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return { status: 400 };
  }

  const candidate = path.resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return { status: 403 };
  }

  const stats = await stat(candidate).catch(() => null);
  if (!stats) return { status: 404 };

  if (stats.isDirectory()) {
    const indexFile = path.join(candidate, "index.html");
    if (!(await exists(indexFile))) return { status: 404 };

    // Directories must be requested with a trailing slash. Pages load assets
    // relatively, which the browser resolves against the parent directory when
    // the slash is missing, producing 404s. Every conventional static host
    // redirects here, so mirror that behaviour.
    if (!rawPath.endsWith("/")) {
      return { redirect: directoryLocation(root, basePath, candidate, query) };
    }
    return { file: indexFile };
  }

  return { file: candidate };
}

/**
 * Serves a directory of static files over HTTP with path-traversal
 * containment, canonical directory redirects, and optional HTML transforms.
 * All errors are answered with a response; the handler never throws.
 */
export function createStaticHandler(options: StaticHandlerOptions): http.RequestListener {
  const root = path.resolve(options.root);
  const basePath = normalizeBasePath(options.basePath);

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "GET, HEAD",
      });
      res.end("405 Method Not Allowed");
      return;
    }
    const isHead = method === "HEAD";

    const resolved = await resolveRequest(root, basePath, req.url ?? "/");

    if ("status" in resolved) {
      const message = http.STATUS_CODES[resolved.status] ?? "Error";
      res.writeHead(resolved.status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(isHead ? undefined : `${resolved.status} ${message}`);
      return;
    }

    // 302 rather than 301: a permanent redirect would be cached by the browser
    // and outlive any change to the generated site.
    if ("redirect" in resolved) {
      res.writeHead(302, { Location: resolved.redirect });
      res.end();
      return;
    }

    const ext = path.extname(resolved.file).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    if (isHead) {
      res.end();
      return;
    }
    if (ext === ".html" && options.transformHtml) {
      const html = await readFile(resolved.file, "utf8");
      res.end(options.transformHtml(html));
      return;
    }
    const stream = createReadStream(resolved.file);
    // The file can vanish between stat and open (e.g. a dev rebuild rm -rf's
    // the output dir). Headers are already sent at that point, so the only
    // sane answer is to abort the response instead of crashing the process.
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  };

  return (req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end(`500 Internal Server Error: ${(err as Error).message}`);
    });
  };
}

export interface ServeOptions {
  /** Path to the config file; used to resolve outputDir and basePath. */
  config?: string;
  /** Port to listen on. Defaults to 8080. */
  port?: number;
  /** Directory to serve; overrides the config's outputDir when set. */
  dir?: string;
}

/**
 * Serves the built site (or an explicit directory) over HTTP. Throws a clear
 * error when there is nothing to serve.
 */
export async function serve(options: ServeOptions = {}): Promise<http.Server> {
  let root: string;
  let basePath: string | undefined;
  if (options.dir) {
    root = path.resolve(options.dir);
  } else {
    const config = await loadConfig(options.config ?? "static-docs.config.json");
    root = config.outputDirAbs;
    basePath = config.basePath;
  }
  if (!(await exists(root))) {
    throw new Error(`Nothing to serve: ${root} does not exist. Run "static-docs build" first.`);
  }

  const port = options.port ?? 8080;
  const server = http.createServer(createStaticHandler({ root, basePath }));
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
  console.log(`[static-docs] serving ${root}`);
  console.log(`[static-docs] → http://localhost:${port}`);
  return server;
}
