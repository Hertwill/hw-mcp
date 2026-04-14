import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { RemoveFromImportListInput } from "../schemas/remove-from-import-list.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { HertwillApiError } from "../errors/api-error.js";
import { requireApiKey } from "./helpers.js";
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

    return {
      structuredContent: {
        results,
        succeeded_count: succeeded,
        failed_count: failed,
      } as unknown as Record<string, unknown>,
      content: [{ type: "text", text }],
    };
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
