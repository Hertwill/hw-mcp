import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadStaticDoc } from "./static-doc-loader.js";
import type { ResourceDeps } from "./types.js";

export const EU_SHIPPING_URI = "hertwill://docs/eu-shipping";

const CONTENT = loadStaticDoc("eu-shipping.md");

export function registerEuShipping(
  server: McpServer,
  _deps: ResourceDeps,
): void {
  server.registerResource(
    "eu-shipping",
    EU_SHIPPING_URI,
    {
      title: "Hertwill EU shipping & VAT context",
      description:
        "EU VAT bands (20-27%), DDP vs DDU shipping terms, warehouse coverage, and shipping-time expectations. Read before quoting delivery times or pricing to end buyers.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "text/markdown", text: CONTENT },
      ],
    }),
  );
}
