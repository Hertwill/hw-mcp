import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess:
    "chmod +x dist/index.js && mkdir -p dist/docs/resources && cp docs/resources/rate-limits.md docs/resources/eu-shipping.md docs/resources/product.schema.json dist/docs/resources/",
});
