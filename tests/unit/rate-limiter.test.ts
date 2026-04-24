import { describe, expect, it, vi } from "vitest";
import Bottleneck from "bottleneck";
import {
  parseRateLimitHeader,
  publicLimiter,
  authLimiter,
  updateFromHeaders,
} from "../../src/hertwill/rate-limiter.js";

describe("parseRateLimitHeader", () => {
  it("extracts remaining and resetSeconds from valid header", () => {
    const result = parseRateLimitHeader('"60-in-1min"; r=59; t=60');
    expect(result).toEqual({ remaining: 59, resetSeconds: 60 });
  });

  it("returns null for null input", () => {
    expect(parseRateLimitHeader(null)).toBeNull();
  });

  it("returns null for malformed header", () => {
    expect(parseRateLimitHeader("garbage")).toBeNull();
  });

  it("parses header with r=0", () => {
    const result = parseRateLimitHeader('"60-in-1min"; r=0; t=30');
    expect(result).toEqual({ remaining: 0, resetSeconds: 30 });
  });
});

describe("publicLimiter", () => {
  it("is an instance of Bottleneck", () => {
    expect(publicLimiter).toBeInstanceOf(Bottleneck);
  });

  it("has reservoir of 60 (can schedule jobs)", async () => {
    // Verify functional behavior: schedule 5 quick jobs
    const results: number[] = [];
    const promises = Array.from({ length: 5 }, (_, i) =>
      publicLimiter.schedule(() => {
        results.push(i);
        return Promise.resolve(i);
      }),
    );
    await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
});

describe("publicLimiter bucket drain (ROADMAP SC1)", () => {
  it("fires 70 calls, drains the 60/min bucket, and queues the overflow", async () => {
    // Fresh limiter matching publicLimiter config, but with maxConcurrent=60
    // and minTime=0 so all 60 reservoir-permitted jobs run instantly
    const limiter = new Bottleneck({
      reservoir: 60,
      reservoirRefreshAmount: 60,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 60,
      minTime: 0,
    });

    const completed: number[] = [];

    // Schedule 70 jobs — first 60 should drain the reservoir, 10 should queue
    const promises = Array.from({ length: 70 }, (_, i) =>
      limiter.schedule(() => {
        completed.push(i);
        return Promise.resolve(i);
      }),
    );

    // Wait briefly for the 60 reservoir-permitted jobs to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Reservoir should be fully drained
    const reservoir = await limiter.currentReservoir();
    expect(reservoir).toBe(0);

    // At most 60 jobs should have completed (reservoir gate)
    expect(completed.length).toBeLessThanOrEqual(60);

    // Overflow jobs should be queued waiting for reservoir refill
    const counts = limiter.counts();
    expect(counts.QUEUED + counts.RECEIVED).toBeGreaterThanOrEqual(10);

    // Clean up without waiting for the 60s reservoir refresh
    limiter.disconnect({ dropWaitingJobs: true });
  });
});

describe("authLimiter", () => {
  it("is an instance of Bottleneck", () => {
    expect(authLimiter).toBeInstanceOf(Bottleneck);
  });

  it("has reservoir of 300 (can schedule jobs)", async () => {
    const results: number[] = [];
    const promises = Array.from({ length: 5 }, (_, i) =>
      authLimiter.schedule(() => {
        results.push(i);
        return Promise.resolve(i);
      }),
    );
    await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
});

describe("updateFromHeaders", () => {
  it("updates limiter reservoir when remaining < 5 (below threshold)", async () => {
    const testLimiter = new Bottleneck({
      reservoir: 60,
      reservoirRefreshAmount: 60,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 5,
      minTime: 0,
    });

    const response = new Response("", {
      headers: { ratelimit: '"60-in-1min"; r=3; t=45' },
    });

    updateFromHeaders(testLimiter, response);

    // After update, the reservoir should be set to 3
    const counts = await testLimiter.currentReservoir();
    expect(counts).toBe(3);
  });

  it("does NOT drain reservoir when remaining >= 5 (above threshold)", async () => {
    const testLimiter = new Bottleneck({
      reservoir: 60,
      reservoirRefreshAmount: 60,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 5,
      minTime: 0,
    });

    const response = new Response("", {
      headers: { ratelimit: '"60-in-1min"; r=30; t=45' },
    });

    updateFromHeaders(testLimiter, response);

    const counts = await testLimiter.currentReservoir();
    expect(counts).toBe(60); // unchanged
  });

  it("is a no-op when ratelimit header is missing", async () => {
    const testLimiter = new Bottleneck({
      reservoir: 60,
      reservoirRefreshAmount: 60,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 5,
      minTime: 0,
    });

    const response = new Response("", { headers: {} });

    updateFromHeaders(testLimiter, response);

    const counts = await testLimiter.currentReservoir();
    expect(counts).toBe(60); // unchanged
  });
});
