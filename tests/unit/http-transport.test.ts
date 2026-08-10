import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { http, passthrough } from "msw";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RateLimiterRegistry } from "../../src/hertwill/rate-limiter.js";
import { createMcpHttpHandler } from "../../src/http.js";
import { mockServer } from "../mocks/server.js";

function parseSseOrJsonPayload(text: string): Record<string, unknown> {
  if (text.startsWith("{")) {
    return JSON.parse(text) as Record<string, unknown>;
  }

  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data: "));
  const payload = dataLines.at(-1)?.slice("data: ".length);
  if (!payload) {
    throw new Error(`Missing JSON-RPC payload in response: ${text}`);
  }

  return JSON.parse(payload) as Record<string, unknown>;
}

describe("HTTP remote transport", () => {
  let baseUrl = "";
  let httpServer: ReturnType<typeof createHttpServer>;
  let registry: RateLimiterRegistry;

  const registerLocalPassthrough = () => {
    if (!baseUrl) return;
    mockServer.use(
      http.all(baseUrl, () => passthrough()),
      http.all(`${baseUrl}/:path*`, () => passthrough()),
    );
  };

  beforeEach(() => {
    registerLocalPassthrough();
  });

  beforeAll(
    () =>
      new Promise<void>((resolve, reject) => {
        registry = new RateLimiterRegistry();
        httpServer = createHttpServer(createMcpHttpHandler({ registry }));

        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", () => {
          const address = httpServer.address() as AddressInfo | null;
          if (!address) {
            reject(
              new Error("HTTP test server did not expose a bound address"),
            );
            return;
          }

          baseUrl = `http://127.0.0.1:${address.port}`;
          registerLocalPassthrough();
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        registry.dispose();
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  );

  it("accepts initialize and reuses the negotiated session for follow-up requests", async () => {
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const initPayload = parseSseOrJsonPayload(await initRes.text());
    expect(initPayload).toHaveProperty("jsonrpc", "2.0");
    expect(initPayload).toHaveProperty("id", 1);

    const followUpRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Protocol-Version": "2025-03-26",
        "Mcp-Session-Id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    expect(followUpRes.status).toBe(200);
    const followUpPayload = parseSseOrJsonPayload(await followUpRes.text());
    expect(followUpPayload).toHaveProperty("id", 2);
    expect(followUpPayload).toHaveProperty("result");
  });

  it("returns a JSON-RPC parse error for malformed POST bodies", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: '{"jsonrpc":"2.0"',
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Parse error: Invalid JSON",
      },
      id: null,
    });
  });

  it("rejects non-initialize POSTs that do not include a valid session id", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
  });

  it("returns 404 when the client sends an unknown session id", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": "deadbeef-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Session not found",
      },
      id: null,
    });
  });

  it("returns 404 for non-MCP paths", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 405 for unsupported methods on /mcp", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "PUT" });
    expect(res.status).toBe(405);
  });

  it("per-key registry creates separate buckets for different sessions", () => {
    const pairA = registry.get("key_a");
    const pairB = registry.get("key_b");
    expect(pairA.public).not.toBe(pairB.public);
  });
});
