import { describe, expect, it } from "vitest";
import { HertwillApiError } from "../../../src/errors/api-error.js";

const body = { error: { code: "RATE_LIMITED", message: "Too many requests" } };

describe("HertwillApiError.retryAfterSeconds", () => {
  it("populates retryAfterSeconds from a plain Retry-After integer header", () => {
    const res = new Response(JSON.stringify(body), {
      status: 429,
      headers: { "Retry-After": "5" },
    });
    const err = HertwillApiError.fromResponse(res, body);
    expect(err.retryAfterSeconds).toBe(5);
  });

  it("populates retryAfterSeconds from the draft-8 RateLimit t= header when Retry-After is absent", () => {
    const res = new Response(JSON.stringify(body), {
      status: 429,
      headers: { RateLimit: '"60-in-1min"; r=0; t=7' },
    });
    const err = HertwillApiError.fromResponse(res, body);
    expect(err.retryAfterSeconds).toBe(7);
  });

  it("leaves retryAfterSeconds undefined when neither header is present (e.g., 500)", () => {
    const res = new Response(
      JSON.stringify({ error: { code: "INTERNAL", message: "boom" } }),
      {
        status: 500,
      },
    );
    const err = HertwillApiError.fromResponse(res, {
      error: { code: "INTERNAL", message: "boom" },
    });
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it("does NOT serialize retryAfterSeconds via toJSON()", () => {
    const err = new HertwillApiError(
      429,
      "RATE_LIMITED",
      "Too many",
      undefined,
      9,
    );
    const json = err.toJSON();
    expect(Object.keys(json).sort()).toEqual(["code", "message", "status"]);
    expect((json as Record<string, unknown>).retryAfterSeconds).toBeUndefined();
  });

  it("toString() never contains hw_live_ / hw_test_ fragments even if the message does", () => {
    const err = new HertwillApiError(
      401,
      "UNAUTHORIZED",
      "Key hw_live_shouldnotleak was rejected",
    );
    const str = err.toString();
    // This regression guard mirrors the Phase 2 sanitize contract. The current
    // toString() implementation simply concatenates fields; the test asserts
    // that any future toString() change does not accidentally surface keys.
    // If this test fails, update toString() to run through the same sanitize()
    // used in errors/map.ts rather than remove the test.
    expect(str).not.toMatch(/hw_live_[a-zA-Z0-9]+/);
    expect(str).not.toMatch(/hw_test_[a-zA-Z0-9]+/);
  });
});
