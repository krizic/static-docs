import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { resolveRoutes } from "../src/router.js";

const MANIFEST = {
  generatedAt: "2026-09-16T13:27:10.400Z",
  evidence: [
    {
      id: "empty-list",
      title: "Leere Dokumentliste",
      shows: "Leerzustand",
      proves: "Rendert den Leerzustand",
      status: "passed",
      browsers: {
        chromium: { file: "empty-list-chromium.png", status: "passed" },
      },
    },
  ],
};

describe("resolveRoutes with evidenceGalleries", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "router-"));
    await mkdir(path.join(dir, "shots"), { recursive: true });
    await writeFile(
      path.join(dir, "shots", "manifest.json"),
      JSON.stringify(MANIFEST),
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function configFor(gallery: Record<string, unknown>) {
    const p = path.join(dir, "static-docs.config.json");
    await writeFile(
      p,
      JSON.stringify({
        routes: [],
        evidenceGalleries: [gallery],
      }),
    );
    return loadConfig(p);
  }

  it("creates an evidence FileNode with normalized route and frontmatter", async () => {
    const cfg = await configFor({
      source: "./shots",
      path: "e2e-evidence",
      title: "E2E Test Evidence",
      description: "Proof",
      navCategory: "Quality",
      navOrder: 10,
    });
    const nodes = await resolveRoutes(cfg);
    const node = nodes.find((n) => n.routePath === "/e2e-evidence");
    expect(node).toBeDefined();
    expect(node!.evidence).toBeDefined();
    expect(node!.evidence!.sourceDirAbs).toBe(path.join(dir, "shots"));
    expect(node!.evidence!.manifest.evidence[0].id).toBe("empty-list");
    expect(node!.frontmatter).toMatchObject({
      title: "E2E Test Evidence",
      description: "Proof",
      navCategory: "Quality",
      navOrder: 10,
      hidden: false,
      toc: false,
    });
    expect(node!.sourcePath).toBe("");
  });

  it("derives a default title from the route path", async () => {
    const cfg = await configFor({ source: "./shots", path: "/e2e-evidence" });
    const nodes = await resolveRoutes(cfg);
    expect(nodes[0].frontmatter.title).toBe("E2e Evidence");
  });

  it("throws when the manifest is missing", async () => {
    const cfg = await configFor({ source: "./nope", path: "/evidence" });
    await expect(resolveRoutes(cfg)).rejects.toThrow(
      "Evidence manifest not found",
    );
  });
});
