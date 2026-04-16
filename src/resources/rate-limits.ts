import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadStaticDoc } from "./static-doc-loader.js";
import type { ResourceDeps } from "./types.js";

export const RATE_LIMITS_URI = "hertwill://docs/rate-limits";

const CONTENT = loadStaticDoc("rate-limits.md");

export function registerRateLimits(
  server: McpServer,
  _deps: ResourceDeps,
): void {
  server.registerResource(
    "rate-limits",
    RATE_LIMITS_URI,
    {
      title: "Hertwill API rate limits",
      description:
        "Bucket structure (60/min public, 300/min authenticated), Retry-After behavior, and mitigation guidance. Read at session start so the agent can quote limits to the user before hitting a 429.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "text/markdown", text: CONTENT },
      ],
    }),
  );
}
