import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResourceDeps } from "./types.js";

export const CATEGORIES_URI = "hertwill://taxonomy/categories";

/**
 * RES-01: Register the Hertwill category tree as a readable MCP resource.
 *
 * Cached 60 minutes in-process via TaxonomyCache; falls back to
 * last-known-good with stale:true when upstream is unreachable.
 * D-25: never raises into the MCP transport.
 */
export function registerCategories(
  server: McpServer,
  deps: ResourceDeps,
): void {
  server.registerResource(
    "categories",
    CATEGORIES_URI,
    {
      title: "Hertwill category tree",
      description:
        "Current Hertwill category tree. Read once per session instead of calling list_categories. Cached 60 minutes in-process; falls back to last-known-good with stale:true when upstream is unreachable.",
      mimeType: "application/json",
    },
    async (uri) => {
      const result = await deps.taxonomyCache.get("categories", () =>
        deps.client.listCategories(),
      );

      const body =
        "error" in result
          ? { error: result.error }
          : "stale" in result
            ? {
                stale: true,
                last_fetched_at: result.last_fetched_at,
                data: result.value,
              }
            : { data: result.value };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(body, null, 2),
          },
        ],
      };
    },
  );
}
