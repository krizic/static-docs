import { createRequire } from "node:module";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import { GALLERY_JS, GALLERY_JS_FILENAME } from "./evidence/client-script.js";
import { GALLERY_CSS, GALLERY_CSS_FILENAME } from "./evidence/styles.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists, outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

const require = createRequire(import.meta.url);

/**
 * Copy media referenced from markdown (images, video, PDFs, …) into
 * `<output>/assets/media/`, mirroring their location relative to the project
 * root. The parser has already rewritten the HTML to point at these paths.
 */
export async function copyAssets(
  items: { file: FileNode; parsed: ParsedMarkdown }[],
  config: ResolvedConfig,
): Promise<void> {
  const copied = new Set<string>();
  for (const { parsed } of items) {
    for (const { source, dest } of parsed.assets) {
      if (copied.has(dest)) continue;
      copied.add(dest);
      if (!(await exists(source))) continue;
      await copyFileEnsured(source, path.join(config.outputDirAbs, dest));
    }
  }
}

/**
 * Copy the self-contained mermaid runtime bundle into `<output>/assets/`.
 * Called once per build when at least one page contains a mermaid diagram.
 */
export async function copyMermaidRuntime(config: ResolvedConfig): Promise<void> {
  const src = require.resolve("mermaid/dist/mermaid.min.js");
  const dest = path.join(config.outputDirAbs, "assets", "mermaid.min.js");
  await copyFileEnsured(src, dest);
}

/** Copy each component route's bundle next to that route's index.html. */
export async function copyComponentScripts(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.component) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    await copyFileEnsured(
      file.component.scriptSourceAbs,
      path.join(outDir, file.component.scriptFileName),
    );
  }
}

/** Copy every image referenced by each gallery's manifest next to its index.html. */
export async function copyEvidenceAssets(files: FileNode[], config: ResolvedConfig): Promise<void> {
  for (const file of files) {
    if (!file.evidence) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    const seen = new Set<string>();
    for (const entry of file.evidence.manifest.evidence) {
      for (const shot of Object.values(entry.browsers)) {
        if (seen.has(shot.file)) continue;
        seen.add(shot.file);
        const srcAbs = path.resolve(file.evidence.sourceDirAbs, shot.file);
        if (!(await exists(srcAbs))) {
          console.warn(
            `[static-docs] missing evidence image: ${shot.file} (gallery ${file.routePath})`,
          );
          continue;
        }
        await copyFileEnsured(srcAbs, path.join(outDir, shot.file));
      }
    }
  }
}

/** Emit the gallery client JS and CSS next to each gallery route's index.html. */
export async function copyEvidenceRuntime(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.evidence) continue;
    const outDir = path.dirname(path.join(config.outputDirAbs, outFileFor(file.routePath)));
    await outputFile(path.join(outDir, GALLERY_JS_FILENAME), GALLERY_JS);
    await outputFile(path.join(outDir, GALLERY_CSS_FILENAME), GALLERY_CSS);
  }
}
