import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { confirmAction } from "../../src/elicitation.js";

function mockMcpServer(
  elicitResult: { status: string; data?: Record<string, unknown> } | "throw",
): McpServer {
  return {
    server: {
      elicitInput: () => {
        if (elicitResult === "throw") throw new Error("Not supported");
        return Promise.resolve(elicitResult);
      },
    },
  } as unknown as McpServer;
}

describe("confirmAction — elicitation helper", () => {
  it("returns true when user confirms", async () => {
    const server = mockMcpServer({ status: "completed", data: { confirmed: true } });
    expect(await confirmAction(server, "Do it?")).toBe(true);
  });

  it("returns false when user declines", async () => {
    const server = mockMcpServer({ status: "completed", data: { confirmed: false } });
    expect(await confirmAction(server, "Do it?")).toBe(false);
  });

  it("returns false when user cancels", async () => {
    const server = mockMcpServer({ status: "cancelled" });
    expect(await confirmAction(server, "Do it?")).toBe(false);
  });

  it("returns false when elicitation expires", async () => {
    const server = mockMcpServer({ status: "expired" });
    expect(await confirmAction(server, "Do it?")).toBe(false);
  });

  it("returns false (deny by default) when client does not support elicitation", async () => {
    const server = mockMcpServer("throw");
    expect(await confirmAction(server, "Do it?")).toBe(false);
  });
});
