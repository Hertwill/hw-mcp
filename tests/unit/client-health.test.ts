import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { HertwillClient } from "../../src/hertwill/client.js";
import { authLimiter, publicLimiter } from "../../src/hertwill/rate-limiter.js";
import { plainTextOkHealth } from "../mocks/handlers.js";
import { mockServer } from "../mocks/server.js";

const BASE_URL = "https://api.hertwill.com";

describe("HertwillClient.health()", () => {
  let client: HertwillClient;

  beforeEach(() => {
    publicLimiter.updateSettings({ reservoir: 60 });
    authLimiter.updateSettings({ reservoir: 300 });
    client = new HertwillClient({ baseUrl: BASE_URL });
  });

  it("returns {ok:true, latency_ms:number} for 200 JSON /health", async () => {
    const result = await client.health();
    expect(result.ok).toBe(true);
    expect(typeof result.latency_ms).toBe("number");
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns {ok:true, latency_ms:number} for 200 plain-text OK /health", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, () => plainTextOkHealth()));
    const result = await client.health();
    expect(result.ok).toBe(true);
    expect(typeof result.latency_ms).toBe("number");
  });

  it("returns {ok:false, latency_ms:null} when /health returns 503", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/health`, () =>
        HttpResponse.json(
          { error: { code: "SERVICE_UNAVAILABLE", message: "down" } },
          { status: 503 },
        ),
      ),
    );
    const result = await client.health();
    expect(result).toEqual({ ok: false, latency_ms: null });
  });

  it("returns {ok:false, latency_ms:null} when the network throws (simulated error)", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, () => HttpResponse.error()));
    const result = await client.health();
    expect(result).toEqual({ ok: false, latency_ms: null });
  });

  it("does NOT go through the public rate limiter (probe must not self-throttle)", async () => {
    // Drain the public reservoir. A limiter-scheduled call would block; a
    // bypassing call must still resolve.
    publicLimiter.updateSettings({ reservoir: 0 });
    const result = await Promise.race([
      client.health(),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 2000),
      ),
    ]);
    expect(result).not.toBe("timeout");
    expect((result as { ok: boolean }).ok).toBe(true);
    // Restore for other tests.
    publicLimiter.updateSettings({ reservoir: 60 });
  });
});
