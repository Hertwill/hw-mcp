import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalculateMargin } from "./calculate-margin.js";
import { registerCheckHealth } from "./check-health.js";
import { registerEvaluateProduct } from "./evaluate-product.js";
import { registerGetProduct } from "./get-product.js";
import { registerListProducts } from "./list-products.js";
import { registerSearchProducts } from "./search-products.js";
import type { ToolDeps } from "./types.js";

/**
 * Register all public (unauthenticated) Hertwill MCP tools.
 *
 * Called unconditionally from `createServer()` — these tools work with no
 * API key. Phase 5 will mirror this with `registerAuthenticatedTools(server, deps)`
 * called only when `config.hertwillApiKey` is set.
 */
export function registerPublicTools(server: McpServer, deps: ToolDeps): void {
  registerSearchProducts(server, deps);
  registerListProducts(server, deps);
  registerGetProduct(server, deps);
  registerEvaluateProduct(server, deps);
  registerCalculateMargin(server, deps);
  registerCheckHealth(server, deps);
}

export type { ToolDeps } from "./types.js";
