import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../../src/server.js";
import { RateLimiterRegistry } from "../../src/hertwill/rate-limiter.js";
import { mockServer } from "../mocks/server.js";

const TEST_PORT = 19876;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

/** Passthrough handler letting real HTTP requests reach our local test server. */
const localPassthrough = http.all(`${BASE_URL}/:path*`, () => passthrough());
const localRootPassthrough = http.all(BASE_URL, () => passthrough());

describe("HTTP remote transport", () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let registry: RateLimiterRegistry;
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // Re-register passthrough before each test because the global afterEach
  // in tests/setup.ts calls mockServer.resetHandlers() which clears them.
  beforeEach(() => {
    mockServer.use(localPassthrough, localRootPassthrough);
  });

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        mockServer.use(localPassthrough, localRootPassthrough);
        registry = new RateLimiterRegistry();

        httpServer = createHttpServer(async (req, res) => {
          const url = new URL(req.url ?? "/", BASE_URL);
          if (url.pathname !== "/mcp") {
            res.writeHead(404).end();
            return;
          }

          if (req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(
                typeof chunk === "string" ? Buffer.from(chunk) : chunk,
              );
            }
            const body = JSON.parse(Buffer.concat(chunks).toString());

            const sessionId = req.headers["mcp-session-id"] as
              | string
              | undefined;
            let transport = sessionId ? sessions.get(sessionId) : undefined;

            if (!transport) {
              transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => sessions.set(id, transport!),
                onsessionclosed: (id) => sessions.delete(id),
              });

              const server = createServer({ registry });
              await server.connect(transport);
            }

            await transport.handleRequest(req, res, body);
          } else {
            res.writeHead(405).end();
          }
        });

        httpServer.listen(TEST_PORT, "127.0.0.1", resolve);
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        registry.dispose();
        httpServer.close(() => resolve());
      }),
  );

  it("accepts initialize JSON-RPC and returns valid response", async () => {
    const res = await fetch(`${BASE_URL}/mcp`, {
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

    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE format: each event starts with "event:" or "data:"
    // OR direct JSON response — handle both
    let data: Record<string, unknown>;
    if (text.startsWith("{")) {
      data = JSON.parse(text);
    } else {
      // Parse SSE: extract the last data: line
      const dataLines = text
        .split("\n")
        .filter((l) => l.startsWith("data: "));
      const lastData = dataLines[dataLines.length - 1];
      data = JSON.parse(lastData.replace("data: ", ""));
    }

    expect(data).toHaveProperty("jsonrpc", "2.0");
    expect(data).toHaveProperty("id", 1);
    expect(data).toHaveProperty("result");
    const result = data.result as Record<string, unknown>;
    expect(result).toHaveProperty("serverInfo");
    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe("hertwill-mcp");
  });

  it("returns 404 for non-MCP paths", async () => {
    const res = await fetch(`${BASE_URL}/health`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 405 for non-POST methods on /mcp", async () => {
    const res = await fetch(`${BASE_URL}/mcp`, { method: "PUT" });
    expect(res.status).toBe(405);
  });

  it("per-key registry creates separate buckets for different sessions", () => {
    const pairA = registry.get("key_a");
    const pairB = registry.get("key_b");
    expect(pairA.public).not.toBe(pairB.public);
  });
});
