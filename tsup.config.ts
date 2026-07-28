import { createRequire } from "node:module";
import { defineConfig } from "tsup";

// The config is an ES module, so createRequire avoids JSON import assertions,
// whose syntax varies across Node versions.
const pkg = createRequire(import.meta.url)("./package.json") as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
