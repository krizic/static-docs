---
title: Diagrams
description: Render Mermaid diagrams in your documentation
navCategory: Guides
navOrder: 2
---

# Diagrams

StaticDocs renders [Mermaid](https://mermaid.js.org/) diagrams from fenced code
blocks. Any code block tagged `mermaid` is turned into a diagram in the browser.

## Usage

Write a fenced code block with the `mermaid` language tag:

````markdown
```mermaid
flowchart LR
  A[Markdown] --> B[StaticDocs]
  B --> C{Diagram?}
  C -->|yes| D[Render SVG]
  C -->|no| E[Zero-JS page]
```
````

It renders as:

```mermaid
flowchart LR
  A[Markdown] --> B[StaticDocs]
  B --> C{Diagram?}
  C -->|yes| D[Render SVG]
  C -->|no| E[Zero-JS page]
```

## Sequence diagrams

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant M as mermaid.js
  U->>B: Open page with a diagram
  B->>M: Load runtime (only on diagram pages)
  M-->>B: Render SVG
```

## Notes

- The mermaid runtime is bundled into your output at `/assets/mermaid.min.js`
  and loaded locally — no CDN or network access required.
- The script is injected **only** on pages that contain a diagram. Pages without
  diagrams stay 100% zero-JS.
