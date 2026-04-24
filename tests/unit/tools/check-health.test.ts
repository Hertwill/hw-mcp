import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import pino from "pino";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps, HealthCacheEntry } from "../../../src/tools/types.js";
import { createCheckHealthHandler } from "../../../src/tools/check-health.js";
import { mockServer } from "../../mocks/server.js";
import { plainTextOkHealth } from "../../mocks/handlers.js";
import { expectStructuredAndText } from "../../helpers/mcp-assertions.js";

const BASE_URL = "https://api.hertwill.com";

function makeHealthCache(): ToolDeps["healthCache"] {
  let entry: HealthCacheEntry | undefined;
  return {
    get: () => entry,
    set: (e) => {
      entry = e;
    },
  };
}

function buildTestDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  const client = new HertwillClient({ baseUrl: BASE_URL });
  return {
    client,
    publicLimiter,
    authLimiter,
    logger: pino({ level: "silent" }),
    serverVersion: "0.1.0-test",
    apiKey: undefined,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache: makeHealthCache(),
    mcpServer: createMockMcpServer(),
    ...overrides,
  };
}

describe("check_health handler (D-15 full bucket state)", () => {
  it("Test 1 — no API key: authenticated.configured=false with all auth fields null", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, plainTextOkHealth));
    const handler = createCheckHealthHandler(buildTestDeps({ apiKey: undefined }));
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      rate_limits: {
        public: { remaining: number | null; limit: number; reset_at: string | null };
        authenticated: { configured: boolean; remaining: number | null; limit: number | null; reset_at: string | null };
      };
    };
    expect(sc.rate_limits.authenticated.configured).toBe(false);
    expect(sc.rate_limits.authenticated.remaining).toBeNull();
    expect(sc.rate_limits.authenticated.limit).toBeNull();
    expect(sc.rate_limits.authenticated.reset_at).toBeNull();
    expect(sc.rate_limits.public.limit).toBe(60);
  });

  it("Test 2 — with API key: authenticated.limit === 300 (regression gate per M3)", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, plainTextOkHealth));
    const handler = createCheckHealthHandler(
      buildTestDeps({ apiKey: "hw_test_FAKEKEY" }),
    );
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      rate_limits: { authenticated: { configured: boolean; limit: number | null } };
    };
    expect(sc.rate_limits.authenticated.configured).toBe(true);
    expect(sc.rate_limits.authenticated.limit).toBe(300);
  });

  it("Test 3 — Hertwill reachable: hertwill_reachable=true and latency_ms numeric", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, plainTextOkHealth));
    const handler = createCheckHealthHandler(buildTestDeps());
    const result = await handler();
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      hertwill_reachable: boolean;
      hertwill_latency_ms: number | null;
    };
    expect(sc.hertwill_reachable).toBe(true);
    expect(typeof sc.hertwill_latency_ms).toBe("number");
  });

  it("Test 4 — Hertwill unreachable (5xx): never throws, returns successful tool result with reachable=false (T-4-04)", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/health`, () => new HttpResponse(null, { status: 500 })),
    );
    const handler = createCheckHealthHandler(buildTestDeps());
    const result = await handler();
    // Critical: NOT isError
    expect((result as { isError?: boolean }).isError).not.toBe(true);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      hertwill_reachable: boolean;
      hertwill_latency_ms: number | null;
    };
    expect(sc.hertwill_reachable).toBe(false);
    expect(sc.hertwill_latency_ms).toBeNull();
  });

  it("Test 5 — server_version surfaced", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, plainTextOkHealth));
    const handler = createCheckHealthHandler(
      buildTestDeps({ serverVersion: "9.9.9-custom" }),
    );
    const result = await handler();
    expectStructuredAndText(result);
    expect(
      (result.structuredContent as { server_version: string }).server_version,
    ).toBe("9.9.9-custom");
  });

  it("Test 6 — text summary mentions reachability + version + bucket", async () => {
    mockServer.use(http.get(`${BASE_URL}/health`, plainTextOkHealth));
    const handler = createCheckHealthHandler(buildTestDeps());
    const result = await handler();
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/0.1.0-test/);
    expect(result.content[0].text).toMatch(/Hertwill/);
    expect(result.content[0].text).toMatch(/bucket/);
  });

  it("Test 7 — health cache memoises probe (second call within TTL reuses result)", async () => {
    let probeCount = 0;
    mockServer.use(
      http.get(`${BASE_URL}/health`, () => {
        probeCount++;
        return new HttpResponse("OK", { status: 200 });
      }),
    );
    const deps = buildTestDeps();
    const handler = createCheckHealthHandler(deps);
    await handler();
    await handler();
    expect(probeCount).toBe(1);
  });
});
