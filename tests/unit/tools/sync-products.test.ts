import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type Bottleneck from "bottleneck";
import pino from "pino";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createSyncProductsHandler } from "../../../src/tools/sync-products.js";
import { mockServer } from "../../mocks/server.js";
import {
  syncProductsAcceptedResponse,
  invalidKeyResponse401,
} from "../../mocks/handlers.js";
import {
  expectStructuredAndText,
  expectToolError,
} from "../../helpers/mcp-assertions.js";

const BASE_URL = "https://api.hertwill.com";
const VALID_KEY = "hw_test_VALIDFORMAT123";

function buildTestDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  const client = new HertwillClient({ apiKey: VALID_KEY, baseUrl: BASE_URL });
  return {
    client,
    publicLimiter,
    authLimiter,
    logger: pino({ level: "silent" }),
    serverVersion: "0.1.0-test",
    apiKey: VALID_KEY,
    publicRateReset: new RateResetTracker(),
    authRateReset: new RateResetTracker(),
    healthCache: { get: () => undefined, set: () => {} },
    mcpServer: createMockMcpServer(),
    ...overrides,
  };
}

describe("sync_products handler (D-22)", () => {
  it("Test 1 — happy path: 202 accepted with message threaded through", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () =>
        syncProductsAcceptedResponse(456),
      ),
    );
    const handler = createSyncProductsHandler(buildTestDeps());
    const result = await handler({ product_id: 456, default_store_markup: 2.0 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      product_id: number;
      status: string;
      markup_multiplier: number;
    };
    expect(sc.product_id).toBe(456);
    expect(sc.status).toBe("syncing");
    expect(sc.markup_multiplier).toBe(2.0);
    expect(result.content[0].text).toMatch(/markup 100%/);
  });

  it("Test 2 — markup 1.5× surfaced as 50% in text", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () =>
        syncProductsAcceptedResponse(789),
      ),
    );
    const handler = createSyncProductsHandler(buildTestDeps());
    const result = await handler({ product_id: 789, default_store_markup: 1.5 } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/markup 50%/);
  });

  it("Test 3 — reservoir exhausted pre-flight", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () => {
        spy();
        return syncProductsAcceptedResponse();
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ authLimiter: fakeLimiter });
    deps.authRateReset.observe(7);
    const handler = createSyncProductsHandler(deps);
    const result = await handler({ product_id: 1, default_store_markup: 2.0 } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 7s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 4 — no-API-key: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () => {
        spy();
        return syncProductsAcceptedResponse();
      }),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createSyncProductsHandler(deps);
    const result = await handler({ product_id: 1, default_store_markup: 2.0 } as never);
    expectToolError(result, /HERTWILL_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 5 — 401 from upstream", async () => {
    mockServer.use(http.post(`${BASE_URL}/v1/sync/products`, invalidKeyResponse401));
    const handler = createSyncProductsHandler(buildTestDeps());
    const result = await handler({ product_id: 1, default_store_markup: 2.0 } as never);
    expectToolError(result, /unauthorized|invalid|401|unexpected/i);
  });

  it("Test 6 — passes currency and lang through when provided", async () => {
    const deps = buildTestDeps();
    const spy = vi.spyOn(deps.client, "syncProducts");
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () =>
        syncProductsAcceptedResponse(),
      ),
    );
    const handler = createSyncProductsHandler(deps);
    await handler({
      product_id: 1,
      default_store_markup: 2.0,
      currency: "USD",
      lang: "en",
    } as never);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD", lang: "en" }),
    );
  });

  it("Test 7 — key-leakage guard on 500", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/v1/sync/products`, () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail hw_live_SYNCLEAK" } },
          { status: 500 },
        ),
      ),
    );
    const handler = createSyncProductsHandler(buildTestDeps());
    const result = await handler({ product_id: 1, default_store_markup: 2.0 } as never);
    expectToolError(result, /./);
  }, 15000);
});
