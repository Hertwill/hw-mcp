import type Bottleneck from "bottleneck";
import createClient from "openapi-fetch";
import pRetry, { AbortError } from "p-retry";
import type { z } from "zod";
import { HertwillApiError } from "../errors/api-error.js";
import type { paths } from "./generated/api.js";
import {
  authLimiter,
  publicLimiter,
  updateFromHeaders,
} from "./rate-limiter.js";
import { createRetryOptions, isRetryableStatus } from "./retry.js";
import { validateResponse } from "./schemas/common.js";
import type {
  AddToImportListResponse,
  BrandListResponse,
  CategoryDetailResponse,
  CategoryListResponse,
  CreateApiKeyResponse,
  ImportListResponse,
  LoginResponse,
  ProductDetailResponse,
  ProductListResponse,
  ProductSearchResponse,
  RefreshResponse,
  RegisterResponse,
  SyncJobDetailResponse,
  SyncJobsResponse,
  SyncProductResponse,
} from "./schemas/index.js";
import {
  AddToImportListResponseSchema,
  BrandListResponseSchema,
  CategoryDetailResponseSchema,
  CategoryListResponseSchema,
  CreateApiKeyResponseSchema,
  ImportListResponseSchema,
  LoginResponseSchema,
  ProductDetailResponseSchema,
  ProductListResponseSchema,
  ProductSearchResponseSchema,
  RefreshResponseSchema,
  RegisterResponseSchema,
  SyncJobDetailResponseSchema,
  SyncJobsResponseSchema,
  SyncProductResponseSchema,
} from "./schemas/index.js";

/**
 * Configuration for the HertwillClient.
 */
export interface HertwillClientConfig {
  /** Hertwill API key (hw_live_...). If set, authenticated endpoints are available. */
  apiKey?: string;
  /** Base URL for the Hertwill API. Defaults to https://api.hertwill.com */
  baseUrl?: string;
  /** Rate limiter to use. If omitted, uses the default module-level singleton. */
  limiter?: Bottleneck;
}

/**
 * HertwillClient is the sole HTTP gateway to the Hertwill API.
 *
 * Every method applies rate limiting, retry with exponential backoff,
 * and Zod response validation. Tool handlers (Phase 4+) import this
 * client instead of making direct HTTP calls.
 */
export class HertwillClient {
  private api: ReturnType<typeof createClient<paths>>;
  private limiter: Bottleneck;
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: HertwillClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.hertwill.com";
    this.api = createClient<paths>({
      baseUrl: this.baseUrl,
      headers: config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {},
    });
    this.limiter =
      config.limiter ?? (config.apiKey ? authLimiter : publicLimiter);

    // SEC-05: Response size cap — reject bodies > 5 MB to prevent memory exhaustion
    // from malicious or corrupt API responses (D-40).
    const MAX_RESPONSE_BYTES = 5_242_880; // 5 MB

