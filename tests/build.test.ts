import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/builder.js";
import { exists } from "../src/utils/fs.js";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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
        webkit: { file: "empty-list-webkit.png", status: "passed" },
      },
    },
    {
      id: "missing-shot",
      title: "Fehlender Screenshot",
      shows: "Platzhalter",
      proves: "Fehlende Bilder brechen den Build nicht",
      status: "failed",
      browsers: {
        chromium: { file: "does-not-exist.png", status: "failed" },
      },
    },
  ],
};

describe("build with evidenceGalleries", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "build-"));
    await mkdir(path.join(dir, "shots"), { recursive: true });
    await writeFile(path.join(dir, "shots", "manifest.json"), JSON.stringify(MANIFEST));
    await writeFile(path.join(dir, "shots", "empty-list-chromium.png"), PNG);
    await writeFile(path.join(dir, "shots", "empty-list-webkit.png"), PNG);
    await writeFile(path.join(dir, "index.md"), "# Home\n");
    await writeFile(
      path.join(dir, "static-docs.config.json"),
      JSON.stringify({
        outputDir: "./out",
        evidenceGalleries: [{ source: "./shots", path: "/e2e-evidence", title: "E2E Evidence" }],
      }),
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("emits the gallery page, runtime, and images", async () => {
    const { config } = await build(path.join(dir, "static-docs.config.json"));
    const galleryHtml = await readFile(
      path.join(config.outputDirAbs, "e2e-evidence", "index.html"),
      "utf8",
    );
    expect(galleryHtml).toContain('data-ev-id="empty-list"');
    expect(galleryHtml).toContain('data-ev-open="missing-shot"');
    expect(galleryHtml).toContain("Screenshot missing: does-not-exist.png");
    expect(galleryHtml).toContain("evidence-gallery.js");
    expect(galleryHtml).toContain("evidence-gallery.css");
    expect(galleryHtml).toContain("E2E Evidence"); // sidebar title
    expect(
      await exists(path.join(config.outputDirAbs, "e2e-evidence", "evidence-gallery.js")),
    ).toBe(true);
    expect(
      await exists(path.join(config.outputDirAbs, "e2e-evidence", "empty-list-chromium.png")),
    ).toBe(true);
    // missing image: warned but not copied, build succeeded
    expect(await exists(path.join(config.outputDirAbs, "e2e-evidence", "does-not-exist.png"))).toBe(
      false,
    );
  });
});
