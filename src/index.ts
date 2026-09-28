export type { BuildResult } from "./builder.js";
export { build } from "./builder.js";
export type { Config, ResolvedConfig } from "./config.js";
export { ConfigSchema, loadConfig, toJsonSchema } from "./config.js";
export type {
  BrowserShot,
  EvidenceEntry,
  EvidenceManifest,
  EvidenceStatus,
} from "./evidence/manifest.js";
export {
  BrowserShotSchema,
  EVIDENCE_MANIFEST_FILENAME,
  EvidenceEntrySchema,
  EvidenceManifestSchema,
  EvidenceStatusSchema,
  loadEvidenceManifest,
  toEvidenceManifestJsonSchema,
} from "./evidence/manifest.js";
export { resolveRoutes } from "./router.js";
export type { ServeOptions, StaticHandlerOptions } from "./server.js";
export { createStaticHandler, serve } from "./server.js";
export type {
  ComponentSpec,
  FileNode,
  Frontmatter,
  NavNode,
  ParsedMarkdown,
  TocEntry,
} from "./types.js";
export const version = __PKG_VERSION__;
