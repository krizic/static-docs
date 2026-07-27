import matter from "gray-matter";
import type { Frontmatter } from "../types.js";

export function extractMeta(raw: string): {
  content: string;
  data: Frontmatter;
} {
  const parsed = matter(raw);
  return { content: parsed.content, data: parsed.data as Frontmatter };
}
