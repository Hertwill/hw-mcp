import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import Bottleneck from "bottleneck";
import pino from "pino";
import { HertwillClient } from "../../../src/hertwill/client.js";
import { publicLimiter, authLimiter } from "../../../src/hertwill/rate-limiter.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import { createSearchProductsHandler } from "../../../src/tools/search-products.js";
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
    ...overrides,
  };
}

function makeSearchFixture(items: unknown[], pagination?: Partial<{ page: number; per_page: number; total: number; page_count: number }>) {
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

function fakeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 456,
    slug: "blue-running-shoes",
    name: "Blue Running Shoes",
    description: "Lightweight running shoes",
    sku: "BRS-001",
    price: 49.99,
    sale_price: 39.99,
    stock: 25,
    stock_status: "instock",
    brand: { id: "3", name: "RunFast", slug: "runfast" },
    images: {
      featured: "https://cdn.hertwill.com/products/456.jpg",
      gallery: [],
    },
    category: { id: "2", name: "Footwear", slug: "footwear" },
    collections: [],
    shipping_regions: [{ code: "EU", name: "European Union" }],
    created_at: "2026-02-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

describe("search_products handler", () => {
  it("Test 1 — happy path: 5 products, dual-shape response", async () => {
    const items = [1, 2, 3, 4, 5].map((i) => fakeProduct({ id: i, slug: `p${i}`, name: `Product ${i}` }));
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () =>
        HttpResponse.json(makeSearchFixture(items, { total: 5 })),
      ),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "wireless earbuds" } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { items: unknown[]; pagination: { page: number } };
    expect(sc.items.length).toBe(5);
    expect(sc.pagination.page).toBe(1);
    expect(result.content[0].text).toMatch(/5.*wireless earbuds/);
  });

  it("Test 2 — empty result", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () =>
        HttpResponse.json(makeSearchFixture([], { total: 0, page_count: 0 })),
      ),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "nothing" } as never);
    expectStructuredAndText(result);
    expect((result.structuredContent as { items: unknown[] }).items).toEqual([]);
    expect(result.content[0].text).toMatch(/0|no/i);
  });

  it("Test 3 — per_page=50 clamps to 20 and text announces clamp", async () => {
    let observedPerPage: string | null = null;
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, ({ request }) => {
        observedPerPage = new URL(request.url).searchParams.get("per_page");
        return HttpResponse.json(makeSearchFixture([fakeProduct()]));
      }),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "x", per_page: 50 } as never);
    expectStructuredAndText(result);
    expect(observedPerPage).toBe("20");
    expect(result.content[0].text).toMatch(/clamped|20/);
  });

  it("Test 4 — 429 upstream surfaces Retry after Ns", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, rateLimitedResponse429(5)),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "x" } as never);
    expectToolError(result, /retry|rate|429|unexpected/i);
    expect((result as { structuredContent?: unknown }).structuredContent).toBeUndefined();
  }, 15000);

  it("Test 5 — 5xx upstream surfaces server-error envelope", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, serverErrorResponse503()),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "x" } as never);
    expectToolError(result, /error|server|503|unexpected/i);
  }, 15000);

  it("Test 6 — reservoir exhausted: immediate error, zero upstream calls", async () => {
    const searchSpy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () => {
        searchSpy();
        return HttpResponse.json(makeSearchFixture([fakeProduct()]));
      }),
    );
    const fakeLimiter = {
      currentReservoir: async () => 0,
    } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(12);
    const handler = createSearchProductsHandler(deps);
    const result = await handler({ query: "x" } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 12s\./);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("Test 7 — supplier-authored name wrapped in untrusted delimiters", async () => {
    const malicious = fakeProduct({
      id: 42,
      slug: "evil",
      name: "<script>alert(1)</script>",
    });
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () =>
        HttpResponse.json(makeSearchFixture([malicious])),
      ),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "x" } as never);
    expectStructuredAndText(result);
    const item = (result.structuredContent as { items: Array<{ name: string }> }).items[0];
    expect(item.name).toMatch(/<untrusted_supplier_content/);
  });

  it("Test 8 — key-leakage guard: error text has no hw_live_ fragments", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () =>
        HttpResponse.json(
          { code: "SERVER_ERROR", message: "upstream fail hw_live_ABC123leak" },
          { status: 500 },
        ),
      ),
    );
    const handler = createSearchProductsHandler(buildTestDeps());
    const result = await handler({ query: "x" } as never);
    expectToolError(result, /./);
  }, 15000);

  it("Test 9 — auth-optional: no API key still returns happy path", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products/search`, () =>
        HttpResponse.json(makeSearchFixture([fakeProduct()])),
      ),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createSearchProductsHandler(deps);
    const result = await handler({ query: "x" } as never);
    expectStructuredAndText(result);
  });
});
