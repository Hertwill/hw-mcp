import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import { McpProductDetailSchema } from "../src/schemas/mcp-product-detail.js";

const schema = z.toJSONSchema(McpProductDetailSchema);

// Canonical JSON: recursively sort all keys, 2-space indent, trailing newline
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

const canonical = JSON.stringify(sortKeys(schema), null, 2) + "\n";

const outDir = new URL("../docs/resources/", import.meta.url);
mkdirSync(outDir, { recursive: true });

writeFileSync(
  new URL("../docs/resources/product.schema.json", import.meta.url),
  canonical,
);

process.stderr.write("Wrote docs/resources/product.schema.json\n");
