import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResourceDeps } from "./types.js";

export const BRANDS_URI = "hertwill://taxonomy/brands";

/**
 * RES-02: Register the Hertwill brand list as a readable MCP resource.
 *
 * Cached 60 minutes in-process via TaxonomyCache; falls back to
 * last-known-good with stale:true when upstream is unreachable.
 * D-25: never raises into the MCP transport.
 */
export function registerBrands(server: McpServer, deps: ResourceDeps): void {
  server.registerResource(
    "brands",
    BRANDS_URI,
    {
      title: "Hertwill brand list",
      description:
        "Current Hertwill brand list. Read once per session instead of calling list_brands. Cached 60 minutes in-process; falls back to last-known-good with stale:true when upstream is unreachable.",
      mimeType: "application/json",
    },
    async (uri) => {
      const result = await deps.taxonomyCache.get("brands", () =>
        deps.client.listBrands(),
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
