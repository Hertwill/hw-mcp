/**
 * Protocol-enforced confirmation for destructive tool actions.
 *
 * Uses the MCP elicitation API (Server.elicitInput) to render a native
 * confirmation form in compatible clients. Falls back gracefully to
 * "no confirmation needed" when the client doesn't support elicitation
 * (stdio clients, older protocol versions).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";

/**
 * Ask the user to confirm a destructive action via the MCP elicitation API.
 *
 * @returns `true` if the user confirms, `false` if cancelled/expired.
 *          Returns `true` (proceed) if the client doesn't support elicitation.
 */
export async function confirmAction(
  server: McpServer,
  message: string,
): Promise<boolean> {
  try {
    const result = await server.server.elicitInput({
      message,
      requestedSchema: {
        type: "object",
        properties: {
          confirmed: {
            type: "boolean",
            title: "Confirm",
            description: message,
            default: false,
          },
        },
        required: ["confirmed"],
      },
    });

    if (result.status !== "completed") {
      return false;
    }

    return result.data?.confirmed === true;
  } catch {
    // Client doesn't support elicitation — proceed without confirmation
    // (matches pre-elicitation behavior where tools executed immediately)
    logger.debug(
      "Elicitation not supported by client, proceeding without confirmation",
    );
    return true;
  }
}
