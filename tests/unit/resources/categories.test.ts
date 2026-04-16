import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTaxonomyCache } from "../../../src/resources/taxonomy-cache.js";
import {
  registerCategories,
  CATEGORIES_URI,
} from "../../../src/resources/categories.js";
import type { ResourceDeps } from "../../../src/resources/types.js";
import type { CategoryListResponse } from "../../../src/hertwill/schemas/categories.js";

const MOCK_CATEGORIES: CategoryListResponse = {
  data: [
    { id: "1", slug: "shoes", name: "Shoes", parent_id: null },
    {
      id: "2",
      slug: "sneakers",
      name: "Sneakers",
      parent_id: "1",
      children: [],
    },
  ],
};

function makeDeps(
  overrides: Partial<ResourceDeps> = {},
): ResourceDeps {
  return {
    client: {
      listCategories: vi.fn().mockResolvedValue(MOCK_CATEGORIES),
      listBrands: vi.fn(),
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

/**
 * Register the resource while capturing the read callback via spy on registerResource.
 */
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

  registerCategories(server, deps);
  return captured!;
}

describe("registerCategories (RES-01)", () => {
  let readCallback: ReadCallback;
  let deps: ResourceDeps;

  beforeEach(() => {
    deps = makeDeps();
    readCallback = setupResource(deps);
  });

  it("registers with URI hertwill://taxonomy/categories and mimeType application/json", () => {
    expect(CATEGORIES_URI).toBe("hertwill://taxonomy/categories");
  });

  it("invokes client.listCategories() exactly once on cold read", async () => {
    const result = await readCallback(new URL(CATEGORIES_URI), {});

    expect(deps.client.listCategories).toHaveBeenCalledTimes(1);
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("application/json");

    const body = JSON.parse(result.contents[0].text!);
    expect(body.data).toEqual(MOCK_CATEGORIES);
  });

  it("does NOT invoke listCategories again on second read within TTL (cache hit)", async () => {
    await readCallback(new URL(CATEGORIES_URI), {});
    await readCallback(new URL(CATEGORIES_URI), {});

    expect(deps.client.listCategories).toHaveBeenCalledTimes(1);
  });

  it("returns stale body with last_fetched_at when listCategories fails after prior success", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-04-16T10:00:00.000Z");
      vi.setSystemTime(now);

      // First successful call
      await readCallback(new URL(CATEGORIES_URI), {});

      // Advance past TTL
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Make listCategories fail
      (deps.client.listCategories as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await readCallback(new URL(CATEGORIES_URI), {});
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
        listCategories: vi.fn().mockRejectedValue(new Error("Connection refused")),
        listBrands: vi.fn(),
      } as unknown as ResourceDeps["client"],
    });

    const cb = setupResource(failDeps);

    // Should NOT throw
    const result = await cb(new URL(CATEGORIES_URI), {});
    const body = JSON.parse(result.contents[0].text!);

    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(body.error.message).toBe("Connection refused");
  });
});
