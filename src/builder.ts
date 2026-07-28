import { rm } from "node:fs/promises";
import path from "node:path";
import {
  copyAssets,
  copyComponentScripts,
  copyMermaidRuntime,
} from "./assets.js";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { buildNavTree } from "./nav.js";
import { parseMarkdown } from "./parser/index.js";
import { renderComponentPage, renderPage } from "./renderer/page.js";
import { resolveRoutes } from "./router.js";
import { compileTheme } from "./theme.js";
import type { FileNode, ParsedMarkdown } from "./types.js";
import { outputFile } from "./utils/fs.js";
import { outFileFor } from "./utils/path.js";

export interface BuildResult {
  config: ResolvedConfig;
  pages: number;
}

export async function build(
  configPath = "static-docs.config.json",
): Promise<BuildResult> {
  const config = await loadConfig(configPath);
  const files = await resolveRoutes(config);
  if (files.length === 0) {
    console.warn("[static-docs] no markdown files found.");
  }
  const navTree = buildNavTree(files);

  await rm(config.outputDirAbs, { recursive: true, force: true });

  const assetVersion = Date.now().toString(36);
  const rendered: { file: FileNode; parsed: ParsedMarkdown }[] = [];
  for (const file of files) {
    const outPath = path.join(config.outputDirAbs, outFileFor(file.routePath));
    if (file.component) {
      await outputFile(
        outPath,
        renderComponentPage({ file, navTree, config, assetVersion }),
      );
      continue;
    }
    const parsed = await parseMarkdown(file, config);
    const html = renderPage({ file, parsed, navTree, config, assetVersion });
    await outputFile(outPath, html);
    rendered.push({ file, parsed });
  }

  await copyAssets(rendered, config);
  await copyComponentScripts(files, config);
  if (rendered.some((r) => r.parsed.hasMermaid)) {
    await copyMermaidRuntime(config);
  }
  await compileTheme(config);

  console.log(
    `[static-docs] built ${files.length} page(s) → ${config.outputDir}`,
  );
  return { config, pages: files.length };
}
