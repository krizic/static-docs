export { build } from "./builder.js";
export type { BuildResult } from "./builder.js";
export { ConfigSchema, loadConfig, toJsonSchema } from "./config.js";
export type { Config, ResolvedConfig } from "./config.js";
export { resolveRoutes } from "./router.js";
export type {
    ComponentSpec, FileNode, Frontmatter, NavNode, ParsedMarkdown, TocEntry
} from "./types.js";
export const version = __PKG_VERSION__;
