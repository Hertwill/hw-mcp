import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTaxonomyCache } from "../../../src/resources/taxonomy-cache.js";
import { registerBrands, BRANDS_URI } from "../../../src/resources/brands.js";
import type { ResourceDeps } from "../../../src/resources/types.js";
import type { BrandListResponse } from "../../../src/hertwill/schemas/categories.js";

const MOCK_BRANDS: BrandListResponse = {
  data: [
    { id: "1", name: "Nike", slug: "nike", description: "Just do it", logo: null },
    { id: "2", name: "Adidas", slug: "adidas", description: null, logo: null },
  ],
};

function makeDeps(
  overrides: Partial<ResourceDeps> = {},
): ResourceDeps {
  return {
    client: {
      listCategories: vi.fn(),
      listBrands: vi.fn().mockResolvedValue(MOCK_BRANDS),
    } as unknown as ResourceDeps["client"],
    publicLimiter: {} as ResourceDeps["publicLimiter"],
    authLimiter: {} as ResourceDeps["authLimiter"],
    logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } as unknown as ResourceDeps["logger"],
    serverVersion: "0.1.0-test",
    apiKey: undefined,
    publicRateReset: {} as ResourceDeps["publicRateReset"],
    authRateReset: {} as ResourceDeps["authRateReset"],
    healthCache: { get: vi.fn(), set: vi.fn() },
    taxonomyCache: createTaxonomyCache(),
    ...overrides,
  };
}

type ReadCallback = (uri: URL, extra: unknown) => Promise<{
  contents: Array<{ uri: string; mimeType?: string; text?: string }>;
}>;

function setupResource(deps: ResourceDeps): ReadCallback {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let captured: ReadCallback | undefined;

  const orig = server.registerResource.bind(server);
  vi.spyOn(server, "registerResource").mockImplementation(
    ((...args: unknown[]) => {
      captured = args[args.length - 1] as ReadCallback;
      return (orig as Function)(...args);
    }) as typeof server.registerResource,
  );

  registerBrands(server, deps);
  return captured!;
}

describe("registerBrands (RES-02)", () => {
  let readCallback: ReadCallback;
  let deps: ResourceDeps;

  beforeEach(() => {
    deps = makeDeps();
    readCallback = setupResource(deps);
  });

  it("registers with URI hertwill://taxonomy/brands and mimeType application/json", () => {
    expect(BRANDS_URI).toBe("hertwill://taxonomy/brands");
  });

  it("invokes client.listBrands() exactly once on cold read", async () => {
    const result = await readCallback(new URL(BRANDS_URI), {});

    expect(deps.client.listBrands).toHaveBeenCalledTimes(1);
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("application/json");

    const body = JSON.parse(result.contents[0].text!);
    expect(body.data).toEqual(MOCK_BRANDS);
  });

  it("does NOT invoke listBrands again on second read within TTL (cache hit)", async () => {
    await readCallback(new URL(BRANDS_URI), {});
    await readCallback(new URL(BRANDS_URI), {});

    expect(deps.client.listBrands).toHaveBeenCalledTimes(1);
  });

  it("returns stale body with last_fetched_at when listBrands fails after prior success", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-04-16T10:00:00.000Z");
      vi.setSystemTime(now);

      await readCallback(new URL(BRANDS_URI), {});

      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      (deps.client.listBrands as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Timeout"),
      );

      const result = await readCallback(new URL(BRANDS_URI), {});
      const body = JSON.parse(result.contents[0].text!);

      expect(body.stale).toBe(true);
      expect(body.last_fetched_at).toBe(now.toISOString());
      expect(result.contents[0].mimeType).toBe("application/json");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns error body (not throw) on cold start failure", async () => {
    const failDeps = makeDeps({
      client: {
        listCategories: vi.fn(),
        listBrands: vi.fn().mockRejectedValue(new Error("DNS failure")),
      } as unknown as ResourceDeps["client"],
    });

    const cb = setupResource(failDeps);

    const result = await cb(new URL(BRANDS_URI), {});
    const body = JSON.parse(result.contents[0].text!);

    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(body.error.message).toBe("DNS failure");
  });
});