    this.api.use({
      async onResponse({ response }) {
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
          throw new HertwillApiError(
            413,
            "RESPONSE_TOO_LARGE",
            `Response size ${contentLength} bytes exceeds ${MAX_RESPONSE_BYTES} byte limit`,
          );
        }
        // Clone to check actual body size when content-length header is absent
        const clone = response.clone();
        const buf = await clone.arrayBuffer();
        if (buf.byteLength > MAX_RESPONSE_BYTES) {
          throw new HertwillApiError(
            413,
            "RESPONSE_TOO_LARGE",
            `Response body ${buf.byteLength} bytes exceeds ${MAX_RESPONSE_BYTES} byte limit`,
          );
        }
        return response;
      },
    });
  }

  /**
   * Lightweight liveness probe against GET /health.
   *
   * Bypasses the rate limiter (probes must not consume or self-throttle
   * against the normal request reservoir) and goes through native fetch
   * directly — NO Authorization header is sent, even when an apiKey is
   * configured, to keep the probe key-free (T-4-01 secondary mitigation).
   *
   * Tolerant to both JSON and plain-text 200 responses — only the status
   * code is treated as the signal. Any non-2xx, network failure, or 3s
   * timeout resolves to `{ok:false, latency_ms:null}` rather than throwing.
   */
  async health(): Promise<{ ok: boolean; latency_ms: number | null }> {
    const started = performance.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { ok: false, latency_ms: null };
      // Drain the body to free the socket; ignore content.
      await res.text().catch(() => undefined);
      return { ok: true, latency_ms: Math.round(performance.now() - started) };
    } catch {
      return { ok: false, latency_ms: null };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Core request pipeline: rate-limit -> retry -> validate.
   * Every named method delegates here.
   */
  private async request<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    fn: () => Promise<{ data?: unknown; error?: unknown; response: Response }>,
  ): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(async () => {
        const { data, error, response } = await fn();
        updateFromHeaders(this.limiter, response);

        if (error || !response.ok) {
          const apiError = HertwillApiError.fromResponse(
            response,
            error as { error: { code: string; message: string } },
          );
          if (!isRetryableStatus(apiError.status)) {
            throw new AbortError(apiError);
          }
          throw apiError;
        }

        // Schema validation errors are non-retryable — abort immediately
        try {
          return validateResponse(schema, data, endpoint);
        } catch (validationError) {
          throw new AbortError(validationError as Error);
        }
      }, createRetryOptions()),
    );
  }

  /**
   * Request pipeline variant for JWT-authenticated endpoints.
   * Same as request() but allows overriding the Authorization header.
   */
  private async requestWithAuth<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    _jwtToken: string,
    fn: () => Promise<{ data?: unknown; error?: unknown; response: Response }>,
  ): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(async () => {
        const { data, error, response } = await fn();
        updateFromHeaders(this.limiter, response);

        if (error || !response.ok) {
          const apiError = HertwillApiError.fromResponse(
            response,
            error as { error: { code: string; message: string } },
          );
          if (!isRetryableStatus(apiError.status)) {
            throw new AbortError(apiError);
          }
          throw apiError;
        }

        try {
          return validateResponse(schema, data, endpoint);
        } catch (validationError) {
          throw new AbortError(validationError as Error);
        }
      }, createRetryOptions()),
    );
  }

  /**
   * Guard: throws HertwillApiError(401, AUTH_REQUIRED) if no API key is configured.
   * Called by all authenticated methods before making HTTP calls (T-02-11).
   */
  private requireAuth(method: string): void {
    if (!this.apiKey) {
      throw new HertwillApiError(
        401,
        "AUTH_REQUIRED",
        `${method} requires an API key. Set HERTWILL_API_KEY in your MCP server configuration.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Public endpoints (no auth required) — 7 methods
  // ---------------------------------------------------------------------------

  /** 1. GET /v1/products — Browse products with filtering, sorting, pagination. */
  async listProducts(params?: {
    page?: number;
    per_page?: number;
    sort_by?: "price" | "date" | "sales";
    sort_order?: "asc" | "desc";
    brand?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    on_sale?: boolean;
    stock_status?: "instock" | "outofstock";
    shipping_region?: string;
    attributes?: string;
  }): Promise<ProductListResponse> {
    return this.request("GET /v1/products", ProductListResponseSchema, () =>
      this.api.GET("/v1/products", { params: { query: params } }),
    );
  }

  /** 2. GET /v1/products/search — Hybrid keyword + semantic product search. */
  async searchProducts(params: {
    q: string;
    page?: number;
    per_page?: number;
    sort_by?: "price" | "date" | "sales";
    sort_order?: "asc" | "desc";
    brand?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    on_sale?: boolean;
    stock_status?: "instock" | "outofstock";
    shipping_region?: string;
    attributes?: string;
  }): Promise<ProductSearchResponse> {
    return this.request(
      "GET /v1/products/search",
      ProductSearchResponseSchema,
      () => this.api.GET("/v1/products/search", { params: { query: params } }),
    );
  }

  /** 3. GET /v1/products/{id} — Get product detail by numeric ID. */
  async getProduct(id: number): Promise<ProductDetailResponse> {
    return this.request(
      "GET /v1/products/{id}",
      ProductDetailResponseSchema,
      () =>
        this.api.GET("/v1/products/{id}", {
          params: { path: { id: String(id) } },
        }),
    );
  }

  /** 4. GET /v1/products/slug/{slug} — Get product detail by slug. */
  async getProductBySlug(slug: string): Promise<ProductDetailResponse> {
    return this.request(
      "GET /v1/products/slug/{slug}",
      ProductDetailResponseSchema,
      () =>
        this.api.GET("/v1/products/slug/{slug}", {
          params: { path: { slug } },
        }),
    );
  }

  /** 5. GET /v1/categories — List all categories. */
  async listCategories(): Promise<CategoryListResponse> {
    return this.request("GET /v1/categories", CategoryListResponseSchema, () =>
      this.api.GET("/v1/categories"),
    );
  }

  /** 6. GET /v1/categories/{id} — Get category by ID or slug. */
  async getCategory(id: number | string): Promise<CategoryDetailResponse> {
    return this.request(
      "GET /v1/categories/{id}",
      CategoryDetailResponseSchema,
      () =>
        this.api.GET("/v1/categories/{id}", {
          params: { path: { id: String(id) } },
        }),
    );
  }

  /** 7. GET /v1/brands — List all brands. */
  async listBrands(): Promise<BrandListResponse> {
    return this.request("GET /v1/brands", BrandListResponseSchema, () =>
      this.api.GET("/v1/brands"),
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated endpoints (API key required) — 6 methods
  // ---------------------------------------------------------------------------

  /** 8. GET /v1/import-list — List products in import list. */
  async listImportList(params?: {
    page?: number;
    per_page?: number;
    status?:
      | "not-synced"
      | "syncing"
      | "synced"
      | "sync-failed"
      | "approved"
      | "rejected"
      | "pending"
      | "approval-required";
    order_by?: "added_dt" | "name" | "price";
    order?: "asc" | "desc";
  }): Promise<ImportListResponse> {
    this.requireAuth("listImportList");
    return this.request("GET /v1/import-list", ImportListResponseSchema, () =>
      this.api.GET("/v1/import-list", { params: { query: params } }),
    );
  }

  /** 9. POST /v1/import-list/products — Add products to import list (max 50). */
  async addToImportList(
    productIds: number[],
  ): Promise<AddToImportListResponse> {
    this.requireAuth("addToImportList");
    return this.request(
      "POST /v1/import-list/products",
      AddToImportListResponseSchema,
      () =>
        this.api.POST("/v1/import-list/products", {
          body: { product_ids: productIds },
        }),
    );
  }

  /** 10. DELETE /v1/import-list/products/{productId} — Remove product from import list. */
  async removeFromImportList(productId: number): Promise<void> {
    this.requireAuth("removeFromImportList");
    return this.limiter.schedule(() =>
      pRetry(async () => {
        const { error, response } = await this.api.DELETE(
          "/v1/import-list/products/{productId}",
          { params: { path: { productId } } },
        );
        updateFromHeaders(this.limiter, response);
        if (error || !response.ok) {
          const apiError = HertwillApiError.fromResponse(
            response,
            error as { error: { code: string; message: string } },
          );
          if (!isRetryableStatus(apiError.status)) {
            throw new AbortError(apiError);
          }
          throw apiError;
        }
      }, createRetryOptions()),
    );
  }

  /** 11. POST /v1/sync/products — Start syncing a product to connected store. */
  async syncProducts(body: {
    product_id: number;
    default_store_markup: number;
    currency?: string;
    lang?: string;
    variations?: Array<{
      id: number;
      dropship_id: number;
      default_store_markup: number;
    }>;
  }): Promise<SyncProductResponse> {
    this.requireAuth("syncProducts");
    return this.request(
      "POST /v1/sync/products",
      SyncProductResponseSchema,
      () => this.api.POST("/v1/sync/products", { body }),
    );
  }

  /** 12. GET /v1/sync/jobs — List sync jobs with optional status filter. */
  async listSyncJobs(params?: {
    page?: number;
    per_page?: number;
    status?: "syncing" | "synced" | "sync-failed" | "not-synced";
  }): Promise<SyncJobsResponse> {
    this.requireAuth("listSyncJobs");
    return this.request("GET /v1/sync/jobs", SyncJobsResponseSchema, () =>
      this.api.GET("/v1/sync/jobs", { params: { query: params } }),
    );
  }

  /** 13. GET /v1/sync/jobs/{productId} — Get sync status for a specific product. */
  async getSyncJob(productId: number): Promise<SyncJobDetailResponse> {
    this.requireAuth("getSyncJob");
    return this.request(
      "GET /v1/sync/jobs/{productId}",
      SyncJobDetailResponseSchema,
      () =>
        this.api.GET("/v1/sync/jobs/{productId}", {
          params: { path: { productId } },
        }),
    );
  }

  // ---------------------------------------------------------------------------
  // JWT Auth endpoints (no API key required) — 5 methods
  // ---------------------------------------------------------------------------

  /** 14. POST /v1/auth/register — Register a new account. */
  async register(params: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<RegisterResponse> {
    return this.request("POST /v1/auth/register", RegisterResponseSchema, () =>
      this.api.POST("/v1/auth/register", { body: params }),
    );
  }

  /** 15. POST /v1/auth/login — Login and get JWT + refresh token. */
  async login(params: {
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    return this.request("POST /v1/auth/login", LoginResponseSchema, () =>
      this.api.POST("/v1/auth/login", { body: params }),
    );
  }

  /** 16. POST /v1/auth/refresh — Refresh JWT token using refresh token. */
  async refreshToken(token: string): Promise<RefreshResponse> {
    return this.request("POST /v1/auth/refresh", RefreshResponseSchema, () =>
      this.api.POST("/v1/auth/refresh", {
        body: { refresh_token: token },
      }),
    );
  }

  /** 17. POST /v1/api-keys — Create a new store-scoped API key (requires JWT). */
  async createApiKey(
    jwtToken: string,
    params: { name: string; store_id: number },
  ): Promise<CreateApiKeyResponse> {
    return this.requestWithAuth(
      "POST /v1/api-keys",
      CreateApiKeyResponseSchema,
      jwtToken,
      () =>
        this.api.POST("/v1/api-keys", {
          body: params,
          headers: { Authorization: `Bearer ${jwtToken}` },
        }),
    );
  }

  /** 18. DELETE /v1/api-keys/{id} — Revoke an API key (requires JWT). */
  async revokeApiKey(jwtToken: string, keyId: number): Promise<void> {
    await this.limiter.schedule(() =>
      pRetry(async () => {
        const { error, response } = await this.api.DELETE("/v1/api-keys/{id}", {
          params: { path: { id: keyId } },
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        updateFromHeaders(this.limiter, response);
        if (error || !response.ok) {
          const apiError = HertwillApiError.fromResponse(
            response,
            error as { error: { code: string; message: string } },
          );
          if (!isRetryableStatus(apiError.status)) {
            throw new AbortError(apiError);
          }
          throw apiError;
        }
      }, createRetryOptions()),
    );
  }
}
