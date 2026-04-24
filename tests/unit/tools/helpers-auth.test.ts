import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { describe, expect, it } from "vitest";
import pino from "pino";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import { requireApiKey } from "../../../src/tools/helpers.js";
import type { ToolDeps } from "../../../src/tools/types.js";

function buildDeps(apiKey: string | undefined): ToolDeps {
  return {
    client: {} as never,
    publicLimiter,
    authLimiter,
    logger: pino({ level: "silent" }),
    serverVersion: "0.1.0-test",
    apiKey,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache: { get: () => undefined, set: () => {} },
    mcpServer: createMockMcpServer(),
  };
}

describe("requireApiKey guard", () => {
  it("returns null when apiKey is a non-empty string", () => {
    expect(requireApiKey(buildDeps("hw_test_VALID123"))).toBeNull();
  });

  it("returns structured error envelope when apiKey is undefined", () => {
    const result = requireApiKey(buildDeps(undefined));
    expect(result).not.toBeNull();
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.type).toBe("text");
  });

  it("returns structured error envelope when apiKey is empty string", () => {
    const result = requireApiKey(buildDeps(""));
    expect(result).not.toBeNull();
    expect(result?.isError).toBe(true);
  });

  it("error text includes HERTWILL_API_KEY and the api-keys URL verbatim", () => {
    const result = requireApiKey(buildDeps(undefined));
    expect(result?.content[0]?.text).toContain("HERTWILL_API_KEY");
    expect(result?.content[0]?.text).toContain(
      "https://hertwill.com/app/api-keys",
    );
  });

  it("error text contains no API-key fragments (key-leakage regression guard)", () => {
    const result = requireApiKey(buildDeps(undefined));
    expect(result?.content[0]?.text).not.toMatch(/hw_(live|test)_[a-zA-Z0-9]+/);
  });
});
