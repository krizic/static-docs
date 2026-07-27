export { build } from "./builder.js";
export type { BuildResult } from "./builder.js";
export { loadConfig, ConfigSchema, toJsonSchema } from "./config.js";
export type { Config, ResolvedConfig } from "./config.js";
export type {
  FileNode,
  NavNode,
  TocEntry,
  Frontmatter,
  ParsedMarkdown,
} from "./types.js";
export const version = "0.1.0";
