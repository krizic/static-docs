import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import chokidar from "chokidar";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { exists } from "./utils/fs.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

const RELOAD_SNIPPET = `<script>
(function(){var s=new EventSource("/__reload");s.onmessage=function(){location.reload()};})();
</script>`;

export async function dev(
  configPath = "static-docs.config.json",
  port = 4321,
): Promise<void> {
  const config = await loadConfig(configPath);
  const outDir = config.outputDirAbs;
  const clients = new Set<http.ServerResponse>();

  async function rebuild() {
    try {
      await build(configPath);
    } catch (err) {
      console.error("[static-docs] build error:", (err as Error).message);
    }
  }
  await rebuild();

  const server = http.createServer(async (req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/__reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    let filePath = path.join(outDir, decodeURIComponent(url));
    if (url.endsWith("/")) filePath = path.join(filePath, "index.html");
    if (!(await exists(filePath))) {
      const withIndex = path.join(filePath, "index.html");
      if (await exists(withIndex)) filePath = withIndex;
    }
    if (!(await exists(filePath))) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    let body: Buffer | string = await readFile(filePath);
    if (ext === ".html") {
      body = body.toString("utf8").replace("</body>", `${RELOAD_SNIPPET}</body>`);
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  });

  server.listen(port, () => {
    console.log(`[static-docs] dev server → http://localhost:${port}`);
  });

  const watchTargets = ["**/*.md", path.basename(configPath)];
  if (config.customCss) watchTargets.push(config.customCss);
  for (const r of config.componentRoutes ?? []) {
    watchTargets.push(r.script);
  }
  const watcher = chokidar.watch(watchTargets, {
    cwd: config.rootDir,
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "**/docs-build/**", "**/.git/**"],
  });
  watcher.on("all", async () => {
    await rebuild();
    for (const res of clients) res.write("data: reload\n\n");
  });
}
