import type { BrowserShot, EvidenceEntry, EvidenceManifest } from "../evidence/manifest.js";

/** Annotation types used to declare evidence metadata on a Playwright test. */
export const EVIDENCE_ANNOTATIONS = {
  title: "evidence-title",
  shows: "evidence-shows",
  proves: "evidence-proves",
} as const;

/**
 * Attachment name used to hand a written evidence screenshot from the test
 * process to the reporter.
 */
export const EVIDENCE_ATTACHMENT_NAME = "static-docs-evidence";

export type EvidenceMeta = Pick<EvidenceEntry, "title" | "shows" | "proves">;

export type RunOutcome =
  | "passed"
  | "failed"
  | "flaky"
  | "skipped"
  | "timedOut"
  | "interrupted"
  | "unknown";

export interface EvidenceAnnotation {
  type: string;
  description?: string;
}

export interface EvidenceShot {
  /** Sanitized screenshot name; becomes the evidence id in the manifest. */
  name: string;
  /** PNG file name relative to the output directory. */
  file: string;
}

/**
 * One Playwright test run (a single project/browser) with its evidence
 * annotations and the screenshots it produced. Plain data, free of Playwright
 * imports, so the builder stays unit-testable in Node.
 */
export interface EvidenceRun {
  /** Identifies the logical test across browser projects, e.g. "spec.ts::title". */
  logicalKey: string;
  specFile: string;
  testTitle: string;
  /** Playwright project name, e.g. "chromium". */
  browser: string;
  outcome: RunOutcome;
  annotations: EvidenceAnnotation[];
  shots: EvidenceShot[];
}

const STATUS_RANK: Record<RunOutcome, number> = {
  failed: 6,
  timedOut: 5,
  interrupted: 4,
  flaky: 3,
  unknown: 2,
  passed: 1,
  skipped: 0,
};

const worstOutcome = (outcomes: RunOutcome[]): RunOutcome =>
  outcomes.reduce((worst, o) => (STATUS_RANK[o] > STATUS_RANK[worst] ? o : worst));

type ManifestStatus = EvidenceEntry["status"];

/** Conservative mapping: anything that is not known-good fails the entry. */
const toManifestStatus = (outcome: RunOutcome): ManifestStatus => {
  switch (outcome) {
    case "passed":
      return "passed";
    case "flaky":
      return "flaky";
    case "skipped":
      return "skipped";
    default:
      return "failed";
  }
};

/** Reads the evidence annotations off a run; missing annotations yield empty strings. */
export function extractEvidenceMeta(annotations: EvidenceAnnotation[]): EvidenceMeta {
  const find = (type: string): string =>
    annotations.find((a) => a.type === type)?.description?.trim() ?? "";
  return {
    title: find(EVIDENCE_ANNOTATIONS.title),
    shows: find(EVIDENCE_ANNOTATIONS.shows),
    proves: find(EVIDENCE_ANNOTATIONS.proves),
  };
}

/**
 * Builds an evidence manifest from collected runs. Screenshots are grouped by
 * name across browser projects into one entry per name; the entry fails when
 * any run of the logical test failed — including browser runs that crashed
 * before taking a screenshot.
 *
 * @throws when the same screenshot name is produced by different tests.
 */
export function buildEvidenceManifest(runs: EvidenceRun[], generatedAt: string): EvidenceManifest {
  const runsByLogicalKey = new Map<string, EvidenceRun[]>();
  const producersByName = new Map<string, { run: EvidenceRun; file: string }[]>();
  for (const run of runs) {
    const list = runsByLogicalKey.get(run.logicalKey) ?? [];
    list.push(run);
    runsByLogicalKey.set(run.logicalKey, list);
    for (const shot of run.shots) {
      const producers = producersByName.get(shot.name) ?? [];
      producers.push({ run, file: shot.file });
      producersByName.set(shot.name, producers);
    }
  }

  const evidence: EvidenceEntry[] = [];
  for (const [name, producers] of producersByName) {
    const producingTests = [...new Map(producers.map((p) => [p.run.logicalKey, p.run])).values()];
    if (producingTests.length > 1) {
      const names = producingTests.map((r) => `"${r.testTitle}" (${r.specFile})`).join(", ");
      throw new Error(
        `Screenshot name "${name}" is produced by ${producingTests.length} different tests: ${names}; names must be unique`,
      );
    }
    const firstProducer = producers[0];
    if (!firstProducer) continue;
    const logicalKey = firstProducer.run.logicalKey;
    const projectRuns = runsByLogicalKey.get(logicalKey) ?? [];
    const first = projectRuns.find((r) => r.annotations.length > 0) ?? firstProducer.run;
    const meta = extractEvidenceMeta(first.annotations);

    const outcomeByBrowser = new Map<string, RunOutcome>();
    for (const run of projectRuns) outcomeByBrowser.set(run.browser, run.outcome);
    const browsers: Record<string, BrowserShot> = {};
    for (const { run, file } of producers) {
      outcomeByBrowser.set(run.browser, run.outcome);
      browsers[run.browser] = { file, status: toManifestStatus(run.outcome) };
    }

    const outcomes = [...outcomeByBrowser.values()];
    evidence.push({
      id: name,
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.shows ? { shows: meta.shows } : {}),
      ...(meta.proves ? { proves: meta.proves } : {}),
      spec: first.specFile,
      test: first.testTitle,
      status: toManifestStatus(outcomes.length > 0 ? worstOutcome(outcomes) : "unknown"),
      browsers: Object.fromEntries(Object.entries(browsers).sort(([a], [b]) => a.localeCompare(b))),
    });
  }

  evidence.sort((a, b) => a.id.localeCompare(b.id));
  return { generatedAt, evidence };
}
