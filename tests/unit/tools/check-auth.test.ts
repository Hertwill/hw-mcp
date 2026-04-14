import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import pino from "pino";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createCheckAuthHandler } from "../../../src/tools/check-auth.js";
import { mockServer } from "../../mocks/server.js";
import { expectStructuredAndText } from "../../helpers/mcp-assertions.js";

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
  };
}

describe("check_auth handler (D-18 PURE offline parse)", () => {
  it("Test 1 — valid hw_test_ key: configured=true, format_valid=true, key_type=test", async () => {
    const handler = createCheckAuthHandler(buildDeps("hw_test_ABC123xyz"));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      configured: boolean;
      format_valid: boolean;
      key_type: "live" | "test" | null;
    };
    expect(sc.configured).toBe(true);
    expect(sc.format_valid).toBe(true);
    expect(sc.key_type).toBe("test");
  });

  it("Test 2 — valid hw_live_ key: key_type=live", async () => {
    const handler = createCheckAuthHandler(buildDeps("hw_live_PRODKEY999"));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as { key_type: string };
    expect(sc.key_type).toBe("live");
  });

  it("Test 3 — no key: configured=false, format_valid=false, key_type=null; text instructs setup", async () => {
    const handler = createCheckAuthHandler(buildDeps(undefined));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      configured: boolean;
      format_valid: boolean;
      key_type: string | null;
    };
    expect(sc.configured).toBe(false);
    expect(sc.format_valid).toBe(false);
    expect(sc.key_type).toBeNull();
    expect(result.content[0].text).toMatch(/HERTWILL_API_KEY/);
  });

  it("Test 4 — malformed key: configured=true, format_valid=false", async () => {
    const handler = createCheckAuthHandler(buildDeps("not_a_real_key"));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      configured: boolean;
      format_valid: boolean;
    };
    expect(sc.configured).toBe(true);
    expect(sc.format_valid).toBe(false);
    expect(result.content[0].text).toMatch(/format invalid/);
  });

  it("Test 5 — PURITY: source file has NO HertwillClient / fetch / errors imports", () => {
    const src = readFileSync(
      new URL("../../../src/tools/check-auth.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["'][^"']*hertwill\//);
    expect(src).not.toMatch(/from\s+["'][^"']*errors/);
    expect(src).not.toMatch(/from\s+["']\.\/helpers/);
    expect(src).not.toMatch(/(^|[^A-Za-z0-9_])fetch\s*\(/);
    expect(src).not.toMatch(/HertwillClient/);
    expect(src).not.toMatch(/mapHertwillError/);
  });

  it("Test 6 — no msw requests intercepted during check_auth (live observation)", async () => {
    const requestSpy = vi.fn();
    mockServer.events.on("request:start", requestSpy);
    try {
      const handler = createCheckAuthHandler(buildDeps("hw_live_OBSERVE"));
      await handler();
    } finally {
      mockServer.events.removeAllListeners("request:start");
    }
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("Test 7 — structuredContent.note mentions the revocation caveat", async () => {
    const handler = createCheckAuthHandler(buildDeps("hw_test_CAVEAT"));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as { note: string };
    expect(sc.note).toMatch(/locally|format/i);
    expect(sc.note).toMatch(/call.*authenticated/i);
  });
});
