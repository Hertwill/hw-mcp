import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Minimal McpServer stub for tool handler tests.
 *
 * Simulates a client that supports elicitation and auto-confirms.
 * This lets destructive tool tests (add/remove/sync) proceed as expected.
 */
export function createMockMcpServer(): McpServer {
  return {
    server: {
      elicitInput: () =>
        Promise.resolve({ status: "completed", data: { confirmed: true } }),
    },
  } as unknown as McpServer;
}
