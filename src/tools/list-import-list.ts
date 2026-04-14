import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ListImportListInput } from "../schemas/list-import-list.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import {
  transformImportListItem,
  transformPagination,
} from "../transforms/index.js";
import { mapHertwillError } from "../errors/map.js";
import { HertwillApiError } from "../errors/api-error.js";
import { clampPerPage, requireApiKey } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof ListImportListInput>;

export function createListImportListHandler(deps: ToolDeps) {
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

    const { value: per_page, clamped } = clampPerPage(args.per_page);

    try {
      const raw = await deps.client.listImportList({
        page: args.page,
        per_page,
        status: args.status,
        order_by: args.order_by,
        order: args.order,
      });
      const items = (raw.data ?? []).map(transformImportListItem);
      const { pagination, hints: baseHints } = transformPagination(
        raw.meta?.pagination,
        "list_import_list",
      );
      const hints = clamped
        ? {
            next_step:
              "Agent: token budget caps pages at 20 items. Use page=N+1 to continue.",
          }
        : pagination.has_more
          ? baseHints
          : {
              next_step:
                "Use sync_products(product_id, default_store_markup) to push a staged item.",
            };
      const envelope = { items, pagination, hints };
      const clampNote = clamped
        ? ` (per_page reduced to 20 from requested ${args.per_page} to stay within token budget)`
        : "";
      const text =
        items.length === 0
          ? "Import list is empty."
          : `Listing ${items.length} import-list item(s) (page ${pagination.page}${
              pagination.has_more ? ", more available" : ""
            })${clampNote}.`;
      return {
        structuredContent: envelope as unknown as Record<string, unknown>,
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

export function registerListImportList(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "list_import_list",
    {
      description: TOOL_DESCRIPTIONS.list_import_list,
      inputSchema: ListImportListInput.shape,
    },
    createListImportListHandler(deps),
  );
}
