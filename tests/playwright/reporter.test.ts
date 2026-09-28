import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FullConfig, TestCase, TestResult } from "@playwright/test/reporter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type EvidenceManifest, EvidenceManifestSchema } from "../../src/evidence/manifest.js";
import EvidenceReporter from "../../src/playwright/reporter.js";

const SPEC_FILE = "specs/newsletter.spec.ts";

const ANNOTATIONS = [
  { type: "evidence-title", description: "Newsletter abonnieren" },
  { type: "evidence-shows", description: "Der Newsletter-Tab" },
  { type: "evidence-proves", description: "Toggle speichert den Status" },
];

type FakeOutcome = ReturnType<TestCase["outcome"]>;

function evidenceAttachment(name: string, file: string): TestResult["attachments"][number] {
  return {
    name: "static-docs-evidence",
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ name, file })),
  } as TestResult["attachments"][number];
}

function fakeResult(overrides: Partial<TestResult>): TestResult {
  return { attachments: [], annotations: [], ...overrides } as TestResult;
}

function fakeTestCase(options: {
  id?: string;
  title?: string;
  file: string;
  project?: string;
  outcome: FakeOutcome;
  results: TestResult[];
  annotations?: TestCase["annotations"];
}): TestCase {
  const projectName = options.project;
  const test = {
    id: options.id ?? "t1",
    title: options.title ?? "toggles a newsletter",
    location: { file: options.file, line: 1, column: 1 },
    parent: { project: () => (projectName === undefined ? undefined : { name: projectName }) },
    annotations: options.annotations ?? [],
    results: options.results,
    outcome: () => options.outcome,
  };
  return test as unknown as TestCase;
}

describe("EvidenceReporter", () => {
  let rootDir: string;
  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "static-docs-reporter-"));
  });
  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  async function runReporter(tests: TestCase[]): Promise<EvidenceManifest> {
    const reporter = new EvidenceReporter({ outputDir: "out" });
    reporter.onBegin({ rootDir } as FullConfig);
    for (const test of tests) reporter.onTestEnd(test);
    await reporter.onEnd();
    const raw = JSON.parse(await readFile(path.join(rootDir, "out", "manifest.json"), "utf8"));
    return EvidenceManifestSchema.parse(raw);
  }

  /** Test file paths are absolute in Playwright; the reporter relativizes them. */
  const specFile = (rel = SPEC_FILE): string => path.join(rootDir, rel);

  it("writes a manifest that passes EvidenceManifestSchema", async () => {
    const manifest = await runReporter([
      fakeTestCase({
        file: specFile(),
        project: "chromium",
        outcome: "expected",
        results: [
          fakeResult({
            annotations: ANNOTATIONS,
            attachments: [evidenceAttachment("newsletter", "newsletter-chromium.png")],
          }),
        ],
      }),
    ]);

    expect(manifest.evidence).toHaveLength(1);
    const entry = manifest.evidence[0];
    expect(entry.id).toBe("newsletter");
    expect(entry.title).toBe("Newsletter abonnieren");
    expect(entry.spec).toBe(SPEC_FILE);
    expect(entry.status).toBe("passed");
    expect(entry.browsers.chromium).toEqual({
      file: "newsletter-chromium.png",
      status: "passed",
    });
  });

  it('uses "default" as the browser key for the unnamed default project', async () => {
    const manifest = await runReporter([
      fakeTestCase({
        file: specFile(),
        outcome: "expected",
        results: [fakeResult({ attachments: [evidenceAttachment("a", "a.png")] })],
      }),
    ]);
    expect(Object.keys(manifest.evidence[0]?.browsers ?? {})).toEqual(["default"]);
  });

  it("maps outcomes: expected→passed, flaky→flaky, skipped→skipped, unexpected→failed", async () => {
    const cases: Array<[FakeOutcome, string]> = [
      ["expected", "passed"],
      ["flaky", "flaky"],
      ["skipped", "skipped"],
      ["unexpected", "failed"],
    ];
    for (const [outcome, status] of cases) {
      const manifest = await runReporter([
        fakeTestCase({
          file: specFile(),
          project: "chromium",
          outcome,
          results: [fakeResult({ attachments: [evidenceAttachment("a", "a-chromium.png")] })],
        }),
      ]);
      expect(manifest.evidence[0]?.status).toBe(status);
    }
  });

  it("collects attachments and annotations across retries", async () => {
    const manifest = await runReporter([
      fakeTestCase({
        file: specFile(),
        project: "chromium",
        outcome: "flaky",
        results: [
          fakeResult({
            attachments: [evidenceAttachment("a", "a-chromium.png")],
          }),
          fakeResult({
            annotations: ANNOTATIONS,
            attachments: [evidenceAttachment("a", "a-chromium.png")],
          }),
        ],
      }),
    ]);

    const entry = manifest.evidence[0];
    expect(entry.status).toBe("flaky");
    expect(entry.title).toBe("Newsletter abonnieren");
    expect(Object.keys(entry.browsers)).toEqual(["chromium"]);
  });

  it("skips tests without evidence screenshots", async () => {
    const manifest = await runReporter([
      fakeTestCase({
        file: specFile(),
        project: "chromium",
        outcome: "expected",
        results: [fakeResult({})],
      }),
    ]);
    expect(manifest.evidence).toEqual([]);
  });

  it("aggregates browser projects under one entry", async () => {
    const manifest = await runReporter([
      fakeTestCase({
        id: "abc-chromium",
        file: specFile(),
        project: "chromium",
        outcome: "expected",
        results: [fakeResult({ attachments: [evidenceAttachment("a", "a-chromium.png")] })],
      }),
      fakeTestCase({
        id: "abc-firefox",
        file: specFile(),
        project: "firefox",
        outcome: "unexpected",
        results: [fakeResult({ attachments: [evidenceAttachment("a", "a-firefox.png")] })],
      }),
    ]);

    expect(manifest.evidence).toHaveLength(1);
    expect(manifest.evidence[0]?.status).toBe("failed");
    expect(Object.keys(manifest.evidence[0]?.browsers ?? {})).toEqual(["chromium", "firefox"]);
  });

  it("throws when two tests produce the same screenshot name", async () => {
    await expect(
      runReporter([
        fakeTestCase({
          file: specFile(),
          project: "chromium",
          outcome: "expected",
          results: [fakeResult({ attachments: [evidenceAttachment("x", "x-chromium.png")] })],
        }),
        fakeTestCase({
          id: "t2",
          title: "renders other state",
          file: specFile("specs/other.spec.ts"),
          project: "chromium",
          outcome: "expected",
          results: [fakeResult({ attachments: [evidenceAttachment("x", "x-chromium.png")] })],
        }),
      ]),
    ).rejects.toThrow('Screenshot name "x" is produced by 2 different tests');
  });
});
