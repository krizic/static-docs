import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { copyFileEnsured, exists } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

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
