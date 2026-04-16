import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { McpProductDetailSchema } from "../../../src/schemas/mcp-product-detail.js";

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

describe("product.schema.json drift gate (D-28)", () => {
  it("committed JSON matches regenerated output from McpProductDetailSchema", () => {
    const committedText = readFileSync(
      new URL("../../../docs/resources/product.schema.json", import.meta.url),
      "utf8",
    );
    const regenerated = z.toJSONSchema(McpProductDetailSchema);
    const canonical =
      JSON.stringify(sortKeys(regenerated), null, 2) + "\n";
    // if this fails, run: pnpm generate:schema
    expect(committedText).toBe(canonical);
  });

  it("schema has required product detail fields", () => {
    const regenerated = z.toJSONSchema(McpProductDetailSchema);
    const requiredFields = [
      "id",
      "slug",
      "name",
      "description",
      "sku",
      "price",
      "stock",
      "ships_to",
      "category",
      "variations",
    ];
    for (const field of requiredFields) {
      expect(
        (regenerated as { properties?: Record<string, unknown> }).properties,
      ).toHaveProperty(field);
    }
  });

  it("schema does not use non-JSON-representable Zod types", async () => {
    const source = readFileSync(
      new URL("../../../src/schemas/mcp-product-detail.ts", import.meta.url),
      "utf8",
    );
    // Strip comments before checking — the comment block mentions these types as warnings
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    // Pitfall 2: z.date(), z.function(), z.symbol(), z.promise() produce broken JSON Schema
    expect(codeOnly).not.toMatch(/z\.(date|function|symbol|promise)\(/);
  });
});
