import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createTaxonomyCache,
  TAXONOMY_TTL_MS,
  type TaxonomyResult,
} from "../../../src/resources/taxonomy-cache.js";

describe("TaxonomyCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns fetched value on cold call and stores it with fresh:true", async () => {
    const cache = createTaxonomyCache();
    const fetchFn = vi.fn().mockResolvedValue([{ id: "1", name: "Shoes" }]);

    const result = await cache.get("categories", fetchFn);

    expect(result).toEqual({ fresh: true, value: [{ id: "1", name: "Shoes" }] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns cached value without invoking fetchFn on second call within TTL", async () => {
    const cache = createTaxonomyCache();
    const fetchFn = vi.fn().mockResolvedValue([{ id: "1", name: "Shoes" }]);

    await cache.get("categories", fetchFn);
    const result = await cache.get("categories", fetchFn);

    expect(result).toEqual({ fresh: true, value: [{ id: "1", name: "Shoes" }] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("re-invokes fetchFn after TTL expires", async () => {
    const cache = createTaxonomyCache();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "Shoes" }])
      .mockResolvedValueOnce([{ id: "1", name: "Shoes Updated" }]);

    await cache.get("categories", fetchFn);

    // Advance past the TTL
    vi.advanceTimersByTime(TAXONOMY_TTL_MS + 1);

    const result = await cache.get("categories", fetchFn);

    expect(result).toEqual({
      fresh: true,
      value: [{ id: "1", name: "Shoes Updated" }],
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns stale value with last_fetched_at when fetchFn rejects and cache exists", async () => {
    const cache = createTaxonomyCache();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "Shoes" }])
      .mockRejectedValueOnce(new Error("Network error"));

    const now = new Date("2026-04-16T10:00:00.000Z");
    vi.setSystemTime(now);

    await cache.get("categories", fetchFn);

    // Advance past TTL so cache is expired
    vi.advanceTimersByTime(TAXONOMY_TTL_MS + 1);

    const result = await cache.get("categories", fetchFn);

    expect(result).toEqual({
      stale: true,
      last_fetched_at: now.toISOString(),
      value: [{ id: "1", name: "Shoes" }],
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns UPSTREAM_UNAVAILABLE error when fetchFn rejects and no cache exists", async () => {
    const cache = createTaxonomyCache();
    const fetchFn = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await cache.get("categories", fetchFn);

    expect(result).toEqual({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Connection refused",
      },
    });
    // Verify the result did not throw — it resolved
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("supports configurable TTL per-call", async () => {
    const cache = createTaxonomyCache();
    const customTtl = 5_000; // 5 seconds
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    await cache.get("key", fetchFn, customTtl);

    // Within custom TTL — should be cached
    vi.advanceTimersByTime(4_000);
    const cached = await cache.get("key", fetchFn, customTtl);
    expect(cached).toEqual({ fresh: true, value: "first" });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Past custom TTL
    vi.advanceTimersByTime(2_000);
    const refreshed = await cache.get("key", fetchFn, customTtl);
    expect(refreshed).toEqual({ fresh: true, value: "second" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("stores keys independently — setting one does not evict the other", async () => {
    const cache = createTaxonomyCache();
    const catFetch = vi.fn().mockResolvedValue([{ id: "cat1" }]);
    const brandFetch = vi.fn().mockResolvedValue([{ id: "brand1" }]);

    await cache.get("categories", catFetch);
    await cache.get("brands", brandFetch);

    // Both should be cached
    const catResult = await cache.get("categories", catFetch);
    const brandResult = await cache.get("brands", brandFetch);

    expect(catResult).toEqual({ fresh: true, value: [{ id: "cat1" }] });
    expect(brandResult).toEqual({ fresh: true, value: [{ id: "brand1" }] });
    expect(catFetch).toHaveBeenCalledTimes(1);
    expect(brandFetch).toHaveBeenCalledTimes(1);
  });
});
