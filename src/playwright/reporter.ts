import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FullConfig, Reporter, TestCase } from "@playwright/test/reporter";
import { EVIDENCE_MANIFEST_FILENAME } from "../evidence/manifest.js";
import {
  buildEvidenceManifest,
  EVIDENCE_ATTACHMENT_NAME,
  type EvidenceAnnotation,
  type EvidenceRun,
  type EvidenceShot,
  type RunOutcome,
} from "./manifest-builder.js";

export interface EvidenceReporterOptions {
  /**
   * Directory the evidence manifest is written to. Relative paths resolve
   * against the Playwright `rootDir` (the directory containing the Playwright
   * config file).
   */
  outputDir: string;
}

const mapOutcome = (outcome: ReturnType<TestCase["outcome"]>): RunOutcome => {
  switch (outcome) {
    case "expected":
      return "passed";
    case "flaky":
      return "flaky";
    case "skipped":
      return "skipped";
    default:
      return "failed";
  }
};

const dedupeAnnotations = (annotations: EvidenceAnnotation[]): EvidenceAnnotation[] => {
  const seen = new Set<string>();
  return annotations.filter((a) => {
    const key = `${a.type}:${a.description ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const parseShot = (body: Buffer | string): EvidenceShot | undefined => {
  try {
    const parsed: unknown = JSON.parse(body.toString());
    const shot = parsed as Partial<EvidenceShot> | null;
    if (typeof shot?.name === "string" && typeof shot?.file === "string") {
      return { name: shot.name, file: shot.file };
    }
  } catch {
    // Malformed evidence attachments are ignored, not fatal.
  }
  return undefined;
};

/**
 * Playwright reporter that collects `static-docs-evidence` attachments and
 * evidence annotations, then writes `<outputDir>/manifest.json` at the end of
 * the run. Tests without evidence screenshots are skipped. Register it as
 * `['@krizic/static-docs/playwright/reporter', { outputDir: 'e2e-screenshots' }]`.
 */
export default class EvidenceReporter implements Reporter {
  private readonly options: EvidenceReporterOptions;
  private rootDir: string | undefined;
  private runs = new Map<string, EvidenceRun>();

  constructor(options: EvidenceReporterOptions) {
    if (!options?.outputDir) {
      throw new Error("[static-docs] evidence reporter requires an 'outputDir' option");
    }
    this.options = options;
  }

  onBegin(config: FullConfig): void {
    this.rootDir = config.rootDir;
    this.runs.clear();
  }

  // Fires after every attempt; the run record is rebuilt from all results so
  // retries accumulate attachments and annotations instead of duplicating.
  onTestEnd(test: TestCase): void {
    // The default project has no name; give it a stable browser key.
    const projectName = test.parent.project()?.name || "default";
    const key = `${test.id}::${projectName}`;
    // Spec paths are stored relative to the rootDir, like the JSON report.
    const specFile = path.relative(this.rootDir ?? process.cwd(), test.location.file);

    const shots = new Map<string, EvidenceShot>();
    const annotations: EvidenceAnnotation[] = [...test.annotations];
    for (const result of test.results) {
      annotations.push(...result.annotations);
      for (const attachment of result.attachments) {
        if (attachment.name !== EVIDENCE_ATTACHMENT_NAME || !attachment.body) continue;
        const shot = parseShot(attachment.body);
        if (shot) shots.set(shot.name, shot);
      }
    }

    this.runs.set(key, {
      logicalKey: `${specFile}::${test.title}`,
      specFile,
      testTitle: test.title,
      browser: projectName,
      outcome: mapOutcome(test.outcome()),
      annotations: dedupeAnnotations(annotations),
      shots: [...shots.values()],
    });
  }

  async onEnd(): Promise<void> {
    const manifest = buildEvidenceManifest([...this.runs.values()], new Date().toISOString());
    const outDir = path.resolve(this.rootDir ?? process.cwd(), this.options.outputDir);
    await mkdir(outDir, { recursive: true });
    const manifestPath = path.join(outDir, EVIDENCE_MANIFEST_FILENAME);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`[static-docs] wrote ${manifestPath} (${manifest.evidence.length} evidence)`);
  }
}
