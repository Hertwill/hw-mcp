import { createServer as createHttpServer } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { RateLimiterRegistry } from "./hertwill/rate-limiter.js";
import { createMcpHttpHandler } from "./http.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";
import { initTelemetry } from "./telemetry.js";

const config = loadConfig();
initTelemetry();

if (config.transport === "http") {
  // ── HTTP remote transport ──────────────────────────────────────────────
  const registry = new RateLimiterRegistry();
  const httpServer = createHttpServer(createMcpHttpHandler({ registry }));

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
