import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EvidenceManifestSchema,
  loadEvidenceManifest,
} from "../../src/evidence/manifest.js";

const VALID = {
  generatedAt: "2026-09-16T13:27:10.400Z",
  evidence: [
    {
      id: "authenticated-list",
      title: "Authentifizierte Dokumentliste",
      shows: "Breadcrumbs und Dokumenttabelle",
      proves: "Angemeldete Benutzer sehen die Liste",
      spec: "specs/authenticated-list.spec.ts",
      test: "renders authenticated list",
      status: "passed",
      browsers: {
        chromium: { file: "authenticated-list-chromium.png", status: "passed" },
        firefox: { file: "authenticated-list-firefox.png", status: "failed" },
      },
    },
  ],
};

describe("EvidenceManifestSchema", () => {
  it("accepts a valid manifest and keeps unknown fields", () => {
    const raw = { ...VALID, futureField: 1 };
    raw.evidence = [{ ...VALID.evidence[0], metadata: "present" }];
    const parsed = EvidenceManifestSchema.parse(raw);
    expect(parsed.evidence[0].id).toBe("authenticated-list");
    expect((parsed.evidence[0] as Record<string, unknown>).metadata).toBe(
      "present",
    );
  });

  it("rejects a missing required field", () => {
    const bad = structuredClone(VALID);
    delete (bad.evidence[0] as Record<string, unknown>).shows;
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const bad = structuredClone(VALID);
    (bad.evidence[0] as Record<string, unknown>).status = "flaky";
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid per-browser status", () => {
    const bad = structuredClone(VALID);
    bad.evidence[0].browsers.chromium.status = "flaky" as never;
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("loadEvidenceManifest", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "evidence-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads a valid manifest from disk", async () => {
    const p = path.join(dir, "manifest.json");
    await writeFile(p, JSON.stringify(VALID));
    const manifest = await loadEvidenceManifest(p);
    expect(manifest.evidence).toHaveLength(1);
  });

  it("throws a clear error when the file is missing", async () => {
    await expect(
      loadEvidenceManifest(path.join(dir, "manifest.json")),
    ).rejects.toThrow("Evidence manifest not found");
  });

  it("throws with Zod issues when invalid", async () => {
    const p = path.join(dir, "manifest.json");
    await writeFile(p, JSON.stringify({ generatedAt: "x", evidence: [{}] }));
    await expect(loadEvidenceManifest(p)).rejects.toThrow(
      "Invalid evidence manifest",
    );
  });

  it("rejects duplicate evidence ids", async () => {
    const p = path.join(dir, "manifest.json");
    const dup = {
      ...VALID,
      evidence: [VALID.evidence[0], VALID.evidence[0]],
    };
    await writeFile(p, JSON.stringify(dup));
    await expect(loadEvidenceManifest(p)).rejects.toThrow(
      'duplicate evidence id "authenticated-list"',
    );
  });
});
