import { createRequire } from "node:module";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import { GALLERY_JS, GALLERY_JS_FILENAME } from "./evidence/client-script.js";
import { GALLERY_CSS, GALLERY_CSS_FILENAME } from "./evidence/styles.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists, outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

const require = createRequire(import.meta.url);

/** Copy assets referenced by each page next to its emitted index.html. */
export async function copyAssets(
  items: { file: FileNode; parsed: ParsedMarkdown }[],
  config: ResolvedConfig,
): Promise<void> {
  for (const { file, parsed } of items) {
    const srcDir = path.dirname(file.sourcePath);
    const outDir = path.dirname(
      path.join(config.outputDirAbs, outFileFor(file.routePath)),
    );
    for (const rel of parsed.assets) {
      const [clean] = rel.split(/[?#]/);
      const srcAbs = path.resolve(srcDir, clean);
      if (!(await exists(srcAbs))) {
        console.warn(
          `[static-docs] missing asset: ${clean} (from ${file.relativePath})`,
        );
        continue;
      }
      const destAbs = path.resolve(outDir, clean);
      await copyFileEnsured(srcAbs, destAbs);
    }
  }
}

/**
 * Copy the self-contained mermaid runtime bundle into `<output>/assets/`.
 * Called once per build when at least one page contains a mermaid diagram.
 */
export async function copyMermaidRuntime(
  config: ResolvedConfig,
): Promise<void> {
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
    const outDir = path.dirname(
      path.join(config.outputDirAbs, outFileFor(file.routePath)),
    );
    await copyFileEnsured(
      file.component.scriptSourceAbs,
      path.join(outDir, file.component.scriptFileName),
    );
  }
}

/** Copy every image referenced by each gallery's manifest next to its index.html. */
export async function copyEvidenceAssets(
  files: FileNode[],
  config: ResolvedConfig,
): Promise<void> {
  for (const file of files) {
    if (!file.evidence) continue;
    const outDir = path.dirname(
      path.join(config.outputDirAbs, outFileFor(file.routePath)),
    );
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
    const outDir = path.dirname(
      path.join(config.outputDirAbs, outFileFor(file.routePath)),
    );
    await outputFile(path.join(outDir, GALLERY_JS_FILENAME), GALLERY_JS);
    await outputFile(path.join(outDir, GALLERY_CSS_FILENAME), GALLERY_CSS);
  }
}
