import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EvidenceManifestSchema, loadEvidenceManifest } from "../../src/evidence/manifest.js";

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
    expect((parsed.evidence[0] as Record<string, unknown>).metadata).toBe("present");
  });

  it("accepts a 0.1.5 manifest unchanged", () => {
    const parsed = EvidenceManifestSchema.parse(structuredClone(VALID));
    expect(parsed.evidence[0].title).toBe("Authentifizierte Dokumentliste");
    expect(parsed.evidence[0].status).toBe("passed");
    expect(parsed.evidence[0].browsers.firefox?.status).toBe("failed");
  });

  it("accepts entries without title/shows/proves (optional since 0.2.0)", () => {
    const raw = structuredClone(VALID);
    const entry = raw.evidence[0] as Record<string, unknown>;
    delete entry.title;
    delete entry.shows;
    delete entry.proves;
    const parsed = EvidenceManifestSchema.parse(raw);
    expect(parsed.evidence[0].id).toBe("authenticated-list");
    expect(parsed.evidence[0].title).toBeUndefined();
  });

  it("accepts flaky and skipped statuses (added in 0.2.0)", () => {
    const raw = structuredClone(VALID);
    raw.evidence[0].status = "flaky";
    raw.evidence[0].browsers.chromium.status = "skipped";
    const parsed = EvidenceManifestSchema.parse(raw);
    expect(parsed.evidence[0].status).toBe("flaky");
    expect(parsed.evidence[0].browsers.chromium?.status).toBe("skipped");
  });

  it("accepts an optional $schema field", () => {
    const raw = { ...structuredClone(VALID), $schema: "./evidence-manifest.schema.json" };
    const parsed = EvidenceManifestSchema.parse(raw);
    expect(parsed.$schema).toBe("./evidence-manifest.schema.json");
  });

  it("rejects a missing id", () => {
    const bad = structuredClone(VALID);
    delete (bad.evidence[0] as Record<string, unknown>).id;
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const bad = structuredClone(VALID);
    (bad.evidence[0] as Record<string, unknown>).status = "exploded";
    expect(EvidenceManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid per-browser status", () => {
    const bad = structuredClone(VALID);
    bad.evidence[0].browsers.chromium.status = "exploded" as never;
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
    await expect(loadEvidenceManifest(path.join(dir, "manifest.json"))).rejects.toThrow(
      "Evidence manifest not found",
    );
  });

  it("throws with Zod issues when invalid", async () => {
    const p = path.join(dir, "manifest.json");
    await writeFile(p, JSON.stringify({ generatedAt: "x", evidence: [{}] }));
    await expect(loadEvidenceManifest(p)).rejects.toThrow("Invalid evidence manifest");
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
