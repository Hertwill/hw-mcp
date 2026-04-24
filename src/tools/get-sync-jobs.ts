import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { HertwillApiError } from "../errors/api-error.js";
import { mapHertwillError } from "../errors/map.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import { GetSyncJobsInput } from "../schemas/get-sync-jobs.js";
import { transformPagination, transformSyncJob } from "../transforms/index.js";
import { clampPerPage, requireApiKey, toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof GetSyncJobsInput>;

export function createGetSyncJobsHandler(deps: ToolDeps) {
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

    const { value: per_page, clamped } = clampPerPage(args.per_page);

    try {
      const raw = await deps.client.listSyncJobs({
        page: args.page,
        per_page,
        status: args.status,
      });
      const items = raw.data.map(transformSyncJob);
      const { pagination, hints: baseHints } = transformPagination(
        raw.meta.pagination,
        "get_sync_jobs",
      );
      const hints = clamped
        ? {
            next_step:
              "Agent: token budget caps pages at 20 items. Use page=N+1 to continue.",
          }
        : pagination.has_more
          ? baseHints
          : { next_step: "All sync jobs returned." };

      const errorCount = items.filter((j) => j.has_errors).length;
      const clampNote = clamped
        ? ` (per_page reduced to ${per_page} from requested ${args.per_page} for token budget)`
        : "";

      const text =
        items.length === 0
          ? `No sync jobs${args.status ? ` with status=${args.status}` : ""}.`
          : `Found ${items.length} sync job(s) on page ${pagination.page}${
              errorCount > 0 ? `, ${errorCount} with errors` : ""
            }${pagination.has_more ? ", more available" : ""}${clampNote}.`;

      const envelope = { items, pagination, hints };
      return toolResult(envelope as unknown as Record<string, unknown>, text);
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

export function registerGetSyncJobs(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_sync_jobs",
    {
      description: TOOL_DESCRIPTIONS.get_sync_jobs,
      inputSchema: GetSyncJobsInput.shape,
    },
    createGetSyncJobsHandler(deps),
  );
}
