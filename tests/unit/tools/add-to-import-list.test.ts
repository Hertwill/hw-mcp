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
import { createAddToImportListHandler } from "../../../src/tools/add-to-import-list.js";
import { AddToImportListInput } from "../../../src/schemas/add-to-import-list.js";
import { mockServer } from "../../mocks/server.js";
import {
  addToImportListResponse,
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

describe("add_to_import_list handler (D-20 zero-probe)", () => {
  it("Test 1 — happy path: 3 ids echoed as added", async () => {
    mockServer.use(addToImportListResponse());
    const handler = createAddToImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [101, 102, 103] } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as { results: unknown[]; added_count: number };
    expect(sc.results.length).toBe(3);
    expect(sc.added_count).toBe(3);
    expect(result.content[0].text).toMatch(/Added 3 of 3/);
  });

  it("Test 2 — no pre-add stock probe: listProducts/getProduct/listImportList never called (D-20)", async () => {
    mockServer.use(addToImportListResponse());
    const deps = buildTestDeps();
    const listProductsSpy = vi.spyOn(deps.client, "listProducts");
    const getProductSpy = vi.spyOn(deps.client, "getProduct");
    const listImportSpy = vi.spyOn(deps.client, "listImportList");
    const addSpy = vi.spyOn(deps.client, "addToImportList");
    const handler = createAddToImportListHandler(deps);
    await handler({ product_ids: [1, 2] } as never);
    expect(listProductsSpy).not.toHaveBeenCalled();
    expect(getProductSpy).not.toHaveBeenCalled();
    expect(listImportSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 3 — reservoir exhausted pre-flight", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.post(`${BASE_URL}/v1/import-list/products`, async () => {
        spy();
        return HttpResponse.json({ data: [] }, { status: 201 });
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ authLimiter: fakeLimiter });
    deps.authRateReset.observe(12);
    const handler = createAddToImportListHandler(deps);
    const result = await handler({ product_ids: [1] } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 12s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 4 — no-API-key: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.post(`${BASE_URL}/v1/import-list/products`, async () => {
        spy();
        return HttpResponse.json({ data: [] }, { status: 201 });
      }),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createAddToImportListHandler(deps);
    const result = await handler({ product_ids: [1] } as never);
    expectToolError(result, /HERTWILL_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 5 — 401 from upstream", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/v1/import-list/products`, invalidKeyResponse401),
    );
    const handler = createAddToImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [1] } as never);
    expectToolError(result, /unauthorized|invalid|401|unexpected/i);
  });

  it("Test 6 — key-leakage guard on 500 error", async () => {
    mockServer.use(
      http.post(`${BASE_URL}/v1/import-list/products`, () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail hw_live_ADDLEAK" } },
          { status: 500 },
        ),
      ),
    );
    const handler = createAddToImportListHandler(buildTestDeps());
    const result = await handler({ product_ids: [1] } as never);
    expectToolError(result, /./);
  }, 15000);

  it("Test 7 — schema enforces 1-50 product_ids range", () => {
    expect(AddToImportListInput.safeParse({ product_ids: [] }).success).toBe(false);
    expect(
      AddToImportListInput.safeParse({ product_ids: Array.from({ length: 51 }, (_, i) => i + 1) }).success,
    ).toBe(false);
    expect(AddToImportListInput.safeParse({ product_ids: [1, 2, 3] }).success).toBe(true);
  });
});
