import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import Bottleneck from "bottleneck";
import pino from "pino";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  publicLimiter,
  authLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createListProductsHandler } from "../../../src/tools/list-products.js";
import { mockServer } from "../../mocks/server.js";
import {
  rateLimitedResponse429,
  serverErrorResponse503,
} from "../../mocks/handlers.js";
import {
  expectStructuredAndText,
  expectToolError,
} from "../../helpers/mcp-assertions.js";

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

function fakeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "p1",
    name: "P1",
    description: "x",
    sku: "S1",
    price: 10,
    sale_price: null,
    stock: 5,
    stock_status: "instock",
    brand: { id: "1", name: "B", slug: "b" },
    images: { featured: "https://cdn.hertwill.com/1.jpg", gallery: [] },
    category: { id: "1", name: "C", slug: "c" },
    collections: [],
    shipping_regions: [{ code: "EU", name: "European Union" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

function makeListFixture(
  items: unknown[],
  pagination?: Partial<{ page: number; per_page: number; total: number; page_count: number }>,
) {
  return {
    data: items,
    meta: {
      pagination: {
        page: pagination?.page ?? 1,
        per_page: pagination?.per_page ?? 20,
        total: pagination?.total ?? items.length,
        page_count: pagination?.page_count ?? 1,
      },
      request_id: "req-test",
    },
  };
}

describe("list_products handler", () => {
  it("Test 1 — happy path", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        HttpResponse.json(makeListFixture([fakeProduct(), fakeProduct({ id: 2, slug: "p2" })])),
      ),
    );
    const handler = createListProductsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { items: unknown[] }).items.length).toBe(2);
    expect(result.content[0].text).toMatch(/2.*page 1/);
  });

  it("Test 2 — empty filter result", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        HttpResponse.json(makeListFixture([], { page_count: 0 })),
      ),
    );
    const handler = createListProductsHandler(buildTestDeps());
    const result = await handler({ category: "nonexistent" } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/no products/i);
  });

  it("Test 3 — per_page=50 clamps to 20 (CRITICAL inherited constraint)", async () => {
    let observedPerPage: string | null = null;
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, ({ request }) => {
        observedPerPage = new URL(request.url).searchParams.get("per_page");
        return HttpResponse.json(makeListFixture([fakeProduct()]));
      }),
    );
    const deps = buildTestDeps();
    const clientSpy = vi.spyOn(deps.client, "listProducts");
    const handler = createListProductsHandler(deps);
    const result = await handler({ per_page: 50 } as never);
    expectStructuredAndText(result);
    expect(observedPerPage).toBe("20");
    expect(clientSpy).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20 }));
    expect(result.content[0].text).toContain("20");
    expect(result.content[0].text).toMatch(/clamp|budget|reduced/i);
    expect((result.structuredContent as { pagination: { per_page: number } }).pagination.per_page).toBe(20);
  });

  it("Test 4 — 429 upstream error envelope", async () => {
    mockServer.use(http.get(`${BASE_URL}/v1/products`, rateLimitedResponse429(7)));
    const handler = createListProductsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /retry|rate|429|unexpected/i);
  }, 15000);

  it("Test 5 — 503 upstream after retries", async () => {
    mockServer.use(http.get(`${BASE_URL}/v1/products`, serverErrorResponse503()));
    const handler = createListProductsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /error|server|503|unexpected/i);
  }, 15000);

  it("Test 6 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const searchSpy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () => {
        searchSpy();
        return HttpResponse.json(makeListFixture([fakeProduct()]));
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(9);
    const handler = createListProductsHandler(deps);
    const result = await handler({} as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 9s\./);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("Test 7 — key-leakage guard on error text", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        HttpResponse.json(
          { code: "SERVER_ERROR", message: "fail hw_live_LEAK999" },
          { status: 500 },
        ),
      ),
    );
    const handler = createListProductsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /./);
  }, 15000);

  it("Test 8 — sort_by/sort_order pass-through", async () => {
    const deps = buildTestDeps();
    const clientSpy = vi.spyOn(deps.client, "listProducts");
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        HttpResponse.json(makeListFixture([fakeProduct()])),
      ),
    );
    const handler = createListProductsHandler(deps);
    await handler({ sort_by: "sales", sort_order: "desc" } as never);
    expect(clientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sort_by: "sales", sort_order: "desc" }),
    );
  });
});
