import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Simulate the stat/open race: `stat` (fs/promises, unmocked) still sees the
// file, but by the time the handler opens a read stream the file is gone
// (e.g. a dev rebuild rm -rf's the output dir). Only the file named
// "vanished.txt" fails; everything else streams normally.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    createReadStream: ((file: unknown) => {
      if (String(file).endsWith("vanished.txt")) {
        return new Readable({
          read() {
            this.destroy(new Error("ENOENT: file vanished between stat and open"));
          },
        });
      }
      return actual.createReadStream(file as Parameters<typeof actual.createReadStream>[0]);
    }) as typeof actual.createReadStream,
  };
});

const { createStaticHandler } = await import("../src/server.js");

describe("createStaticHandler stream errors", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "static-docs-stream-"));
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "index.html"), "<html><body>home</body></html>");
    await writeFile(path.join(root, "vanished.txt"), "still visible to stat");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("destroys the response instead of crashing and keeps serving", async () => {
    const server = http.createServer(createStaticHandler({ root }));
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;
    try {
      // The response is aborted mid-flight; the client sees a network failure.
      await expect(fetch(`${base}/vanished.txt`)).rejects.toThrow();
      // The server must survive and keep serving other files.
      const res = await fetch(`${base}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("home");
    } finally {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  });
});
