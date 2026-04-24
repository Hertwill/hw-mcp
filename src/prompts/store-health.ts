import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PROMPT_DESCRIPTIONS } from "./descriptions.js";
import type { PromptDeps } from "./types.js";

function buildInstructions(): string {
  return [
    "You are running a Hertwill Store Health diagnostic to check your store connection and status.",
    "",
    "Follow these steps:",
    "",
    "1. Call `check_auth` to verify your API key is valid and see which store it is scoped to.",
    "2. Call `check_health` to check the MCP server version and Hertwill API reachability.",
    "   - Report the rate-limit budget: remaining requests for both the public and authenticated buckets.",
    "3. Call `list_import_list` (page 1) to get a summary of your current import list (total count, sample items).",
    "4. Call `get_sync_jobs` (page 1) to check recent sync job status.",
    "5. Present a consolidated diagnostic report with:",
    "   - Auth status: valid/invalid key, store name and scope",
    "   - API health: server version, Hertwill API reachable (yes/no)",
    "   - Rate-limit headroom: remaining requests in public and authenticated buckets",
    "   - Import list: total products count and a few sample items",
    "   - Sync status: recent sync jobs, their results (success/failure/pending)",
    "6. Flag any issues found:",
    "   - Invalid or expired API key",
    "   - Hertwill API unreachable",
    "   - Low rate-limit headroom (below 20% remaining)",
    "   - Failed sync jobs",
    "",
    "Present the report clearly so the user can quickly spot any problems with their store setup.",
  ].join("\n");
}

export function registerStoreHealth(
  server: McpServer,
  _deps: PromptDeps,
): void {
  server.registerPrompt(
    "hw-store-health",
    {
      title: "Store Health",
      description: PROMPT_DESCRIPTIONS["hw-store-health"],
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: buildInstructions(),
          },
        },
      ],
    }),
  );
}
