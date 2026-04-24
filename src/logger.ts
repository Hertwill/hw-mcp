import pino from "pino";

export const logger = pino(
  { level: process.env.HERTWILL_MCP_LOG_LEVEL || "info" },
  pino.destination(2),
);
