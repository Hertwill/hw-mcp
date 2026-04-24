import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CheckAuthInput } from "../schemas/check-auth.js";
import { TOOL_DESCRIPTIONS } from "../schemas/descriptions.js";
import type { ToolDeps } from "./types.js";

/**
 * D-18: PURE offline key-format parse. Zero network calls. Zero client
 * interaction. This file MUST NOT import the API client, helpers, or error
 * funnel — verified by Test 5 source grep.
 *
 * Limitation (documented in text summary): a format-valid key may still be
 * revoked or permission-limited server-side. To confirm live validity, the
 * agent should call any other authenticated tool (e.g. list_import_list)
 * which exercises the full 401 path through the error mapper.
 */
const KEY_REGEX = /^hw_(live|test)_[A-Za-z0-9\-_]+$/;

export function createCheckAuthHandler(deps: ToolDeps) {
  return async (): Promise<CallToolResult> => {
    const key = deps.apiKey;
    const configured = typeof key === "string" && key.length > 0;
    const match = configured ? KEY_REGEX.exec(key as string) : null;
    const formatValid = match !== null;
    const keyType: "live" | "test" | null = match
      ? (match[1] as "live" | "test")
      : null;

    const structured = {
      configured,
      format_valid: formatValid,
      key_type: keyType,
      note: "Key format validated locally (no network call). To confirm the key is active and permissioned, call any authenticated tool (e.g. list_import_list) which will surface a 401 if the key is revoked.",
    };

    const text = !configured
      ? "No API key configured. Set HERTWILL_API_KEY to enable authenticated tools."
      : formatValid
        ? `API key configured (type: ${keyType}). Format valid. Call list_import_list or similar to confirm server-side validity.`
        : "API key configured but format invalid — expected shape hw_live_... or hw_test_... followed by alphanumerics.";

    return {
      structuredContent: structured as unknown as Record<string, unknown>,
      content: [
        { type: "text", text },
        { type: "text", text: JSON.stringify(structured, null, 2) },
      ],
    };
  };
}

export function registerCheckAuth(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "check_auth",
    {
      description: TOOL_DESCRIPTIONS.check_auth,
      inputSchema: CheckAuthInput.shape,
    },
    createCheckAuthHandler(deps),
  );
}
