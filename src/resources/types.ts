import type { ToolDeps } from "../tools/types.js";
import type { TaxonomyCache } from "./taxonomy-cache.js";

/**
 * Dependencies for MCP resource handlers.
 * Extends ToolDeps with the taxonomy cache used by categories/brands resources.
 */
export interface ResourceDeps extends ToolDeps {
  taxonomyCache: TaxonomyCache;
}
