import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import pino from "pino";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createCalculateMarginHandler } from "../../../src/tools/calculate-margin.js";
import { CalculateMarginInput } from "../../../src/schemas/calculate-margin.js";
import { expectStructuredAndText } from "../../helpers/mcp-assertions.js";

/**
 * Build a deps that throws on ANY property access — ensures the pure handler
 * never reaches into client/limiter/logger. If it does, the test fails loudly.
 */
function buildPureDeps(): ToolDeps {
  return new Proxy({} as ToolDeps, {
    get(_t, prop) {
      throw new Error(`calculate_margin must NOT access deps.${String(prop)}`);
    },
  });
}

/** A "real" deps for handler instantiation — calculate_margin ignores deps via _deps prefix. */
function buildIgnoredDeps(): ToolDeps {
  return {
    client: {} as never,
    publicLimiter,
    authLimiter,
    logger: pino({ level: "silent" }),
    serverVersion: "0.1.0-test",
    apiKey: undefined,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache: { get: () => undefined, set: () => {} },
    mcpServer: createMockMcpServer(),
  };
}

describe("calculate_margin handler (pure math, D-14)", () => {
  it("Test 1 — happy path: cost=10, retail=30, ad=5, vat=0.20", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 10, retail_price: 30, ad_spend: 5, vat_rate: 0.2 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.gross_margin).toBe(15);
    expect(sc.margin_pct).toBe(0.5);
    expect(sc.vat_owed_informational).toBe(5);
    const be = sc.break_even_ad_spend as Record<string, number>;
    expect(be.breakeven).toBe(20);
    expect(be.conservative_2x).toBe(10);
    expect(be.aggressive_3x).toBe(6.67);
  });

  it("Test 2 — defaults (ad_spend=0, vat_rate=0)", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const parsed = CalculateMarginInput.parse({ cost: 10, retail_price: 20 });
    const result = await handler(parsed);
    expectStructuredAndText(result);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.ad_spend).toBe(0);
    expect(sc.vat_rate).toBe(0);
    expect(sc.gross_margin).toBe(10);
    expect(sc.vat_owed_informational).toBe(0);
  });

  it("Test 3 — loss case (cost > retail)", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 30, retail_price: 20, ad_spend: 0, vat_rate: 0 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.gross_margin).toBeLessThan(0);
    expect(result.content[0].text).toMatch(/LOSS/);
  });

  it("Test 4 — break-even ad_spend exactly equals margin", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 10, retail_price: 30, ad_spend: 20, vat_rate: 0 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.gross_margin).toBe(0);
  });

  it("Test 5 — vat_rate=0 yields vat_owed=0", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 5, retail_price: 25, ad_spend: 0, vat_rate: 0 } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as Record<string, unknown>).vat_owed_informational).toBe(0);
  });

  it("Test 6 — high vat_rate edge (0.5)", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 5, retail_price: 30, ad_spend: 0, vat_rate: 0.5 } as never);
    expectStructuredAndText(result);
    const vat = (result.structuredContent as Record<string, unknown>).vat_owed_informational as number;
    // 30 * (0.5 / 1.5) = 10
    expect(vat).toBe(10);
  });

  it("Test 7 — float rounding: cost=1.1, retail=3.3, ad=0, vat=0.2 — exact expected values", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 1.1, retail_price: 3.3, ad_spend: 0, vat_rate: 0.2 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.gross_margin).toBe(2.2);
    expect(sc.margin_pct).toBe(0.667);
    expect(sc.vat_owed_informational).toBe(0.55);
    const be = sc.break_even_ad_spend as Record<string, number>;
    expect(be.breakeven).toBe(2.2);
    expect(be.conservative_2x).toBe(1.1);
    expect(be.aggressive_3x).toBe(0.73);
  });

  it("Test 8 — text summary mentions all key numbers and VAT caveat", async () => {
    const handler = createCalculateMarginHandler(buildIgnoredDeps());
    const result = await handler({ cost: 10, retail_price: 30, ad_spend: 5, vat_rate: 0.2 } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/15/);
    expect(result.content[0].text).toMatch(/VAT/);
    expect(result.content[0].text).toMatch(/inclusive/i);
  });

  it("Test 9 — handler does NOT touch deps (Proxy throws on any access)", async () => {
    const handler = createCalculateMarginHandler(buildPureDeps());
    const result = await handler({ cost: 10, retail_price: 30, ad_spend: 0, vat_rate: 0 } as never);
    expectStructuredAndText(result);
  });

  it("Test 10 — schema rejects negative cost", () => {
    const parsed = CalculateMarginInput.safeParse({ cost: -1, retail_price: 10 });
    expect(parsed.success).toBe(false);
  });

  it("Test 11 — purity grep: handler source has NO HertwillClient import and NO fetch( call", () => {
    const src = readFileSync(
      new URL("../../../src/tools/calculate-margin.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["'][^"']*hertwill\//);
    expect(src).not.toMatch(/(^|[^A-Za-z0-9_])fetch\s*\(/);
    expect(src).not.toMatch(/HertwillClient/);
  });
});
