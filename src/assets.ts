import { createRequire } from "node:module";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists } from "./utils/fs.js";
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
