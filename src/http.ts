import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { RateLimiterRegistry } from "./hertwill/rate-limiter.js";
import { logger as defaultLogger } from "./logger.js";
import { createServer as createMcpServer } from "./server.js";

interface SessionRecord {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

interface HttpLogger {
  error: typeof defaultLogger.error;
  info: typeof defaultLogger.info;
}

export interface CreateMcpHttpHandlerOptions {
  createServer?: typeof createMcpServer;
  logger?: HttpLogger;
  registry?: RateLimiterRegistry;
}

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function writeJsonRpcError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  writeJson(res, status, {
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString());
}

function hasInitializeRequest(body: unknown): boolean {
  return (
    isInitializeRequest(body) ||
    (Array.isArray(body) &&
      body.some((message) => isInitializeRequest(message)))
  );
}

export function createMcpHttpHandler(
  options: CreateMcpHttpHandlerOptions = {},
) {
  const createServer = options.createServer ?? createMcpServer;
  const logger = options.logger ?? defaultLogger;
  const registry = options.registry ?? new RateLimiterRegistry();
  const sessions = new Map<string, SessionRecord>();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname !== "/mcp") {
      writeJson(res, 404, { error: "Not found" });
      return;
    }

    const sessionId = getHeaderValue(req.headers["mcp-session-id"]);

    try {
      if (req.method === "POST") {
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          writeJsonRpcError(res, 400, -32700, "Parse error: Invalid JSON");
          return;
        }

        let session = sessionId ? sessions.get(sessionId) : undefined;

        if (sessionId && !session) {
          writeJsonRpcError(res, 404, -32001, "Session not found");
          return;
        }

        if (!session && !hasInitializeRequest(body)) {
          writeJsonRpcError(
            res,
            400,
            -32000,
            "Bad Request: No valid session ID provided",
          );
          return;
        }

        if (!session) {
          const authHeader = getHeaderValue(req.headers.authorization);
          const apiKey = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7)
            : undefined;

          let transport!: StreamableHTTPServerTransport;
          const server = createServer({
            apiKey,
            registry,
          });

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, { server, transport });
              logger.info({ sessionId: id }, "MCP session initialized");
            },
            onsessionclosed: (id) => {
              const record = sessions.get(id);
              sessions.delete(id);
              void record?.server.close();
              logger.info({ sessionId: id }, "MCP session closed");
            },
          });

          transport.onerror = (error) => {
            logger.error(
              { err: error, sessionId: transport.sessionId },
              "MCP transport error",
            );
          };

          await server.connect(transport);
          session = { server, transport };
        }

        await session.transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        if (!sessionId) {
          writeJsonRpcError(
            res,
            400,
            -32000,
            "Bad Request: Mcp-Session-Id header is required",
          );
          return;
        }

        const session = sessions.get(sessionId);
        if (!session) {
          writeJsonRpcError(res, 404, -32001, "Session not found");
          return;
        }

        await session.transport.handleRequest(req, res);
        return;
      }

      writeJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
      logger.error({ err: error }, "Failed to handle MCP HTTP request");
      if (!res.headersSent) {
        writeJsonRpcError(res, 500, -32603, "Internal server error");
      }
    }
  };
}
