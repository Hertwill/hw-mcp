import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAddToImportList } from "./add-to-import-list.js";
import { registerCalculateMargin } from "./calculate-margin.js";
import { registerCheckAuth } from "./check-auth.js";
import { registerCheckHealth } from "./check-health.js";
import { registerEvaluateProduct } from "./evaluate-product.js";
import { registerGetProduct } from "./get-product.js";
import { registerGetSyncJobs } from "./get-sync-jobs.js";
import { registerListImportList } from "./list-import-list.js";
import { registerListProducts } from "./list-products.js";
import { registerRemoveFromImportList } from "./remove-from-import-list.js";
import { registerSearchProducts } from "./search-products.js";
import { registerSyncProducts } from "./sync-products.js";
import type { ToolDeps } from "./types.js";

/**
 * Register all public (unauthenticated) Hertwill MCP tools.
 *
 * Called unconditionally from `createServer()` — these tools work with no
 * API key.
 */
export function registerPublicTools(server: McpServer, deps: ToolDeps): void {
  registerSearchProducts(server, deps);
  registerListProducts(server, deps);
  registerGetProduct(server, deps);
  registerEvaluateProduct(server, deps);
  registerCalculateMargin(server, deps);
  registerCheckHealth(server, deps);
}

/**
 * Register all authenticated (API-key-required) Hertwill MCP tools.
 *
 * Called from `createServer()` ONLY when `deps.apiKey` is a non-empty string
 * (per D-24). With no key, these tools don't appear in the MCP `listTools`
 * output at all.
 */
export function registerAuthenticatedTools(
  server: McpServer,
  deps: ToolDeps,
): void {
  registerListImportList(server, deps);
  registerAddToImportList(server, deps);
  registerRemoveFromImportList(server, deps);
  registerSyncProducts(server, deps);
  registerGetSyncJobs(server, deps);
  registerCheckAuth(server, deps);
}

export type { ToolDeps } from "./types.js";
