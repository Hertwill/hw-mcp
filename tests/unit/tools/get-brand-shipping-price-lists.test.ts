import type Bottleneck from "bottleneck";
import { HttpResponse, http } from "msw";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  authLimiter,
  publicLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { createGetBrandShippingPriceListsHandler } from "../../../src/tools/get-brand-shipping-price-lists.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import {
  expectStructuredAndText,
  expectToolError,
} from "../../helpers/mcp-assertions.js";
import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { mockServer } from "../../mocks/server.js";

const BASE_URL = "https://api.hertwill.com";

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
    healthCache: { get: () => undefined, set: () => {} },
    mcpServer: createMockMcpServer(),
    ...overrides,
  };
}

function listsFixture() {
  return {
    data: [
      {
        id: 10,
        name: "EU",
        per_item: false,
        shipping_prices: [
          {
            id: 100,
            origin_iso_code: "EE",
            dest_iso_code: "DE",
            price: 4.5,
            origin_country: "Estonia",
            destination_country: "Germany",
          },
        ],
      },
    ],
    meta: { request_id: "req-brand-shipping" },
  };
}

describe("get_brand_shipping_price_lists handler", () => {
  it("Test 1 — happy path returns lists with structured prices", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id/shipping-price-lists`, () =>
        HttpResponse.json(listsFixture()),
      ),
    );
    const handler = createGetBrandShippingPriceListsHandler(buildTestDeps());
    const result = await handler({ brand_id: 214 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      data: Array<{
        name: string;
        shipping_prices: Array<{ price: { amount: number } | null }>;
      }>;
    };
    expect(sc.data).toHaveLength(1);
    expect(sc.data[0].name).toBe("EU");
    // Internal free-text description is not surfaced to end users.
    expect(sc.data[0]).not.toHaveProperty("description");
    expect(sc.data[0].shipping_prices[0].price).toEqual({
      amount: 4.5,
      currency: "EUR",
    });
    expect(result.content[0].text).toMatch(/EU/);
  });

  it("Test 3 — empty result summarised", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id/shipping-price-lists`, () =>
        HttpResponse.json({ data: [], meta: { request_id: "req-empty" } }),
      ),
    );
    const handler = createGetBrandShippingPriceListsHandler(buildTestDeps());
    const result = await handler({ brand_id: 214 } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/no shipping price lists/);
  });

  it("Test 4 — 404 not found surfaces error", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id/shipping-price-lists`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "Brand not found" },
          { status: 404 },
        ),
      ),
    );
    const handler = createGetBrandShippingPriceListsHandler(buildTestDeps());
    const result = await handler({ brand_id: 999 } as never);
    expectToolError(result, /not found|404|error|unexpected/i);
  });

  it("Test 5 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id/shipping-price-lists`, () => {
        spy();
        return HttpResponse.json(listsFixture());
      }),
    );
    const fakeLimiter = {
      currentReservoir: async () => 0,
    } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(8);
    const handler = createGetBrandShippingPriceListsHandler(deps);
    const result = await handler({ brand_id: 214 } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 8s\./);
    expect(spy).not.toHaveBeenCalled();
  });
});
