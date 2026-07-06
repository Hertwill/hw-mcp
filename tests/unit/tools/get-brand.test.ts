import type Bottleneck from "bottleneck";
import { HttpResponse, http } from "msw";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { HertwillClient } from "../../../src/hertwill/client.js";
import {
  authLimiter,
  publicLimiter,
} from "../../../src/hertwill/rate-limiter.js";
import { createGetBrandHandler } from "../../../src/tools/get-brand.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";
import type { ToolDeps } from "../../../src/tools/types.js";
import {
  expectStructuredAndText,
  expectToolError,
} from "../../helpers/mcp-assertions.js";
import { createMockMcpServer } from "../../helpers/mock-mcp-server.js";
import { mockServer } from "../../mocks/server.js";

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

function brandFixture(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "214",
      name: "EcoWear",
      slug: "ecowear",
      description: "Sustainable apparel",
      logo: "https://assets.hertwill.com/brands/ecowear/logo.jpg",
      cover: "https://assets.hertwill.com/brands/ecowear/cover.jpg",
      marketing_assets_url: "https://drive.google.com/drive/folders/abc123",
      shipping_origin_iso_code: "EE",
      ...overrides,
    },
    meta: { request_id: "req-brand" },
  };
}

describe("get_brand handler", () => {
  it("Test 1 — happy path exposes marketing material links", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id`, () =>
        HttpResponse.json(brandFixture()),
      ),
    );
    const handler = createGetBrandHandler(buildTestDeps());
    const result = await handler({ brand_id: 214 } as never);
    expectStructuredAndText(result);
    const sc = result.structuredContent as {
      marketing_assets_url: string;
      cover: string;
      shipping_origin_iso_code: string;
    };
    expect(sc.marketing_assets_url).toBe(
      "https://drive.google.com/drive/folders/abc123",
    );
    expect(sc.cover).toContain("cover.jpg");
    expect(sc.shipping_origin_iso_code).toBe("EE");
    expect(result.content[0].text).toMatch(/has marketing materials/);
  });

  it("Test 2 — null marketing link summarised as 'no marketing materials'", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id`, () =>
        HttpResponse.json(brandFixture({ marketing_assets_url: null })),
      ),
    );
    const handler = createGetBrandHandler(buildTestDeps());
    const result = await handler({ brand_id: 214 } as never);
    expectStructuredAndText(result);
    expect(result.content[0].text).toMatch(/no marketing materials link/);
  });

  it("Test 3 — 404 not found surfaces error", async () => {
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id`, () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "Brand not found" },
          { status: 404 },
        ),
      ),
    );
    const handler = createGetBrandHandler(buildTestDeps());
    const result = await handler({ brand_id: 999 } as never);
    expectToolError(result, /not found|404|error|unexpected/i);
  });

  it("Test 4 — reservoir exhausted pre-flight: zero upstream calls", async () => {
    const spy = vi.fn();
    mockServer.use(
      http.get(`${BASE_URL}/v1/brands/:id`, () => {
        spy();
        return HttpResponse.json(brandFixture());
      }),
    );
    const fakeLimiter = {
      currentReservoir: async () => 0,
    } as unknown as Bottleneck;
    const deps = buildTestDeps({ publicLimiter: fakeLimiter });
    deps.publicRateReset.observe(8);
    const handler = createGetBrandHandler(deps);
    const result = await handler({ brand_id: 214 } as never);
    expectToolError(result, /Rate limit exceeded\. Retry after 8s\./);
    expect(spy).not.toHaveBeenCalled();
  });
});
