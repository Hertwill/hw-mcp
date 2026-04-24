import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const BINARY = resolve(import.meta.dirname, "../../dist/index.js");

describe("stdio server initialization", () => {
  it("responds to initialize with valid JSON-RPC without an API key (FOUND-04, FOUND-06)", async () => {
    const proc = spawn("node", [BINARY], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HERTWILL_API_KEY: undefined, HERTWILL_MCP_LOG_LEVEL: "error" },
    });

    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    // MCP SDK StdioServerTransport uses newline-delimited JSON-RPC
    proc.stdin.write(initRequest + "\n");

    const response = await new Promise<string>((resolve, reject) => {
      let data = "";
      proc.stdout.on("data", (chunk) => {
        data += chunk.toString();
        // Response is a newline-delimited JSON line
        if (data.includes("\n")) {
          resolve(data.trim());
        }
      });
      proc.stderr.on("data", () => {}); // drain stderr
      setTimeout(() => reject(new Error("Timeout waiting for initialize response")), 5000);
    });

    const parsed = JSON.parse(response);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result).toBeDefined();
    expect(parsed.result.protocolVersion).toBeDefined();
    expect(parsed.result.serverInfo).toBeDefined();
    expect(parsed.result.serverInfo.name).toBe("hertwill-mcp");

    proc.kill();
  });

  it("produces no stdout output before receiving a request", async () => {
    const proc = spawn("node", [BINARY], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HERTWILL_API_KEY: undefined, HERTWILL_MCP_LOG_LEVEL: "error" },
    });

    // Wait 500ms without sending anything
    const earlyOutput = await new Promise<string>((resolve) => {
      let data = "";
      proc.stdout.on("data", (chunk) => { data += chunk.toString(); });
      setTimeout(() => resolve(data), 500);
    });

    expect(earlyOutput).toBe("");
    proc.kill();
  });
});
