export { build } from "./builder.js";
export type { BuildResult } from "./builder.js";
export { loadConfig, ConfigSchema, toJsonSchema } from "./config.js";
export type { Config, ResolvedConfig } from "./config.js";
export { resolveRoutes } from "./router.js";
export type {
  FileNode,
  NavNode,
  TocEntry,
  Frontmatter,
  ParsedMarkdown,
  ComponentSpec,
} from "./types.js";
export const version = "0.1.0";
