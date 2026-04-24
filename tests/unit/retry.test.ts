import { describe, expect, it, vi } from "vitest";
import {
  getRetryDelay,
  isRetryableStatus,
  createRetryOptions,
  retryWithBackoff,
} from "../../src/hertwill/retry.js";

describe("getRetryDelay", () => {
  it("returns Retry-After value in ms when header is present", () => {
    const response = new Response("", {
      status: 429,
      headers: { "Retry-After": "5" },
    });

    const delay = getRetryDelay(response);
    // 5000ms base + 0-2000ms jitter
    expect(delay).toBeGreaterThanOrEqual(5000);
    expect(delay).toBeLessThan(7000);
  });

  it("falls back to ratelimit t value when no Retry-After", () => {
    const response = new Response("", {
      status: 429,
      headers: { ratelimit: '"60-in-1min"; r=0; t=30' },
    });

    const delay = getRetryDelay(response);
    // 30000ms base + 0-2000ms jitter
    expect(delay).toBeGreaterThanOrEqual(30000);
    expect(delay).toBeLessThan(32000);
  });

  it("returns 30s conservative fallback when neither header is present", () => {
    const response = new Response("", { status: 429 });

    const delay = getRetryDelay(response);
    // 30000ms base + 0-2000ms jitter
    expect(delay).toBeGreaterThanOrEqual(30000);
    expect(delay).toBeLessThan(32000);
  });
});

describe("isRetryableStatus", () => {
  it("returns true for 429", () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("returns true for 502, 503, 504", () => {
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it("returns false for 400, 401, 403, 404, 422", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
  });
});

describe("createRetryOptions", () => {
  it("returns options with retries=3, factor=2, randomize=true", () => {
    const opts = createRetryOptions();
    expect(opts.retries).toBe(3);
    expect(opts.factor).toBe(2);
    expect(opts.randomize).toBe(true);
  });
});

describe("retryWithBackoff", () => {
  it("retries a function that fails once with 502 then succeeds", async () => {
    let attempt = 0;
    const fn = async () => {
      attempt++;
      if (attempt === 1) {
        const err = new Error("502") as Error & { status: number };
        err.status = 502;
        throw err;
      }
      return "success";
    };

    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(attempt).toBe(2);
  });

  it("does not retry non-retryable 4xx errors", async () => {
    let attempt = 0;
    const fn = async () => {
      attempt++;
      const err = new Error("Not found") as Error & { status: number };
      err.status = 404;
      throw err;
    };

    await expect(retryWithBackoff(fn)).rejects.toThrow("Not found");
    // Should only try once (no retries for 404)
    expect(attempt).toBe(1);
  });
});
