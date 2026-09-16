import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("evidenceGalleries config", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cfg-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("parses a full evidence gallery entry", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        evidenceGalleries: [
          {
            source: "./e2e-screenshots",
            path: "/e2e-evidence",
            title: "E2E Test Evidence",
            description: "Proof",
            navCategory: "Quality",
            navOrder: 10,
            hidden: false,
          },
        ],
      }),
    );
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries).toHaveLength(1);
    expect(cfg.evidenceGalleries![0]).toMatchObject({
      source: "./e2e-screenshots",
      path: "/e2e-evidence",
      title: "E2E Test Evidence",
      navCategory: "Quality",
      navOrder: 10,
      hidden: false,
    });
  });

  it("defaults hidden to false and leaves optionals undefined", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        evidenceGalleries: [{ source: "./shots", path: "evidence" }],
      }),
    );
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries![0].hidden).toBe(false);
    expect(cfg.evidenceGalleries![0].title).toBeUndefined();
  });

  it("rejects an entry without source", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({ evidenceGalleries: [{ path: "/x" }] }),
    );
    await expect(loadConfig(p)).rejects.toThrow("Invalid config");
  });

  it("is optional", async () => {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(p, JSON.stringify({}));
    const cfg = await loadConfig(p);
    expect(cfg.evidenceGalleries).toBeUndefined();
  });
});
