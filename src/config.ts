import { z } from "zod";

const ConfigSchema = z.object({
  hertwillApiKey: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  transport: z.enum(["stdio", "http"]).default("stdio"),
  httpPort: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    hertwillApiKey: process.env.HERTWILL_API_KEY,
    logLevel: process.env.HERTWILL_MCP_LOG_LEVEL,
    transport: process.env.HERTWILL_MCP_TRANSPORT,
    httpPort: process.env.HERTWILL_MCP_PORT,
  });
}
