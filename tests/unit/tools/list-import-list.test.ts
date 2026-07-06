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
import { createListImportListHandler } from "../../../src/tools/list-import-list.js";
import { mockServer } from "../../mocks/server.js";
import {
  invalidKeyResponse401,
  emptyImportListResponse,
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

function item(id: number) {
  return {
    id,
    product_id: 1000 + id,
    name: `Item ${id}`,
    price: 19.99,
    sale_price: null,
    stock_status: "instock",
    status: "not-synced",
    added_at: "2026-01-01T00:00:00Z",
  };
}

function makeListFixture(
  items: unknown[],
  overrides?: Partial<{ page: number; per_page: number; total: number; page_count: number }>,
) {
  return {
    data: items,
    meta: {
      pagination: {
        page: overrides?.page ?? 1,
        per_page: overrides?.per_page ?? 20,
        total: overrides?.total ?? items.length,
        page_count: overrides?.page_count ?? 1,
      },
      request_id: "req-il",
    },
  };
}

describe("list_import_list handler", () => {
  it("Test 1 — happy path with 2 items; hints-branch pinned", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, () =>
        HttpResponse.json(makeListFixture([item(1), item(2)])),
      ),
    );
    const handler = createListImportListHandler(buildTestDeps());
    const result = await handler({} as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      items: unknown[];
      hints: { next_step: string };
    };
    expect(sc.items.length).toBe(2);
    expect(result.content[0].text).toMatch(/2.*page 1/);
    // total=2 page_count=1 → !has_more → "no more" hint branch fires
    expect(sc.hints.next_step).toMatch(/sync_products|use|call/i);
  });

  it("Test 2 — empty list", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, emptyImportListResponse),
    );
    const handler = createListImportListHandler(buildTestDeps());
    const result = await handler({} as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/empty/i);
  });

  it("Test 3 — per_page=50 clamps to 20", async () => {
    let observed: string | null = null;
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, ({ request }) => {
        observed = new URL(request.url).searchParams.get("per_page");
        return HttpResponse.json(makeListFixture([item(1)]));
      }),
    );
    const deps = buildTestDeps();
    const clientSpy = vi.spyOn(deps.client, "listImportList");
    const handler = createListImportListHandler(deps);
    const result = await handler({ per_page: 50 } as never);
    expectStructuredAndText(result);
    expect(observed).toBe("20");
    expect(clientSpy).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20 }));
    expect(result.content[0].text).toContain("20");
    expect(result.content[0].text).toMatch(/clamp|budget|reduced/i);
  });

  it("Test 4 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, () => {
        spy();
        return HttpResponse.json(makeListFixture([item(1)]));
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ authLimiter: fakeLimiter });
    deps.authRateReset.observe(9);
    const handler = createListImportListHandler(deps);
    const result = await handler({} as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 9s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 5 — no API key: requireApiKey fires, zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, () => {
        spy();
        return HttpResponse.json(makeListFixture([item(1)]));
      }),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createListImportListHandler(deps);
    const result = await handler({} as never);
    expectToolError(result, /HERTWILL_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 6 — 401 from upstream", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, invalidKeyResponse401),
    );
    const handler = createListImportListHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /unauthorized|invalid|401|unexpected/i);
  });

  it("Test 7 — key-leakage guard on 500", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/import-list`, () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "boom hw_live_LEAK999" } },
          { status: 500 },
        ),
      ),
    );
    const handler = createListImportListHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /./);
  }, 15000);
});
