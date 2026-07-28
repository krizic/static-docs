#!/usr/bin/env node
import { cac } from "cac";
import { writeFile } from "node:fs/promises";
import { build } from "./builder.js";
import { toJsonSchema } from "./config.js";
import { dev } from "./dev.js";

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
  .command("schema", "Write JSON Schema for the config to schema.json")
  .option("--out <path>", "Output path", { default: "schema.json" })
  .action(async (options: { out: string }) => {
    await writeFile(options.out, JSON.stringify(toJsonSchema(), null, 2));
    console.log(`[static-docs] wrote ${options.out}`);
  });

cli.help();
cli.version(__PKG_VERSION__);
cli.parse();
