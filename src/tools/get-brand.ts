import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { HertwillApiError } from "../errors/api-error.js";
import { mapHertwillError } from "../errors/map.js";
import {
  TOOL_ANNOTATIONS,
  TOOL_DESCRIPTIONS,
  TOOL_TITLES,
} from "../schemas/descriptions.js";
import { GetBrandInput } from "../schemas/get-brand.js";
import { transformBrand } from "../transforms/index.js";
import { toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof GetBrandInput>;

export function createGetBrandHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const reservoir = await deps.publicLimiter.currentReservoir();
    if (reservoir !== null && reservoir <= 0) {
      const retryAfter = deps.publicRateReset.secondsRemaining() ?? 60;
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Rate limit exceeded. Retry after ${retryAfter}s.`,
          },
        ],
      };
    }

    try {
      const raw = await deps.client.getBrand(args.brand_id);
      const brand = transformBrand(raw.data);
      const assets = brand.marketing_assets_url
        ? "has marketing materials"
        : "no marketing materials link";
      const text = `Brand ${brand.id}: "${brand.name}" (${brand.slug}) — ${assets}.`;
      return toolResult(brand as unknown as Record<string, unknown>, text);
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

export function registerGetBrand(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_brand",
    {
      title: TOOL_TITLES.get_brand,
      description: TOOL_DESCRIPTIONS.get_brand,
      inputSchema: GetBrandInput.shape,
      annotations: TOOL_ANNOTATIONS.get_brand,
    },
    createGetBrandHandler(deps),
  );
}
