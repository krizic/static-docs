import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";
import {
  EVIDENCE_ANNOTATIONS,
  EVIDENCE_ATTACHMENT_NAME,
  type EvidenceMeta,
} from "./manifest-builder.js";

export * from "./manifest-builder.js";

/**
 * Declares evidence metadata for a test that produces verification
 * screenshots. The annotations are picked up by the evidence reporter and
 * merged into the evidence manifest.
 */
export function addEvidence(info: Pick<TestInfo, "annotations">, meta: EvidenceMeta): void {
  const entries: [string, string | undefined][] = [
    [EVIDENCE_ANNOTATIONS.title, meta.title],
    [EVIDENCE_ANNOTATIONS.shows, meta.shows],
    [EVIDENCE_ANNOTATIONS.proves, meta.proves],
  ];
  for (const [type, description] of entries) {
    if (description) info.annotations.push({ type, description });
  }
}

export interface EvidenceScreenshotOptions {
  /** Directory the PNG is written into (created recursively). */
  dir: string;
  /** Capture the full scrollable page instead of just the viewport. Defaults to true. */
  fullPage?: boolean;
  /** Clip the screenshot to this element instead of the page. */
  locator?: Locator;
  /** Extra CSS injected before capturing, e.g. to hide flaky UI. */
  style?: string;
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Saves `<slug(name)>-<slug(project)>.png` into `options.dir` and records it
 * as a `static-docs-evidence` attachment so the evidence reporter can add it
 * to the manifest.
 *
 * @returns The absolute path of the written file.
 */
export async function saveEvidenceScreenshot(
  page: Page,
  info: Pick<TestInfo, "annotations" | "attach" | "project" | "outputDir">,
  name: string,
  options: EvidenceScreenshotOptions,
): Promise<string> {
  await mkdir(options.dir, { recursive: true });

  const safeName = slug(name);
  // The unnamed default project gets a stable suffix, matching the reporter.
  const projectSlug = slug(info.project.name) || "default";
  const file = `${safeName}-${projectSlug}.png`;
  const filePath = path.resolve(options.dir, file);

  const shot = {
    path: filePath,
    animations: "disabled" as const,
    ...(options.style ? { style: options.style } : {}),
  };
  if (options.locator) {
    await options.locator.screenshot(shot);
  } else {
    await page.screenshot({ ...shot, fullPage: options.fullPage ?? true });
  }

  await info.attach(EVIDENCE_ATTACHMENT_NAME, {
    body: JSON.stringify({ name: safeName, file }),
    contentType: "application/json",
  });

  return filePath;
}
