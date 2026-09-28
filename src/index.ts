export type { BuildResult } from "./builder.js";
export { build } from "./builder.js";
export type { Config, ResolvedConfig } from "./config.js";
export { ConfigSchema, loadConfig, toJsonSchema } from "./config.js";
export type { BrowserShot, EvidenceEntry, EvidenceManifest } from "./evidence/manifest.js";
export {
  BrowserShotSchema,
  EvidenceEntrySchema,
  EvidenceManifestSchema,
  loadEvidenceManifest,
} from "./evidence/manifest.js";
export { resolveRoutes } from "./router.js";
export type {
  ComponentSpec,
  FileNode,
  Frontmatter,
  NavNode,
  ParsedMarkdown,
  TocEntry,
} from "./types.js";
export const version = __PKG_VERSION__;
