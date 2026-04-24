import { randomUUID } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { RateLimiterRegistry } from "./hertwill/rate-limiter.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";
import { initTelemetry } from "./telemetry.js";

const config = loadConfig();
initTelemetry();

if (config.transport === "http") {
  // ── HTTP remote transport ──────────────────────────────────────────────
  // Each session gets its own MCP server instance with per-key rate limiting.
  // The registry is shared across all sessions in the process.
  const registry = new RateLimiterRegistry();
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${config.httpPort}`);

    // Only /mcp is the MCP endpoint
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Extract API key from Authorization header for per-session isolation
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

    if (req.method === "POST") {
      // Parse the body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport = sessionId ? sessions.get(sessionId) : undefined;

      if (!transport) {
        // New session — create transport + server
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, transport!);
            logger.info({ sessionId: id }, "MCP session initialized");
          },
          onsessionclosed: (id) => {
            sessions.delete(id);
            logger.info({ sessionId: id }, "MCP session closed");
          },
        });

        const server = createServer({
          apiKey,
          registry,
        });
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, body);
    } else if (req.method === "GET") {
      // SSE stream for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (transport) {
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active session" }));
      }
    } else if (req.method === "DELETE") {
      // Session teardown
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (transport) {
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
      }
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  });

  httpServer.listen(config.httpPort, "127.0.0.1", () => {
    logger.info(
      { port: config.httpPort, transport: "http" },
      "hertwill-mcp server listening on http://127.0.0.1:%d/mcp",
      config.httpPort,
    );
  });
} else {
  // ── stdio transport (default, backward-compatible) ───────────────────
  logger.info("Starting hertwill-mcp server");

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("hertwill-mcp server connected via stdio");
}
