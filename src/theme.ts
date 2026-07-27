import path from "node:path";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { ResolvedConfig } from "./config.js";
import { outputFile, exists } from "./utils/fs.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)); // dist/ at runtime

async function themeCssPath(theme: string): Promise<string> {
  // Search dist-relative and src-relative locations.
  const candidates = [
    path.resolve(here, "themes", theme, "theme.css"),
    path.resolve(here, "..", "src", "themes", theme, "theme.css"),
  ];
  for (const c of candidates) if (await exists(c)) return c;
  throw new Error(
    `Theme "${theme}" CSS not found. Looked in:\n${candidates.join("\n")}`,
  );
}

function tailwindBin(): string {
  // @tailwindcss/cli exposes a bin; resolve its package then the bin path.
  const pkgJson = require.resolve("@tailwindcss/cli/package.json");
  const dir = path.dirname(pkgJson);
  const pkg = require("@tailwindcss/cli/package.json") as {
    bin?: Record<string, string> | string;
  };
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.tailwindcss;
  if (!rel) throw new Error("Cannot locate @tailwindcss/cli binary");
  return path.resolve(dir, rel);
}

export async function compileTheme(config: ResolvedConfig): Promise<void> {
  const themeCss = await themeCssPath(config.theme);
  const outDir = config.outputDirAbs;
  const entryPath = path.join(outDir, "_entry.css");
  const themeImport = JSON.stringify(themeCss.replace(/\\/g, "/"));
  const sourceGlob = JSON.stringify(
    path.join(outDir, "**/*.html").replace(/\\/g, "/"),
  );

  let entry = `@import ${themeImport};\n@source ${sourceGlob};\n`;
  if (config.customCss) {
    const customAbs = path.resolve(config.rootDir, config.customCss);
    entry += `@import ${JSON.stringify(customAbs.replace(/\\/g, "/"))};\n`;
  }
  await outputFile(entryPath, entry);

  const outCss = path.join(outDir, "theme.css");
  await runTailwind(entryPath, outCss);
  await rm(entryPath, { force: true });
}

function runTailwind(input: string, output: string): Promise<void> {
  const bin = tailwindBin();
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [bin, "-i", input, "-o", output, "--minify"],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Tailwind CLI exited with code ${code}`)),
    );
  });
}
