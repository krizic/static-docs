import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import type { Root, Element } from "hast";

export interface MermaidState {
  found: boolean;
}

/**
 * Rewrites fenced ```mermaid code blocks into `<pre class="mermaid">…</pre>`
 * nodes that the client-side mermaid runtime renders into SVG.
 *
 * Must run BEFORE rehype-pretty-code so the diagram source is left as plain
 * text instead of being syntax-highlighted. Sets `state.found` when at least
 * one diagram is present, so the caller knows to inject the mermaid script.
 */
export function rehypeMermaid(state: MermaidState) {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const code = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!code) return;
      const classes = code.properties?.className;
      const isMermaid =
        Array.isArray(classes) && classes.includes("language-mermaid");
      if (!isMermaid) return;

      const source = toString(code);
      state.found = true;
      node.properties = { className: ["mermaid"] };
      node.children = [{ type: "text", value: source }];
    });
  };
}
