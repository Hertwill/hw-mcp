import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { confirmAction } from "../elicitation.js";
import { HertwillApiError } from "../errors/api-error.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { RemoveFromImportListInput } from "../schemas/remove-from-import-list.js";
import { requireApiKey, toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof RemoveFromImportListInput>;

interface RemoveResult {
  product_id: number;
  status: "removed" | "failed";
  reason?: string;
}

/** Strip any hw_live_/hw_test_ key fragments from a reason string (T-5-05). */
function sanitizeReason(reason: string): string {
  return reason.replace(/hw_(live|test)_[a-zA-Z0-9]+/g, "hw_***_REDACTED");
}

export function createRemoveFromImportListHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const deny = requireApiKey(deps);
    if (deny) return deny as CallToolResult;

    // D-19 bucket-aware short-circuit: reservoir must cover the full batch.
    const reservoir = await deps.authLimiter.currentReservoir();
    if (reservoir !== null && reservoir < args.product_ids.length) {
      const retryAfter = deps.authRateReset.secondsRemaining() ?? 60;
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Rate limit exceeded. ${args.product_ids.length} removes requested but only ${reservoir} tokens remaining. Retry after ${retryAfter}s.`,
          },
        ],
      };
    }

    // Elicitation: confirm before removing from import list
    const confirmed = await confirmAction(
      deps.mcpServer,
      `Remove ${args.product_ids.length} product(s) from your import list? IDs: ${args.product_ids.join(", ")}`,
    );
    if (!confirmed) {
      return {
        content: [{ type: "text", text: "Removal cancelled by user." }],
      };
    }

    // D-19 sequential fan-out with best-effort per-item status.
    const results: RemoveResult[] = [];
    for (const id of args.product_ids) {
      try {
        await deps.client.removeFromImportList(id);
        results.push({ product_id: id, status: "removed" });
      } catch (err) {
        let reason = "unknown error";
        if (err instanceof HertwillApiError) {
          reason = `${err.code}: ${err.message}`;
        } else if (err instanceof Error) {
          reason = err.message;
        }
        results.push({
          product_id: id,
          status: "failed",
          reason: sanitizeReason(reason),
        });
      }
    }

    const succeeded = results.filter((r) => r.status === "removed").length;
    const failed = results.length - succeeded;
    const text =
      failed === 0
        ? `Removed ${succeeded} of ${results.length} product(s) from import list.`
        : `Removed ${succeeded} of ${results.length}; ${failed} failed. Agent may retry failed IDs.`;

    const result = {
      results,
      succeeded_count: succeeded,
      failed_count: failed,
    };
    return toolResult(result as unknown as Record<string, unknown>, text);
  };
}

export function registerRemoveFromImportList(
  server: McpServer,
  deps: ToolDeps,
): void {
  server.registerTool(
    "remove_from_import_list",
    {
      description: TOOL_DESCRIPTIONS.remove_from_import_list,
      inputSchema: RemoveFromImportListInput.shape,
    },
    createRemoveFromImportListHandler(deps),
  );
}
