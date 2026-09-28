import http from "node:http";
import path from "node:path";
import chokidar from "chokidar";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { createStaticHandler } from "./server.js";

const RELOAD_SNIPPET = `<script>
(function(){var s=new EventSource("/__reload");s.onmessage=function(){location.reload()};})();
</script>`;

export async function dev(configPath = "static-docs.config.json", port = 4321): Promise<void> {
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

  const handler = createStaticHandler({
    root: outDir,
    basePath: config.basePath,
    transformHtml: (html) => html.replace("</body>", `${RELOAD_SNIPPET}</body>`),
  });

  const server = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    // Matched before basePath stripping: the injected snippet always requests
    // "/__reload", regardless of the configured basePath.
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
    handler(req, res);
  });

  server.listen(port, () => {
    console.log(`[static-docs] dev server → http://localhost:${port}`);
  });

  const watchTargets = ["**/*.md", path.basename(configPath)];
  if (config.customCss) watchTargets.push(config.customCss);
  for (const r of config.componentRoutes ?? []) {
    watchTargets.push(r.script);
  }
  for (const g of config.evidenceGalleries ?? []) {
    watchTargets.push(path.join(g.source, "**/*"));
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
