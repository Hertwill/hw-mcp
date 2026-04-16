import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBrands } from "./brands.js";
import { registerCategories } from "./categories.js";
import { registerEuShipping } from "./eu-shipping.js";
import { registerProductSchema } from "./product-schema.js";
import { registerRateLimits } from "./rate-limits.js";
import type { ResourceDeps } from "./types.js";

/**
 * Register all 5 Hertwill MCP resources.
 *
 * Called UNCONDITIONALLY from `createServer()` (D-29). All 5 resources work
 * without an API key — taxonomy endpoints are public on Hertwill's side and
 * the schema/docs resources are static.
 */
export function registerResources(
  server: McpServer,
  deps: ResourceDeps,
): void {
  registerCategories(server, deps);
  registerBrands(server, deps);
  registerProductSchema(server, deps);
  registerRateLimits(server, deps);
  registerEuShipping(server, deps);
}

export type { ResourceDeps } from "./types.js";
export { createTaxonomyCache } from "./taxonomy-cache.js";
