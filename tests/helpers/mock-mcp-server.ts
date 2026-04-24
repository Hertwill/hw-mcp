import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Minimal McpServer stub for tool handler tests.
 *
 * The `server.elicitInput()` call throws (simulating a client that doesn't
 * support elicitation), so `confirmAction()` gracefully falls back to
 * "proceed without confirmation" — matching pre-elicitation behavior.
 */
export function createMockMcpServer(): McpServer {
  return {
    server: {
      elicitInput: () => {
        throw new Error("Elicitation not supported");
      },
    },
  } as unknown as McpServer;
}
