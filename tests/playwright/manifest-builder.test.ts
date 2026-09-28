import { describe, expect, it } from "vitest";
import {
  buildEvidenceManifest,
  EVIDENCE_ANNOTATIONS,
  type EvidenceRun,
  extractEvidenceMeta,
} from "../../src/playwright/manifest-builder.js";

const GENERATED_AT = "2026-09-28T00:00:00.000Z";
const SPEC_FILE = "specs/newsletter.spec.ts";

const ANNOTATIONS = [
  { type: EVIDENCE_ANNOTATIONS.title, description: "Newsletter abonnieren" },
  { type: EVIDENCE_ANNOTATIONS.shows, description: "Der Newsletter-Tab" },
  { type: EVIDENCE_ANNOTATIONS.proves, description: "Toggle speichert den Status" },
];

function run(overrides: Partial<EvidenceRun>): EvidenceRun {
  return {
    logicalKey: `${SPEC_FILE}::toggles a newsletter`,
    specFile: SPEC_FILE,
    testTitle: "toggles a newsletter",
    browser: "chromium",
    outcome: "passed",
    annotations: ANNOTATIONS,
    shots: [],
    ...overrides,
  };
}

describe("extractEvidenceMeta", () => {
  it("extracts the three evidence annotations", () => {
    expect(extractEvidenceMeta(ANNOTATIONS)).toEqual({
      title: "Newsletter abonnieren",
      shows: "Der Newsletter-Tab",
      proves: "Toggle speichert den Status",
    });
  });

  it("returns empty strings when metadata is missing", () => {
    expect(extractEvidenceMeta([{ type: "unrelated", description: "x" }])).toEqual({
      title: "",
      shows: "",
      proves: "",
    });
  });
});

describe("buildEvidenceManifest", () => {
  it("fails the entry when another browser run of the same test fails", () => {
    const manifest = buildEvidenceManifest(
      [
        run({ shots: [{ name: "newsletter", file: "newsletter-chromium.png" }] }),
        run({ browser: "firefox", outcome: "failed" }),
      ],
      GENERATED_AT,
    );

    expect(manifest.evidence).toHaveLength(1);
    const entry = manifest.evidence[0];
    expect(entry.id).toBe("newsletter");
    expect(entry.title).toBe("Newsletter abonnieren");
    expect(entry.spec).toBe(SPEC_FILE);
    expect(entry.test).toBe("toggles a newsletter");
    expect(entry.status).toBe("failed");
    expect(entry.browsers.chromium).toEqual({
      file: "newsletter-chromium.png",
      status: "passed",
    });
    expect(entry.browsers.firefox).toBeUndefined();
  });

  it("aggregates screenshots of the same name across browser projects", () => {
    const manifest = buildEvidenceManifest(
      [
        run({ shots: [{ name: "a", file: "a-chromium.png" }] }),
        run({
          browser: "firefox",
          shots: [{ name: "a", file: "a-firefox.png" }],
        }),
      ],
      GENERATED_AT,
    );

    expect(manifest.evidence).toHaveLength(1);
    const entry = manifest.evidence[0];
    expect(entry.status).toBe("passed");
    expect(Object.keys(entry.browsers)).toEqual(["chromium", "firefox"]);
  });

  it("omits metadata fields when the test has no evidence annotations", () => {
    const manifest = buildEvidenceManifest(
      [run({ annotations: [], shots: [{ name: "a", file: "a-chromium.png" }] })],
      GENERATED_AT,
    );
    const entry = manifest.evidence[0];
    expect("title" in entry).toBe(false);
    expect("shows" in entry).toBe(false);
    expect("proves" in entry).toBe(false);
  });

  it("throws naming both tests when a name is produced by two tests", () => {
    expect(() =>
      buildEvidenceManifest(
        [
          run({ shots: [{ name: "x", file: "x-chromium.png" }] }),
          run({
            logicalKey: "specs/other.spec.ts::renders other state",
            specFile: "specs/other.spec.ts",
            testTitle: "renders other state",
            browser: "firefox",
            shots: [{ name: "x", file: "x-firefox.png" }],
          }),
        ],
        GENERATED_AT,
      ),
    ).toThrow(
      'Screenshot name "x" is produced by 2 different tests: ' +
        `"toggles a newsletter" (${SPEC_FILE}), "renders other state" (specs/other.spec.ts)`,
    );
  });

  it("maps outcomes to manifest statuses", () => {
    const cases: Array<[EvidenceRun["outcome"], string]> = [
      ["passed", "passed"],
      ["flaky", "flaky"],
      ["skipped", "skipped"],
      ["timedOut", "failed"],
      ["interrupted", "failed"],
      ["unknown", "failed"],
      ["failed", "failed"],
    ];
    for (const [outcome, status] of cases) {
      const manifest = buildEvidenceManifest(
        [run({ outcome, shots: [{ name: "a", file: "a-chromium.png" }] })],
        GENERATED_AT,
      );
      expect(manifest.evidence[0]?.status).toBe(status);
      expect(manifest.evidence[0]?.browsers.chromium?.status).toBe(status);
    }
  });

  it("marks the worst outcome across browser runs as the entry status", () => {
    const manifest = buildEvidenceManifest(
      [
        run({ shots: [{ name: "a", file: "a-chromium.png" }] }),
        run({ browser: "firefox", outcome: "flaky" }),
      ],
      GENERATED_AT,
    );
    expect(manifest.evidence[0]?.status).toBe("flaky");
  });

  it("sorts entries by id and browsers by name", () => {
    const manifest = buildEvidenceManifest(
      [
        run({ shots: [{ name: "b", file: "b-webkit.png" }], browser: "webkit" }),
        run({ shots: [{ name: "b", file: "b-chromium.png" }] }),
        run({
          logicalKey: "specs/other.spec.ts::a test",
          specFile: "specs/other.spec.ts",
          testTitle: "a test",
          shots: [{ name: "a", file: "a-chromium.png" }],
        }),
      ],
      GENERATED_AT,
    );
    expect(manifest.evidence.map((e) => e.id)).toEqual(["a", "b"]);
    expect(Object.keys(manifest.evidence[1]?.browsers ?? {})).toEqual(["chromium", "webkit"]);
  });

  it("produces an empty manifest when no run took screenshots", () => {
    const manifest = buildEvidenceManifest([run({})], GENERATED_AT);
    expect(manifest).toEqual({ generatedAt: GENERATED_AT, evidence: [] });
  });
});
