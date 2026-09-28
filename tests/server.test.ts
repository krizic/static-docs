import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStaticHandler, type StaticHandlerOptions } from "../src/server.js";

async function withServer(
  options: StaticHandlerOptions,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(createStaticHandler(options));
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

describe("createStaticHandler", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "static-docs-server-"));
    await mkdir(path.join(root, "sub"), { recursive: true });
    await writeFile(path.join(root, "index.html"), "<html><body>home</body></html>");
    await writeFile(path.join(root, "sub", "index.html"), "<html><body>sub</body></html>");
    await writeFile(path.join(root, "data.json"), '{"ok":true}');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("serves index.html for the root directory", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await res.text()).toContain("home");
    });
  });

  it("answers 403 without file contents for encoded path traversal", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`);
      expect(res.status).toBe(403);
      const body = await res.text();
      expect(body).not.toContain("root:");
    });
  });

  it("answers 403 for traversal mixing plain and encoded segments", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/sub/..%2f..%2fetc%2fpasswd`);
      expect(res.status).toBe(403);
    });
  });

  it("answers 400 for malformed percent-encoding and keeps serving", async () => {
    await withServer({ root }, async (base) => {
      const bad = await fetch(`${base}/%`);
      expect(bad.status).toBe(400);
      // The server must survive the malformed request.
      const good = await fetch(`${base}/`);
      expect(good.status).toBe(200);
    });
  });

  it("redirects directory URLs without a trailing slash", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/sub`, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/sub/");
      const followed = await fetch(`${base}/sub/`);
      expect(followed.status).toBe(200);
      expect(await followed.text()).toContain("sub");
    });
  });

  it("redirects the root-less basePath itself", async () => {
    await withServer({ root, basePath: "/docs" }, async (base) => {
      const res = await fetch(`${base}/docs`, { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/docs/");
    });
  });

  it("strips basePath before resolving and keeps it in redirects", async () => {
    await withServer({ root, basePath: "/docs" }, async (base) => {
      const page = await fetch(`${base}/docs/data.json`);
      expect(page.status).toBe(200);
      expect(await page.json()).toEqual({ ok: true });
      const redirect = await fetch(`${base}/docs/sub`, { redirect: "manual" });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get("location")).toBe("/docs/sub/");
    });
  });

  it("answers 404 for missing files", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/nope.png`);
      expect(res.status).toBe(404);
    });
  });

  it("serves a full MIME map", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/data.json`);
      expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    });
  });

  it("applies transformHtml to HTML but not to other files", async () => {
    await withServer(
      { root, transformHtml: (html) => html.replace("</body>", "<!--x--></body>") },
      async (base) => {
        const html = await (await fetch(`${base}/`)).text();
        expect(html).toContain("<!--x-->");
        const json = await (await fetch(`${base}/data.json`)).text();
        expect(json).not.toContain("<!--x-->");
      },
    );
  });

  it("answers HEAD with the same status and headers but no body", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/`, { method: "HEAD" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await res.text()).toBe("");

      const json = await fetch(`${base}/data.json`, { method: "HEAD" });
      expect(json.status).toBe(200);
      expect(json.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(await json.text()).toBe("");
    });
  });

  it("answers HEAD for error statuses without a body", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/nope.png`, { method: "HEAD" });
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    });
  });

  it("answers 405 with Allow for non-GET/HEAD methods", async () => {
    await withServer({ root }, async (base) => {
      const res = await fetch(`${base}/`, { method: "POST" });
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
      // The server must survive the rejected method.
      const good = await fetch(`${base}/`);
      expect(good.status).toBe(200);
    });
  });
});
