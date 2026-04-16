import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResourceDeps } from "./types.js";

export const PRODUCT_SCHEMA_URI = "hertwill://schemas/product";

/**
 * Resolve the schema file across dev (`tsx src/index.ts` — source tree) and
 * prod (`node dist/index.js` — bundled, docs copied into dist/docs/) layouts.
 *
 * Dev:  <repo>/src/resources/product-schema.ts   →  ../../docs/resources/product.schema.json
 * Prod: <pkg>/dist/index.js                      →  ./docs/resources/product.schema.json
 */
function loadSchemaText(): string {
  const candidates = [
    new URL("../../docs/resources/product.schema.json", import.meta.url), // dev
    new URL("./docs/resources/product.schema.json", import.meta.url), // prod
  ];
  for (const url of candidates) {
    try {
      return readFileSync(url, "utf8");
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    "docs/resources/product.schema.json not found in dev or prod layout — ensure tsup copied the file into dist/",
  );
}

// Read once at module load. Throws only at startup if the file is missing;
// this surfaces misconfiguration immediately instead of per-read.
const SCHEMA_TEXT = loadSchemaText();

export function registerProductSchema(
  server: McpServer,
  _deps: ResourceDeps,
): void {
  server.registerResource(
    "product-schema",
    PRODUCT_SCHEMA_URI,
    {
      title: "Hertwill product JSON schema",
      description:
        "JSON Schema 2020-12 document describing the shape of Hertwill product detail responses. Read to reason about field shapes without making a probe tool call.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: SCHEMA_TEXT,
        },
      ],
    }),
  );
}
