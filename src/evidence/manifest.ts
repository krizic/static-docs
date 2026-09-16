import { readFile } from "node:fs/promises";
import { z } from "zod";

export const BrowserShotSchema = z.object({
  file: z.string().min(1),
  status: z.enum(["passed", "failed"]),
});

export const EvidenceEntrySchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  shows: z.string().min(1),
  proves: z.string().min(1),
  spec: z.string().optional(),
  test: z.string().optional(),
  status: z.enum(["passed", "failed"]),
  browsers: z.record(z.string(), BrowserShotSchema),
});

export const EvidenceManifestSchema = z.looseObject({
  generatedAt: z.string().min(1),
  evidence: z.array(EvidenceEntrySchema),
});

export type BrowserShot = z.infer<typeof BrowserShotSchema>;
export type EvidenceEntry = z.infer<typeof EvidenceEntrySchema>;
export type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;

/** Load and validate an evidence manifest; throws with actionable messages. */
export async function loadEvidenceManifest(
  manifestPath: string,
): Promise<EvidenceManifest> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Evidence manifest not found: ${manifestPath}`);
    }
    throw new Error(
      `Failed to parse evidence manifest ${manifestPath}: ${(err as Error).message}`,
    );
  }
  const parsed = EvidenceManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid evidence manifest ${manifestPath}:\n${msg}`);
  }
  const seen = new Set<string>();
  for (const entry of parsed.data.evidence) {
    if (seen.has(entry.id)) {
      throw new Error(
        `Invalid evidence manifest ${manifestPath}: duplicate evidence id "${entry.id}"`,
      );
    }
    seen.add(entry.id);
  }
  return parsed.data;
}
