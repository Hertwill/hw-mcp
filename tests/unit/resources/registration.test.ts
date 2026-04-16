import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

const EXPECTED_RESOURCE_URIS = [
  "hertwill://docs/eu-shipping",
  "hertwill://docs/rate-limits",
  "hertwill://schemas/product",
  "hertwill://taxonomy/brands",
  "hertwill://taxonomy/categories",
];

describe("Phase 6: resources registration (RES-01..05)", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    // Mock taxonomy upstream calls so we don't hit the network
    const { HertwillClient } = await import(
      "../../../src/hertwill/client.js"
    );
    vi.spyOn(HertwillClient.prototype, "listCategories").mockResolvedValue([
      { id: 1, name: "Test Category", slug: "test-category" },
    ] as never);
    vi.spyOn(HertwillClient.prototype, "listBrands").mockResolvedValue([
      { id: 1, name: "TestBrand", slug: "test-brand" },
    ] as never);

    const server = createServer({ apiKey: undefined });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client(
      { name: "test-registration", version: "0.0.0" },
      { capabilities: {} },
    );
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it("resources/list returns all 5 Phase-6 URIs", async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri).sort();
    expect(uris).toEqual(EXPECTED_RESOURCE_URIS);
  });

  it("schemas/product returns JSON Schema", async () => {
    const res = await client.readResource({
      uri: "hertwill://schemas/product",
    });
    expect(res.contents[0].mimeType).toBe("application/json");
    expect(String(res.contents[0].text).trim().startsWith("{")).toBe(true);
  });

  it("docs/rate-limits returns markdown with bucket info", async () => {
    const res = await client.readResource({
      uri: "hertwill://docs/rate-limits",
    });
    expect(res.contents[0].mimeType).toBe("text/markdown");
    expect(String(res.contents[0].text)).toContain("60 requests per minute");
  });

  it("docs/eu-shipping returns markdown with VAT context", async () => {
    const res = await client.readResource({
      uri: "hertwill://docs/eu-shipping",
    });
    expect(res.contents[0].mimeType).toBe("text/markdown");
    expect(String(res.contents[0].text)).toContain("VAT");
  });

  it("taxonomy/categories returns cached JSON data", async () => {
    const res = await client.readResource({
      uri: "hertwill://taxonomy/categories",
    });
    expect(res.contents[0].mimeType).toBe("application/json");
    const body = JSON.parse(String(res.contents[0].text));
    expect(body.data).toBeDefined();
  });

  it("taxonomy/brands returns cached JSON data", async () => {
    const res = await client.readResource({
      uri: "hertwill://taxonomy/brands",
    });
    expect(res.contents[0].mimeType).toBe("application/json");
    const body = JSON.parse(String(res.contents[0].text));
    expect(body.data).toBeDefined();
  });

  it("taxonomy/categories returns same data on second read (cache hit)", async () => {
    const res1 = await client.readResource({
      uri: "hertwill://taxonomy/categories",
    });
    const res2 = await client.readResource({
      uri: "hertwill://taxonomy/categories",
    });
    expect(res1.contents[0].text).toBe(res2.contents[0].text);
  });
});
