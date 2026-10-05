import type { EvidenceManifest } from "./evidence/manifest.js";

export interface Frontmatter {
  title?: string;
  description?: string;
  navOrder?: number;
  navCategory?: string;
  hidden?: boolean;
  toc?: boolean;
  layout?: string;
  [key: string]: unknown;
}

export interface ComponentSpec {
  tag: string; // custom element tag to render
  scriptSourceAbs: string; // absolute path to the pre-built bundle
  scriptFileName: string; // file name emitted next to the route's index.html
}

export interface EvidenceSpec {
  sourceDirAbs: string; // absolute path to the gallery source dir
  manifest: EvidenceManifest; // validated manifest
}

export interface FileNode {
  sourcePath: string; // absolute path to .md; "" for component routes
  relativePath: string; // relative to repo root, posix
  routePath: string; // e.g. "/guides/start" or "/" for home
  frontmatter: Frontmatter;
  component?: ComponentSpec; // set for web-component routes
  evidence?: EvidenceSpec; // set for evidence-gallery routes
}

export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
  children: TocEntry[];
}

export interface NavNode {
  title: string;
  routePath?: string; // undefined for pure category folders
  order: number;
  hidden?: boolean;
  children: NavNode[];
}

export interface AssetRef {
  source: string; // absolute source path
  dest: string; // posix path relative to the output dir, e.g. "assets/media/img/a.png"
}

export interface ParsedMarkdown {
  html: string;
  toc: TocEntry[];
  frontmatter: Frontmatter;
  assets: AssetRef[]; // local assets referenced in the md
  hasMermaid: boolean; // true if the page contains a mermaid diagram
}
