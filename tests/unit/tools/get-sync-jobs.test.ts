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
import { createGetSyncJobsHandler } from "../../../src/tools/get-sync-jobs.js";
import { mockServer } from "../../mocks/server.js";
import {
  syncJobsListResponse,
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
    ...overrides,
  };
}

describe("get_sync_jobs handler (paginated list via listSyncJobs)", () => {
  it("Test 1 — happy non-empty list with 1 error", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, () =>
        syncJobsListResponse([
          { product_id: 1, status: "synced", has_errors: false },
          { product_id: 2, status: "sync-failed", has_errors: true },
          { product_id: 3, status: "syncing", has_errors: false },
        ]),
      ),
    );
    const handler = createGetSyncJobsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      items: unknown[];
      hints: { next_step: string };
    };
    expect(sc.items.length).toBe(3);
    expect(result.content[0].text).toMatch(/3 sync job\(s\).*1 with errors/);
    expect(sc.hints.next_step).toBe("All sync jobs returned.");
  });

  it("Test 2 — empty list", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, () => syncJobsListResponse([])),
    );
    const handler = createGetSyncJobsHandler(buildTestDeps());
    const result = await handler({ status: "synced" } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/No sync jobs with status=synced/);
  });

  it("Test 3 — per_page=50 clamps to 20", async () => {
    let observed: string | null = null;
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, ({ request }) => {
        observed = new URL(request.url).searchParams.get("per_page");
        return syncJobsListResponse([
          { product_id: 1, status: "synced", has_errors: false },
        ]);
      }),
    );
    const deps = buildTestDeps();
    const clientSpy = vi.spyOn(deps.client, "listSyncJobs");
    const handler = createGetSyncJobsHandler(deps);
    const result = await handler({ per_page: 50 } as never);
    expectStructuredAndText(result);
    expect(observed).toBe("20");
    expect(clientSpy).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20 }));
    expect(result.content[0].text).toContain("20");
    expect(result.content[0].text).toMatch(/reduced/i);
  });

  it("Test 4 — 401 from upstream", async () => {
    mockServer.use(http.get(`${BASE_URL}/v1/sync/jobs`, invalidKeyResponse401));
    const handler = createGetSyncJobsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /unauthorized|invalid|401|unexpected/i);
  });

  it("Test 5 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, () => {
        spy();
        return syncJobsListResponse([]);
      }),
    );
    const fakeLimiter = { currentReservoir: async () => 0 } as unknown as Bottleneck;
    const deps = buildTestDeps({ authLimiter: fakeLimiter });
    deps.authRateReset.observe(9);
    const handler = createGetSyncJobsHandler(deps);
    const result = await handler({} as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 9s\./);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 6 — no-API-key: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, () => {
        spy();
        return syncJobsListResponse([]);
      }),
    );
    const deps = buildTestDeps({ apiKey: undefined });
    const handler = createGetSyncJobsHandler(deps);
    const result = await handler({} as never);
    expectToolError(result, /HERTWILL_API_KEY/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 7 — key-leakage guard on 500", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/sync/jobs`, () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "boom hw_live_SYNCLEAK" } },
          { status: 500 },
        ),
      ),
    );
    const handler = createGetSyncJobsHandler(buildTestDeps());
    const result = await handler({} as never);
    expectToolError(result, /./);
  }, 15000);
});
