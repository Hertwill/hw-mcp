import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { confirmAction } from "../elicitation.js";
import { HertwillApiError } from "../errors/api-error.js";
import { mapHertwillError } from "../errors/map.js";
import { AddToImportListInput } from "../schemas/add-to-import-list.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { requireApiKey, toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof AddToImportListInput>;

export function createAddToImportListHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const deny = requireApiKey(deps);
    if (deny) return deny as CallToolResult;

    const reservoir = await deps.authLimiter.currentReservoir();
    if (reservoir !== null && reservoir <= 0) {
      const retryAfter = deps.authRateReset.secondsRemaining() ?? 60;
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
      // Elicitation: confirm before mutating the import list
      const confirmed = await confirmAction(
        deps.mcpServer,
        `Add ${args.product_ids.length} product(s) to your import list? IDs: ${args.product_ids.join(", ")}`,
      );
      if (!confirmed) {
        return {
          content: [{ type: "text", text: "Import cancelled by user." }],
        };
      }

      // D-20: NO pre-add stock probe. Directly call addToImportList and
      // surface Hertwill's native POST response.
      const raw = await deps.client.addToImportList(args.product_ids);
      const results = raw.data ?? [];
      const text = `Added ${results.length} of ${args.product_ids.length} product(s) to import list.`;
      const result = {
        results,
        requested_count: args.product_ids.length,
        added_count: results.length,
      };
      return toolResult(result as unknown as Record<string, unknown>, text);
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

export function registerAddToImportList(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "add_to_import_list",
    {
      description: TOOL_DESCRIPTIONS.add_to_import_list,
      inputSchema: AddToImportListInput.shape,
    },
    createAddToImportListHandler(deps),
  );
}
