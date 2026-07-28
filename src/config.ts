import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const RouteSchema = z.object({
  path: z.string(),
  source: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * A custom element tag must contain a hyphen, start with an ASCII letter, and
 * contain no whitespace or HTML-significant characters. The hyphen rule is the
 * HTML spec requirement; the character restrictions also stop a config value
 * from breaking out of the tag it is interpolated into.
 */
export function isValidCustomElementTag(tag: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag);
}

export const ComponentRouteSchema = z.object({
  path: z.string(),
  tag: z.string().refine(isValidCustomElementTag, {
    message:
      'must be a valid custom element name: lowercase, containing a hyphen (e.g. "my-workbench")',
  }),
  script: z.string(),
  title: z.string().optional(),
  navCategory: z.string().optional(),
  navOrder: z.number().optional(),
  hidden: z.boolean().default(false),
});

export type ComponentRoute = z.infer<typeof ComponentRouteSchema>;

export const VersionSchema = z.union([
  z.string(),
  z.object({
    file: z.string(),
    field: z.string().default("version"),
  }),
]);

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  siteName: z.string().default("Documentation"),
  outputDir: z.string().default("./docs-build"),
  basePath: z.string().default("/"),
  version: VersionSchema.optional(),
  exclude: z.array(z.string()).default([]),
  theme: z.enum(["default", "minimal"]).default("default"),
  customCss: z.string().optional(),
  routes: z.array(RouteSchema).optional(),
  componentRoutes: z.array(ComponentRouteSchema).optional(),
  sidebar: z
    .object({
      auto: z.boolean().default(true),
      collapsedDepth: z.number().int().default(1),
      exclude: z.array(z.string()).default([]),
    })
    .default({ auto: true, collapsedDepth: 1, exclude: [] }),
  toc: z
    .object({
      enabled: z.boolean().default(true),
      minDepth: z.number().int().default(2),
      maxDepth: z.number().int().default(4),
    })
    .default({ enabled: true, minDepth: 2, maxDepth: 4 }),
  markdown: z
    .object({
      gfm: z.boolean().default(true),
      smartypants: z.boolean().default(true),
      shikiTheme: z.string().default("github-dark"),
    })
    .default({ gfm: true, smartypants: true, shikiTheme: "github-dark" }),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ResolvedConfig extends Config {
  rootDir: string; // dir containing the config file
  outputDirAbs: string; // absolute output dir
  versionString?: string; // resolved documentation version, if any
}

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const abs = path.resolve(configPath);
  const rootDir = path.dirname(abs);
  let raw: unknown = {};
  try {
    raw = JSON.parse(await readFile(abs, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Config not found: ${abs}`);
    }
    throw new Error(`Failed to parse config ${abs}: ${(err as Error).message}`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${msg}`);
  }
  const cfg = parsed.data;
  return {
    ...cfg,
    rootDir,
    outputDirAbs: path.resolve(rootDir, cfg.outputDir),
    versionString: await resolveVersion(cfg.version, rootDir),
  };
}

async function resolveVersion(
  version: Config["version"],
  rootDir: string,
): Promise<string | undefined> {
  if (version === undefined) return undefined;
  if (typeof version === "string") {
    const v = version.trim();
    return v || undefined;
  }
  const fileAbs = path.resolve(rootDir, version.file);
  try {
    const data = JSON.parse(await readFile(fileAbs, "utf8"));
    const value = data?.[version.field];
    if (typeof value === "string" && value.trim()) return value.trim();
    console.warn(
      `[static-docs] version: field "${version.field}" not found or not a string in ${version.file}`,
    );
    return undefined;
  } catch {
    console.warn(`[static-docs] version: could not read ${version.file}`);
    return undefined;
  }
}

export function toJsonSchema(): unknown {
  return z.toJSONSchema(ConfigSchema);
}
