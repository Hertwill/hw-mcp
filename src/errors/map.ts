import { HertwillApiError } from "./api-error.js";
import { HertwillSchemaMismatchError } from "./schema-error.js";

interface McpToolError {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
}

/** Sanitize text to remove any API key fragments */
function sanitize(text: string): string {
  return text.replace(/hw_(live|test)_[a-zA-Z0-9]+/g, "hw_***_REDACTED");
}

export function mapHertwillError(err: unknown): McpToolError {
  if (err instanceof HertwillApiError) {
    let hint = "";
    if (err.status === 429) {
      hint =
        " The API rate limit was exceeded. Please wait a moment and try again.";
    } else if (err.status >= 500) {
      hint =
        " This is a server error on Hertwill's side. You can retry in a few seconds.";
    } else if (err.status === 401) {
      hint =
        " The API key is missing or invalid. Set HERTWILL_API_KEY in your MCP server configuration.";
    } else if (err.status === 403) {
      hint =
        " Access denied. Your API key may not have permission for this action.";
    } else if (err.status === 404) {
      hint =
        " The requested resource was not found. Check the ID or slug and try again.";
    } else if (err.status === 422) {
      hint =
        " Invalid request parameters. Check the input values and try again.";
    }

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: sanitize(`${err.code}: ${err.message}${hint}`),
        },
      ],
    };
  }

  if (err instanceof HertwillSchemaMismatchError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: sanitize(
            `API response schema mismatch on field(s): ${err.fields}. ` +
              `The Hertwill API may have changed. Please upgrade @hertwill/mcp to the latest version: ` +
              `npx @hertwill/mcp@latest`,
          ),
        },
      ],
    };
  }

  // Unknown error -- safe fallback
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "An unexpected error occurred while calling the Hertwill API. Please try again.",
      },
    ],
  };
}
