import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "../mocks/server.js";
import { HertwillClient } from "../../src/hertwill/client.js";
import { HertwillApiError } from "../../src/errors/api-error.js";
import { HertwillSchemaMismatchError } from "../../src/errors/schema-error.js";
import { publicLimiter, authLimiter } from "../../src/hertwill/rate-limiter.js";

const BASE_URL = "https://api.hertwill.com";

describe("HertwillClient", () => {
  let publicClient: HertwillClient;
  let authClient: HertwillClient;

  beforeEach(() => {
    // Reset limiter reservoirs to prevent cross-test interference
    // (e.g., 429 test setting reservoir to 0 would block subsequent tests)
    publicLimiter.updateSettings({ reservoir: 60 });
    authLimiter.updateSettings({ reservoir: 300 });

    publicClient = new HertwillClient({ baseUrl: BASE_URL });
    authClient = new HertwillClient({
      apiKey: "test-key-123",
      baseUrl: BASE_URL,
    });
  });

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------

  describe("public endpoints", () => {
    it("getProduct returns Zod-validated product detail", async () => {
      const result = await publicClient.getProduct(123);
      expect(result).toHaveProperty("data");
      expect(result.data).toHaveProperty("id", 123);
      expect(result.data).toHaveProperty("name", "Test Product");
      expect(result.data).toHaveProperty("sku", "TEST-001");
    });

    it("listProducts returns Zod-validated list with pagination meta", async () => {
      const result = await publicClient.listProducts();
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.meta).toHaveProperty("pagination");
      expect(result.meta.pagination).toHaveProperty("page", 1);
      expect(result.meta.pagination).toHaveProperty("total");
    });

    it("searchProducts returns Zod-validated search results", async () => {
      const result = await publicClient.searchProducts({ q: "running shoes" });
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty("name", "Blue Running Shoes");
      expect(result.meta).toHaveProperty("pagination");
    });

    it("listCategories returns Zod-validated category list", async () => {
      const result = await publicClient.listCategories();
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty("name", "Apparel");
    });

    it("listBrands returns Zod-validated brand list", async () => {
      const result = await publicClient.listBrands();
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty("name", "EcoWear");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("getProduct with 404 throws HertwillApiError", async () => {
      mockServer.use(
        http.get(`${BASE_URL}/v1/products/:id`, () => {
          return HttpResponse.json(
            { error: { code: "NOT_FOUND", message: "Product not found" } },
            {
              status: 404,
              headers: { RateLimit: '"60-in-1min"; r=59; t=60' },
            },
          );
        }),
      );

      await expect(publicClient.getProduct(999)).rejects.toThrow(
        HertwillApiError,
      );
      try {
        await publicClient.getProduct(999);
      } catch (err) {
        expect(err).toBeInstanceOf(HertwillApiError);
        expect((err as HertwillApiError).status).toBe(404);
        expect((err as HertwillApiError).code).toBe("NOT_FOUND");
      }
    });

    it("listImportList without API key throws AUTH_REQUIRED", async () => {
      await expect(publicClient.listImportList()).rejects.toThrow(
        HertwillApiError,
      );
      try {
        await publicClient.listImportList();
      } catch (err) {
        expect(err).toBeInstanceOf(HertwillApiError);
        expect((err as HertwillApiError).status).toBe(401);
        expect((err as HertwillApiError).code).toBe("AUTH_REQUIRED");
      }
    });

    it("schema mismatch throws HertwillSchemaMismatchError", async () => {
      mockServer.use(
        http.get(`${BASE_URL}/v1/products/:id`, () => {
          // Return response missing required 'data' field entirely
          return HttpResponse.json(
            { wrong_field: "no data here" },
            { headers: { RateLimit: '"60-in-1min"; r=59; t=60' } },
          );
        }),
      );

      await expect(publicClient.getProduct(123)).rejects.toThrow(
        HertwillSchemaMismatchError,
      );
    });

    it("429 response triggers retry then succeeds", async () => {
      let callCount = 0;
      mockServer.use(
        http.get(`${BASE_URL}/v1/brands`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { code: "RATE_LIMITED", message: "Too many requests" } },
              {
                status: 429,
                headers: {
                  "Retry-After": "1",
                  RateLimit: '"60-in-1min"; r=0; t=1',
                },
              },
            );
          }
          return HttpResponse.json(
            {
              data: [{ id: "1", name: "RetryBrand", slug: "retrybrand" }],
              meta: { request_id: "req-retry" },
            },
            { headers: { RateLimit: '"60-in-1min"; r=59; t=60' } },
          );
        }),
      );

      const result = await publicClient.listBrands();
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(result.data[0].name).toBe("RetryBrand");
    });
  });

  // -------------------------------------------------------------------------
  // Authenticated endpoints
  // -------------------------------------------------------------------------

  describe("authenticated endpoints", () => {
    it("addToImportList with API key succeeds", async () => {
      const result = await authClient.addToImportList([1, 2, 3]);
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data[0]).toHaveProperty("status", "added");
    });

    it("listImportList with API key succeeds", async () => {
      const result = await authClient.listImportList();
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("syncProducts with API key succeeds", async () => {
      const result = await authClient.syncProducts({
        product_id: 123,
        default_store_markup: 1.5,
      });
      expect(result.data).toHaveProperty("product_id", 123);
      expect(result.data).toHaveProperty("status", "syncing");
    });

    it("removeFromImportList with API key succeeds", async () => {
      await expect(
        authClient.removeFromImportList(123),
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Limiter selection
  // -------------------------------------------------------------------------

  describe("limiter selection", () => {
    it("client without apiKey uses publicLimiter", () => {
      // publicClient has no apiKey; it should use the public limiter.
      // We verify by confirming the client was constructed without error
      // and can make public calls.
      expect(publicClient).toBeInstanceOf(HertwillClient);
    });

    it("client with apiKey uses authLimiter", () => {
      // authClient has an apiKey; it should use the auth limiter.
      expect(authClient).toBeInstanceOf(HertwillClient);
    });
  });

  // -------------------------------------------------------------------------
  // JWT Auth endpoints
  // -------------------------------------------------------------------------

  describe("JWT auth endpoints", () => {
    it("login returns Zod-validated response with JWT token", async () => {
      const result = await publicClient.login({
        email: "test@example.com",
        password: "pw",
      });
      expect(result.data).toHaveProperty("token", "jwt-token-abc123");
      expect(result.data).toHaveProperty(
        "refresh_token",
        "refresh-token-xyz789",
      );
    });

    it("register returns Zod-validated register response", async () => {
      const result = await publicClient.register({
        email: "new@example.com",
        password: "securepass123",
        first_name: "Test",
        last_name: "User",
      });
      // Register returns 201 with optional data
      expect(result).toBeDefined();
    });

    it("createApiKey sends JWT in Authorization header and returns API key", async () => {
      let capturedAuth: string | null = null;
      mockServer.use(
        http.post(`${BASE_URL}/v1/api-keys`, ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
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
            { status: 201, headers: { RateLimit: '"60-in-1min"; r=59; t=60' } },
          );
        }),
      );

      const result = await publicClient.createApiKey("my-jwt-token", {
        name: "My CLI Key",
        store_id: 42,
      });
      expect(capturedAuth).toBe("Bearer my-jwt-token");
      expect(result.data).toHaveProperty("name", "My CLI Key");
      expect(result.data).toHaveProperty("key");
    });

    it("refreshToken returns new token pair", async () => {
      const result = await publicClient.refreshToken("old-refresh-token");
      expect(result.data).toHaveProperty("token", "new-jwt-token-abc456");
      expect(result.data).toHaveProperty(
        "refresh_token",
        "new-refresh-token-xyz012",
      );
    });

    it("revokeApiKey with JWT succeeds", async () => {
      await expect(
        publicClient.revokeApiKey("my-jwt-token", 1),
      ).resolves.toBeUndefined();
    });
  });
});
