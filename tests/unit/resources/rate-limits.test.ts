import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTaxonomyCache } from "../../../src/resources/taxonomy-cache.js";
import {
  registerRateLimits,
  RATE_LIMITS_URI,
} from "../../../src/resources/rate-limits.js";
import type { ResourceDeps } from "../../../src/resources/types.js";

function makeDeps(): ResourceDeps {
  return {
    client: {
      listCategories: vi.fn(),
      listBrands: vi.fn(),
    } as unknown as ResourceDeps["client"],
    publicLimiter: {} as ResourceDeps["publicLimiter"],
    authLimiter: {} as ResourceDeps["authLimiter"],
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    } as unknown as ResourceDeps["logger"],
    serverVersion: "0.1.0-test",
    apiKey: undefined,
    publicRateReset: {} as ResourceDeps["publicRateReset"],
    authRateReset: {} as ResourceDeps["authRateReset"],
    healthCache: { get: vi.fn(), set: vi.fn() },
    taxonomyCache: createTaxonomyCache(),
  };
}

type ReadCallback = (
  uri: URL,
  extra: unknown,
) => Promise<{
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

  registerRateLimits(server, deps);

  if (!captured) throw new Error("registerResource was not called");
  return captured;
}

const EXPECTED_CONTENT = readFileSync(
  new URL("../../../docs/resources/rate-limits.md", import.meta.url),
  "utf8",
);

describe("rate-limits resource (RES-04)", () => {
  it("exports the correct URI", () => {
    expect(RATE_LIMITS_URI).toBe("hertwill://docs/rate-limits");
  });

  it("returns text/markdown mime type", async () => {
    const readCb = setupResource(makeDeps());
    const result = await readCb(new URL(RATE_LIMITS_URI), {});
    expect(result.contents[0].mimeType).toBe("text/markdown");
  });

  it("returns byte-identical file content", async () => {
    const readCb = setupResource(makeDeps());
    const result = await readCb(new URL(RATE_LIMITS_URI), {});
    expect(result.contents[0].text).toBe(EXPECTED_CONTENT);
  });

  it('contains "60 requests per minute"', () => {
    expect(EXPECTED_CONTENT).toContain("60 requests per minute");
  });

  it('contains "300 requests per minute"', () => {
    expect(EXPECTED_CONTENT).toContain("300 requests per minute");
  });

  it('contains "Retry-After"', () => {
    expect(EXPECTED_CONTENT).toContain("Retry-After");
  });

  it("returns consistent content on repeated reads", async () => {
    const readCb = setupResource(makeDeps());
    const r1 = await readCb(new URL(RATE_LIMITS_URI), {});
    const r2 = await readCb(new URL(RATE_LIMITS_URI), {});
    expect(r1.contents[0].text).toBe(r2.contents[0].text);
  });
});
