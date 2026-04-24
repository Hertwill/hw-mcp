/**
 * SEC-06: Telemetry module tests.
 *
 * Verifies that telemetry is off by default, opt-in via env var, and that
 * spans contain zero PII (no query text, product IDs, filter values, or
 * API key material).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initTelemetry } from "../../src/telemetry.js";

describe("SEC-06: Telemetry — opt-in behaviour", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.HERTWILL_MCP_TELEMETRY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HERTWILL_MCP_TELEMETRY;
    } else {
      process.env.HERTWILL_MCP_TELEMETRY = originalEnv;
    }
  });

  it("Test 1 — no-op when env var is unset", () => {
    delete process.env.HERTWILL_MCP_TELEMETRY;
    const tel = initTelemetry();
    tel.recordSpan("search_products", 200, "ok");
    tel.recordSpan("get_product", 500, "error", "NOT_FOUND");
    expect(tel.spans()).toHaveLength(0);
  });

  it("Test 2 — no-op when env var is 'false'", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "false";
    const tel = initTelemetry();
    tel.recordSpan("list_products", 100, "ok");
    expect(tel.spans()).toHaveLength(0);
  });

  it("Test 3 — records span when env var is 'true'", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    tel.recordSpan("search_products", 200, "ok");
    const spans = tel.spans();
    expect(spans).toHaveLength(1);
    expect(spans[0].tool).toBe("search_products");
    expect(spans[0].duration_bucket).toBe("fast");
    expect(spans[0].outcome).toBe("ok");
    expect(spans[0].error_code).toBeUndefined();
  });

  it("Test 4 — duration bucketing: fast < 500ms, medium < 2000ms, slow >= 2000ms", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    tel.recordSpan("t1", 200, "ok");
    tel.recordSpan("t2", 800, "ok");
    tel.recordSpan("t3", 3000, "ok");
    const [s1, s2, s3] = tel.spans();
    expect(s1.duration_bucket).toBe("fast");
    expect(s2.duration_bucket).toBe("medium");
    expect(s3.duration_bucket).toBe("slow");
  });

  it("Test 5 — PII-free: span contains no product ID field", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    // Only tool name is passed — no product_id argument can flow in
    tel.recordSpan("get_product", 100, "ok");
    const span = tel.spans()[0];
    const keys = Object.keys(span);
    expect(keys).not.toContain("product_id");
    expect(keys).not.toContain("id");
    // Span only contains the four allowed fields
    expect(keys.sort()).toEqual(["duration_bucket", "outcome", "tool"]);
  });

  it("Test 6 — PII-free: no API key material in serialised spans", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    tel.recordSpan("check_auth", 50, "error", "UNAUTHORIZED");
    const serialised = JSON.stringify(tel.spans());
    // No API key prefix patterns
    expect(serialised).not.toMatch(/hw_live_/);
    expect(serialised).not.toMatch(/hw_test_/);
    // No long alphanumeric strings that could be key material (40+ chars)
    expect(serialised).not.toMatch(/[a-zA-Z0-9]{40,}/);
  });

  it("Test 7 — error code is surfaced in span when provided", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    tel.recordSpan("search_products", 5000, "error", "RATE_LIMITED");
    const span = tel.spans()[0];
    expect(span.duration_bucket).toBe("slow");
    expect(span.outcome).toBe("error");
    expect(span.error_code).toBe("RATE_LIMITED");
  });

  it("Test 8 — spans() returns a copy (mutation does not affect internal buffer)", () => {
    process.env.HERTWILL_MCP_TELEMETRY = "true";
    const tel = initTelemetry();
    tel.recordSpan("list_products", 300, "ok");
    const copy = tel.spans();
    copy.push({ tool: "injected", duration_bucket: "fast", outcome: "ok" });
    // Internal buffer should still have only 1 span
    expect(tel.spans()).toHaveLength(1);
  });
});
