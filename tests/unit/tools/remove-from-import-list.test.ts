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
import { createRemoveFromImportListHandler } from "../../../src/tools/remove-from-import-list.js";
import { mockServer } from "../../mocks/server.js";
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
    ...overrides,
  };
}

describe("remove_from_import_list handler (D-19 sequential fan-out)", () => {
  it("Test 1 — happy path: 3 ids all succeed", async () => {
    const calls: number[] = [];
    mockServer.use(
      http.delete(
        `${BASE_URL}/v1/import-list/products/:productId`,
        ({ params }) => {
          calls.push(Number(params.productId));
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    const handler = createRemoveFromImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [10, 11, 12] } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      results: Array<{ product_id: number; status: string }>;
      succeeded_count: number;
      failed_count: number;
    };
    expect(sc.succeeded_count).toBe(3);
    expect(sc.failed_count).toBe(0);
    expect(calls).toEqual([10, 11, 12]); // sequential order preserved
    expect(result.content[0].text).toMatch(/Removed 3 of 3/);
  });

  it("Test 2 — partial failure: 2 succeed, 1 404 → best-effort per-item status", async () => {
    mockServer.use(
      http.delete(
        `${BASE_URL}/v1/import-list/products/:productId`,
        ({ params }) => {
          if (params.productId === "99") {
            return HttpResponse.json(
              { error: { code: "NOT_FOUND", message: "no such item" } },
              { status: 404 },
            );
          }
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    const handler = createRemoveFromImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [10, 99, 12] } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      results: Array<{ product_id: number; status: string; reason?: string }>;
      succeeded_count: number;
      failed_count: number;
    };
    expect(sc.succeeded_count).toBe(2);
    expect(sc.failed_count).toBe(1);
    const failed = sc.results.find((r) => r.product_id === 99);
    expect(failed?.status).toBe("failed");
    expect(failed?.reason).toBeTruthy();
    expect(result.content[0].text).toMatch(/2 of 3; 1 failed/);
  });

  it("Test 3 — bucket short-circuit: reservoir < batch size → error, zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.delete(`${BASE_URL}/v1/import-list/products/:productId`, () => {
        spy();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 2 } as unknown as Bottleneck;
    const deps = buildTestDeps({ authLimiter: fakeLimiter });
    deps.authRateReset.observe(15);
    const handler = createRemoveFromImportListHandler(deps);
    const result = await handler({ product_ids: [1, 2, 3, 4, 5] } as never);
    expectToolError(result, /5 removes requested but only 2 tokens remaining.*Retry after 15s/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 4 — no-API-key: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.delete(`${BASE_URL}/v1/import-list/products/:productId`, () => {
        spy();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createRemoveFromImportListHandler(deps);
    const result = await handler({ product_ids: [1] } as never);
    expectToolError(result, /HERTWILL_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 5 — sequential not parallel: calls strictly ordered", async () => {
    const order: number[] = [];
    mockServer.use(
      http.delete(
        `${BASE_URL}/v1/import-list/products/:productId`,
        async ({ params }) => {
          order.push(Number(params.productId));
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    const handler = createRemoveFromImportListHandler(buildTestDeps());
    await handler({ product_ids: [30, 20, 10] } as never);
    expect(order).toEqual([30, 20, 10]);
  });

  it("Test 6 — reason sanitization: key fragments stripped from failure reasons (T-5-05)", async () => {
    mockServer.use(
      http.delete(`${BASE_URL}/v1/import-list/products/:productId`, () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "boom hw_live_LEAKME123" } },
          { status: 500 },
        ),
      ),
    );
    const handler = createRemoveFromImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [1] } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      results: Array<{ reason?: string }>;
    };
    const reason = sc.results[0]?.reason ?? "";
    expect(reason).not.toMatch(/hw_(live|test)_[a-zA-Z0-9]+/);
  }, 15000);
});
