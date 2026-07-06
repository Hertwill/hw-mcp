import { http, HttpResponse } from "msw";

const BASE_URL = "https://api.hertwill.com";

const rateLimitHeaders = {
  RateLimit: '"60-in-1min"; r=59; t=60',
  "RateLimit-Policy": '"60-in-1min"',
};

const authRateLimitHeaders = {
  RateLimit: '"300-in-1min"; r=299; t=60',
  "RateLimit-Policy": '"300-in-1min"',
};

export const handlers = [
  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  // 1. GET /v1/products - list products
  http.get(`${BASE_URL}/v1/products`, ({ request }) => {
    const url = new URL(request.url);
    // Return empty list for no params, or filtered results
    return HttpResponse.json(
      {
        data: [
          {
            id: 123,
            slug: "organic-cotton-tshirt",
            name: "Organic Cotton T-Shirt",
            description: "Premium organic cotton t-shirt",
            sku: "OCT-001",
            price: 29.99,
            sale_price: null,
            stock: 50,
            stock_status: "instock",
            brand: { id: "5", name: "EcoWear", slug: "ecowear" },
            images: { featured: "https://cdn.hertwill.com/products/123.jpg", gallery: [] },
            category: { id: "1", name: "Apparel", slug: "apparel" },
            collections: [],
            shipping_regions: [{ code: "EU", name: "European Union" }],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: null,
          },
        ],
        meta: {
          pagination: { page: 1, per_page: 24, total: 1, page_count: 1 },
          request_id: "req-list-products",
        },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 2. GET /v1/products/search - search products
  http.get(`${BASE_URL}/v1/products/search`, ({ request }) => {
    return HttpResponse.json(
      {
        data: [
          {
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
            images: { featured: "https://cdn.hertwill.com/products/456.jpg", gallery: [] },
            category: { id: "2", name: "Footwear", slug: "footwear" },
            collections: [],
            shipping_regions: [{ code: "EU", name: "European Union" }],
            created_at: "2026-02-01T00:00:00Z",
            updated_at: null,
          },
        ],
        meta: {
          pagination: { page: 1, per_page: 24, total: 1, page_count: 1 },
          request_id: "req-search-products",
        },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 3. GET /v1/products/:id - product detail
  http.get(`${BASE_URL}/v1/products/:id`, ({ params }) => {
    const id = Number(params.id);
    return HttpResponse.json(
      {
        data: {
          id,
          slug: "test-product",
          name: "Test Product",
          description: "Test description",
          sku: "TEST-001",
          price: 10.0,
          sale_price: null,
          stock: 100,
          stock_status: "instock",
          brand: null,
          images: { featured: null, gallery: [] },
          variations: [],
          category: null,
          collections: [],
          shipping_regions: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: null,
        },
        meta: { request_id: "req-product-detail" },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 4. GET /v1/products/slug/:slug - product by slug
  http.get(`${BASE_URL}/v1/products/slug/:slug`, ({ params }) => {
    return HttpResponse.json(
      {
        data: {
          id: 789,
          slug: params.slug as string,
          name: "Slug Product",
          description: "Product found by slug",
          sku: "SLG-001",
          price: 15.0,
          sale_price: null,
          stock: 50,
          stock_status: "instock",
          brand: null,
          images: { featured: null, gallery: [] },
          variations: [],
          category: null,
          collections: [],
          shipping_regions: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: null,
        },
        meta: { request_id: "req-product-slug" },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 5. GET /v1/categories - list categories
  http.get(`${BASE_URL}/v1/categories`, () => {
    return HttpResponse.json(
      {
        data: [
          { id: "1", slug: "apparel", name: "Apparel", parent_id: null },
          { id: "2", slug: "footwear", name: "Footwear", parent_id: null },
        ],
        meta: { request_id: "req-categories" },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 6. GET /v1/categories/:id - category detail
  http.get(`${BASE_URL}/v1/categories/:id`, ({ params }) => {
    return HttpResponse.json(
      {
        data: {
          id: String(params.id),
          slug: "apparel",
          name: "Apparel",
          parent_id: null,
          children: [
            { id: "10", slug: "tshirts", name: "T-Shirts", parent_id: "1" },
          ],
        },
        meta: { request_id: "req-category-detail" },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 7. GET /v1/brands - list brands
  http.get(`${BASE_URL}/v1/brands`, () => {
    return HttpResponse.json(
      {
        data: [
          { id: "1", name: "EcoWear", slug: "ecowear" },
          { id: "2", name: "RunFast", slug: "runfast" },
        ],
        meta: { request_id: "req-brands" },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 7b. GET /v1/brands/:id/shipping-price-lists - brand shipping rates
  http.get(`${BASE_URL}/v1/brands/:id/shipping-price-lists`, ({ params }) => {
    return HttpResponse.json(
      {
        data: [
          {
            id: 10,
            name: "EU",
            description: "EU coverage",
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
        meta: { request_id: `req-brand-${params.id}-shipping` },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 7c. GET /v1/brands/:id - brand detail
  http.get(`${BASE_URL}/v1/brands/:id`, ({ params }) => {
    return HttpResponse.json(
      {
        data: {
          id: String(params.id),
          name: "EcoWear",
          slug: "ecowear",
          description: "Sustainable apparel",
          logo: "https://assets.hertwill.com/brands/ecowear/logo.jpg",
          cover: "https://assets.hertwill.com/brands/ecowear/cover.jpg",
          marketing_assets_url: "https://drive.google.com/drive/folders/abc123",
          shipping_origin_iso_code: "EE",
        },
        meta: { request_id: `req-brand-${params.id}` },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // -------------------------------------------------------------------------
  // Authenticated endpoints
  // -------------------------------------------------------------------------

  // 8. GET /v1/import-list
  http.get(`${BASE_URL}/v1/import-list`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: [
          {
            id: 1,
            product_id: 123,
            name: "Test Product",
            sku: "TEST-001",
            price: 10.0,
            status: "not-synced",
            images: { featured: null, gallery: [] },
            added_at: "2026-01-15T00:00:00Z",
          },
        ],
        meta: {
          pagination: { page: 1, per_page: 24, total: 1, page_count: 1 },
        },
      },
      { headers: authRateLimitHeaders },
    );
  }),

  // 9. POST /v1/import-list/products
  http.post(`${BASE_URL}/v1/import-list/products`, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: [
          { product_id: 1, status: "added", parent_id: 1001, variation_ids: [2001] },
          { product_id: 2, status: "added" },
          { product_id: 3, status: "already_exists" },
        ],
      },
      { status: 201, headers: authRateLimitHeaders },
    );
  }),

  // 10. DELETE /v1/import-list/products/:productId
  http.delete(
    `${BASE_URL}/v1/import-list/products/:productId`,
    ({ request }) => {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader) {
        return HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
          { status: 401, headers: rateLimitHeaders },
        );
      }
      return new HttpResponse(null, {
        status: 200,
        headers: authRateLimitHeaders,
      });
    },
  ),

  // 11. POST /v1/sync/products
  http.post(`${BASE_URL}/v1/sync/products`, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: {
          product_id: 123,
          status: "syncing",
          message: "Sync started",
        },
      },
      { status: 202, headers: authRateLimitHeaders },
    );
  }),

  // 12. GET /v1/sync/jobs
  http.get(`${BASE_URL}/v1/sync/jobs`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: [
          {
            product_id: 123,
            name: "Test Product",
            status: "synced",
            started_at: "2026-01-15T00:00:00Z",
            completed_at: "2026-01-15T00:01:00Z",
            has_errors: false,
          },
        ],
        meta: {
          pagination: { page: 1, per_page: 24, total: 1, page_count: 1 },
        },
      },
      { headers: authRateLimitHeaders },
    );
  }),

  // 13. GET /v1/sync/jobs/:productId
  http.get(`${BASE_URL}/v1/sync/jobs/:productId`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing API key" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: {
          product_id: 123,
          name: "Test Product",
          status: "synced",
          started_at: "2026-01-15T00:00:00Z",
          completed_at: "2026-01-15T00:01:00Z",
          has_errors: false,
        },
      },
      { headers: authRateLimitHeaders },
    );
  }),

  // -------------------------------------------------------------------------
  // JWT Auth endpoints
  // -------------------------------------------------------------------------

  // 14. POST /v1/auth/register
  http.post(`${BASE_URL}/v1/auth/register`, async () => {
    return HttpResponse.json(
      {
        data: {
          message: "Registration successful, verification email sent",
        },
      },
      { status: 201, headers: rateLimitHeaders },
    );
  }),

  // 15. POST /v1/auth/login
  http.post(`${BASE_URL}/v1/auth/login`, async () => {
    return HttpResponse.json(
      {
        data: {
          token: "jwt-token-abc123",
          refresh_token: "refresh-token-xyz789",
          user: {},
        },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 16. POST /v1/auth/refresh
  http.post(`${BASE_URL}/v1/auth/refresh`, async () => {
    return HttpResponse.json(
      {
        data: {
          token: "new-jwt-token-abc456",
          refresh_token: "new-refresh-token-xyz012",
          user: {},
        },
      },
      { headers: rateLimitHeaders },
    );
  }),

  // 17. POST /v1/api-keys
  http.post(`${BASE_URL}/v1/api-keys`, async ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "JWT required" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return HttpResponse.json(
      {
        data: {
          id: 1,
          name: "My CLI Key",
          prefix: "hw_live_a1b2c3d4",
          key: "hw_live_FAKEKEY1",
          store_id: 42,
          created_at: "2026-04-07T12:00:00.000Z",
        },
      },
      { status: 201, headers: rateLimitHeaders },
    );
  }),

  // 18. DELETE /v1/api-keys/:id
  http.delete(`${BASE_URL}/v1/api-keys/:id`, ({ request }) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "JWT required" } },
        { status: 401, headers: rateLimitHeaders },
      );
    }
    return new HttpResponse(null, {
      status: 200,
      headers: rateLimitHeaders,
    });
  }),

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  // GET /health
  http.get(`${BASE_URL}/health`, () => {
    return HttpResponse.json(
      { status: "ok" },
      { headers: rateLimitHeaders },
    );
  }),
];

// ---------------------------------------------------------------------------
// Phase 4 additions — opt-in response factories used via mockServer.use(...)
// DO NOT add to the default `handlers` array above; each test composes these
// explicitly so normal paths stay happy-path.
// ---------------------------------------------------------------------------

/**
 * Simulate a 429 rate-limit response with both Retry-After and the draft-8
 * combined RateLimit header, mirroring the real Hertwill 429 shape.
 */
export const rateLimitedResponse429 = (retryAfterSeconds = 5) =>
  HttpResponse.json(
    { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" } },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        RateLimit: `"60-in-1min"; r=0; t=${retryAfterSeconds}`,
      },
    },
  );

/**
 * Simulate an upstream 503 (server error) with the documented envelope.
 */
export const serverErrorResponse503 = () =>
  HttpResponse.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Upstream unavailable",
      },
    },
    { status: 503 },
  );

/**
 * Simulate the real Hertwill /health which returns plain-text "OK".
 * Use via: mockServer.use(http.get(".../health", plainTextOkHealth))
 */
export const plainTextOkHealth = () =>
  new HttpResponse("OK", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });

// ---------------------------------------------------------------------------
// Phase 5 additions — authenticated-tool fixture factories
// ---------------------------------------------------------------------------

/** Simulate a 401 from Hertwill for any authenticated endpoint. */
export const invalidKeyResponse401 = () =>
  HttpResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
    { status: 401 },
  );

/** Empty import-list happy response (paginated envelope with 0 items). */
export const emptyImportListResponse = () =>
  HttpResponse.json(
    {
      data: [],
      meta: {
        pagination: { page: 1, per_page: 20, total: 0, page_count: 0 },
        request_id: "req-import-empty",
      },
    },
    { headers: { RateLimit: '"300-in-1min"; r=299; t=60' } },
  );

/**
 * POST /v1/import-list/products — echo the submitted product_ids as
 * `status: "added"`.
 */
export const addToImportListResponse = () =>
  http.post(
    `${BASE_URL}/v1/import-list/products`,
    async ({ request }) => {
      const body = (await request.json()) as { product_ids: number[] };
      return HttpResponse.json(
        {
          data: body.product_ids.map((id) => ({
            product_id: id,
            status: "added" as const,
          })),
        },
        { status: 201 },
      );
    },
  );

/** DELETE /v1/import-list/products/:productId — 204 no-content success. */
export const removeFromImportListResponse204 = () =>
  new HttpResponse(null, { status: 204 });

/** POST /v1/sync/products — 202 accepted with job id in message. */
export const syncProductsAcceptedResponse = (productId = 123) =>
  HttpResponse.json(
    {
      data: {
        product_id: productId,
        status: "syncing",
        message: `Sync started (job_id=job-${productId}-001)`,
      },
    },
    { status: 202 },
  );

/** GET /v1/sync/jobs — paginated list of sync jobs (matches client.listSyncJobs). */
export const syncJobsListResponse = (
  jobs: Array<
    Partial<{
      product_id: number;
      name: string | null;
      status: "syncing" | "synced" | "sync-failed" | "not-synced";
      started_at: string | null;
      completed_at: string | null;
      has_errors: boolean;
    }>
  > = [],
) =>
  HttpResponse.json({
    data: jobs.map((j, i) => ({
      product_id: j.product_id ?? 100 + i,
      name: j.name ?? "Test Product",
      status: j.status ?? "synced",
      started_at: j.started_at ?? "2026-01-15T00:00:00Z",
      completed_at: j.completed_at ?? "2026-01-15T00:01:00Z",
      has_errors: j.has_errors ?? false,
    })),
    meta: {
      pagination: {
        page: 1,
        per_page: 20,
        total: jobs.length,
        page_count: jobs.length === 0 ? 0 : 1,
      },
      request_id: "req-sync-jobs-list",
    },
  });
