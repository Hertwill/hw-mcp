/**
 * SEC-05: HTTP response size cap tests.
 *
 * Verifies that the HertwillClient rejects responses larger than 5 MB with
 * a structured RESPONSE_TOO_LARGE error, preventing memory exhaustion from
 * malicious or corrupt API responses (D-40).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { HertwillClient } from "../../src/hertwill/client.js";
import { HertwillApiError } from "../../src/errors/api-error.js";
import { mockServer } from "../mocks/server.js";
import { publicLimiter } from "../../src/hertwill/rate-limiter.js";

const BASE_URL = "https://api.hertwill.com";

function makeClient() {
  return new HertwillClient({ baseUrl: BASE_URL });
}

/**
 * Build a JSON string whose body is approximately `targetBytes` long.
 * Fills a data array until the target size is reached.
 */
function buildOversizedBody(targetBytes: number): string {
  const item = { id: 1, slug: "p", name: "x".repeat(200), price: 9.99 };
  const itemStr = JSON.stringify(item);
  const count = Math.ceil(targetBytes / itemStr.length);
  const items = Array.from({ length: count }, () => item);
  return JSON.stringify({
    data: items,
    meta: {
      pagination: { page: 1, per_page: count, total: count, page_count: 1 },
    },
  });
}

/** Minimal valid product list body (well under 5 MB). */
const SMALL_BODY = JSON.stringify({
  data: [
    {
      id: 1,
      slug: "product",
      name: "Small Product",
      description: "Fine",
      sku: "S1",
      price: 10,
      sale_price: null,
      stock: 5,
      stock_status: "instock",
      brand: null,
      images: { featured: null, gallery: [] },
      category: null,
      collections: [],
      shipping_regions: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: null,
    },
  ],
  meta: {
    pagination: { page: 1, per_page: 1, total: 1, page_count: 1 },
  },
});

describe("HertwillClient — SEC-05 response size cap", () => {
  beforeEach(() => {
    publicLimiter.updateSettings({ reservoir: 60 });
  });

  it("Test 1 — 6 MB response (no content-length) throws RESPONSE_TOO_LARGE", async () => {
    const body = buildOversizedBody(6_000_000);

    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        new HttpResponse(body, {
          status: 200,
          headers: { "content-type": "application/json" },
          // No content-length header — triggers body-read path in middleware
        }),
      ),
    );

    const client = makeClient();
    await expect(client.listProducts()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
  });

  it("Test 2 — 6 MB response throws HertwillApiError with status 413", async () => {
    const body = buildOversizedBody(6_000_000);

    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        new HttpResponse(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const client = makeClient();
    const err = await client.listProducts().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HertwillApiError);
    expect((err as HertwillApiError).code).toBe("RESPONSE_TOO_LARGE");
    expect((err as HertwillApiError).status).toBe(413);
    expect((err as HertwillApiError).message).toMatch(/exceeds/);
  });

  it("Test 3 — 6 MB response with content-length header throws RESPONSE_TOO_LARGE", async () => {
    const size = 6_000_000;

    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        new HttpResponse("x".repeat(size), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": String(size),
          },
        }),
      ),
    );

    const client = makeClient();
    await expect(client.listProducts()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
  });

  it("Test 4 — small response succeeds (well under 5 MB cap)", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () =>
        new HttpResponse(SMALL_BODY, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const client = makeClient();
    const result = await client.listProducts();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
  });

  it("Test 5 — RESPONSE_TOO_LARGE is not retried (single request attempt)", async () => {
    let callCount = 0;
    const body = buildOversizedBody(6_000_000);

    mockServer.use(
      http.get(`${BASE_URL}/v1/products`, () => {
        callCount++;
        return new HttpResponse(body, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const client = makeClient();
    await expect(client.listProducts()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
    // Status 413 is not in RETRYABLE_STATUSES — only called once
    expect(callCount).toBe(1);
  }, 15_000);
});
