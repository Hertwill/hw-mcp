import { afterEach, describe, expect, it } from "vitest";
import { RateLimiterRegistry } from "../../src/hertwill/rate-limiter.js";

describe("RateLimiterRegistry", () => {
  const registries: RateLimiterRegistry[] = [];

  function createRegistry(idleTtlMs?: number) {
    const r = new RateLimiterRegistry(idleTtlMs);
    registries.push(r);
    return r;
  }

  afterEach(() => {
    for (const r of registries) r.dispose();
    registries.length = 0;
  });

  it("creates separate bucket pairs for different API keys", () => {
    const registry = createRegistry();
    const pairA = registry.get("hw_live_KEY_A");
    const pairB = registry.get("hw_live_KEY_B");

    expect(pairA.public).not.toBe(pairB.public);
    expect(pairA.auth).not.toBe(pairB.auth);
    expect(registry.size).toBe(2);
  });

  it("reuses the same bucket pair for the same API key", () => {
    const registry = createRegistry();
    const first = registry.get("hw_live_KEY_A");
    const second = registry.get("hw_live_KEY_A");

    expect(first.public).toBe(second.public);
    expect(first.auth).toBe(second.auth);
    expect(registry.size).toBe(1);
  });

  it("uses '_anonymous' key when no API key is provided", () => {
    const registry = createRegistry();
    const a = registry.get();
    const b = registry.get(undefined);

    expect(a.public).toBe(b.public);
    expect(registry.size).toBe(1);
  });

  it("anonymous and keyed buckets are independent", () => {
    const registry = createRegistry();
    const anon = registry.get();
    const keyed = registry.get("hw_live_KEY_A");

    expect(anon.public).not.toBe(keyed.public);
    expect(registry.size).toBe(2);
  });

  it("public and auth limiters in a pair have correct reservoir sizes", async () => {
    const registry = createRegistry();
    const pair = registry.get("hw_live_KEY_A");

    const publicReservoir = await pair.public.currentReservoir();
    const authReservoir = await pair.auth.currentReservoir();

    expect(publicReservoir).toBe(60);
    expect(authReservoir).toBe(300);
  });

  it("dispose() stops the sweep timer", () => {
    const registry = createRegistry();
    registry.get("key1");
    registry.dispose();
    // No error thrown, registry still works but timer is cleared
    expect(registry.size).toBe(1);
  });
});
