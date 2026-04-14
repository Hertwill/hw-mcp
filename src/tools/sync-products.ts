import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SyncProductsInput } from "../schemas/sync-products.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { mapHertwillError } from "../errors/map.js";
import { HertwillApiError } from "../errors/api-error.js";
import { requireApiKey } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof SyncProductsInput>;

export function createSyncProductsHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const deny = requireApiKey(deps);
    if (deny) return deny as CallToolResult;

    const reservoir = await deps.authLimiter.currentReservoir();
    if (reservoir !== null && reservoir <= 0) {
      const retryAfter = deps.authRateReset.secondsRemaining() ?? 60;
      return {
        isError: true,
        content: [
          { type: "text", text: `Rate limit exceeded. Retry after ${retryAfter}s.` },
        ],
      };
    }

    try {
      const raw = await deps.client.syncProducts({
        product_id: args.product_id,
        default_store_markup: args.default_store_markup,
        currency: args.currency,
        lang: args.lang,
      });
      const data = raw.data;
      const markupPct = Math.round((args.default_store_markup - 1) * 100);
      const text = `Sync started for product ${args.product_id} (markup ${markupPct}%, status ${data.status}). ${data.message ?? ""}`.trim();
      return {
        structuredContent: {
          product_id: data.product_id,
          status: data.status,
          message: data.message ?? null,
          markup_multiplier: args.default_store_markup,
        } as unknown as Record<string, unknown>,
        content: [{ type: "text", text }],
      };
    } catch (err) {
      const mapped = mapHertwillError(err);
      if (
        err instanceof HertwillApiError &&
        err.retryAfterSeconds !== undefined &&
        mapped.content[0]?.type === "text"
      ) {
        mapped.content[0].text = `Retry after ${err.retryAfterSeconds}s. ${mapped.content[0].text}`;
      }
      return mapped as CallToolResult;
    }
  };
}

export function registerSyncProducts(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "sync_products",
    {
      description: TOOL_DESCRIPTIONS.sync_products,
      inputSchema: SyncProductsInput.shape,
    },
    createSyncProductsHandler(deps),
  );
}
