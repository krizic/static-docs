#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { cac } from "cac";
import { build } from "./builder.js";
import { toJsonSchema } from "./config.js";
import { dev } from "./dev.js";
import { toEvidenceManifestJsonSchema } from "./evidence/manifest.js";
import { serve } from "./server.js";

const cli = cac("static-docs");

cli
  .command("build", "Build the static docs site")
  .option("--config <path>", "Path to config file", {
    default: "static-docs.config.json",
  })
  .action(async (options: { config: string }) => {
    try {
      await build(options.config);
    } catch (err) {
      console.error(`[static-docs] ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli
  .command("dev", "Start the dev server with live reload")
  .option("--config <path>", "Path to config file", {
    default: "static-docs.config.json",
  })
  .option("--port <port>", "Port", { default: 4321 })
  .action(async (options: { config: string; port: number }) => {
    try {
      await dev(options.config, Number(options.port));
    } catch (err) {
      console.error(`[static-docs] ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli
  .command("serve", "Serve the built site over HTTP")
  .option("--config <path>", "Path to config file", {
    default: "static-docs.config.json",
  })
  .option("--port <port>", "Port", { default: 8080 })
  .option("--dir <path>", "Directory to serve (overrides the config's outputDir)")
  .action(async (options: { config: string; port: number; dir?: string }) => {
    try {
      await serve({ config: options.config, port: Number(options.port), dir: options.dir });
    } catch (err) {
      console.error(`[static-docs] ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli
  .command("schema", "Write JSON Schema for the config to schema.json")
  .option("--out <path>", "Output path")
  .option("--manifest", "Emit the evidence manifest schema instead of the config schema", {
    default: false,
  })
  .action(async (options: { out?: string; manifest?: boolean }) => {
    const schema = options.manifest ? toEvidenceManifestJsonSchema() : toJsonSchema();
    const out = options.out ?? (options.manifest ? "evidence-manifest.schema.json" : "schema.json");
    await writeFile(out, JSON.stringify(schema, null, 2));
    console.log(`[static-docs] wrote ${out}`);
  });

cli.help();
cli.version(__PKG_VERSION__);
cli.parse();
