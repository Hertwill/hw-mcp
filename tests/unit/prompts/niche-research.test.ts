import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-niche-research prompt (PROMPT-02)", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const { HertwillClient } = await import(
      "../../../src/hertwill/client.js"
    );
    vi.spyOn(HertwillClient.prototype, "listCategories").mockResolvedValue(
      [] as never,
    );
    vi.spyOn(HertwillClient.prototype, "listBrands").mockResolvedValue(
      [] as never,
    );

    const server = createServer({ apiKey: undefined });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client(
      { name: "test-niche-research", version: "0.0.0" },
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

  it("appears in listPrompts", async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name);
    expect(names).toContain("hw-niche-research");
  });

  it("returns messages with search and analysis instructions", async () => {
    const result = await client.getPrompt({ name: "hw-niche-research", arguments: {} });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("search_products");
    expect(content.text).toContain("evaluate_product");
    expect(content.text).toContain("niche");
  });

  it("mentions minimum SKU count threshold", async () => {
    const result = await client.getPrompt({ name: "hw-niche-research", arguments: {} });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("20");
  });

  it("interpolates optional category filter", async () => {
    const result = await client.getPrompt({
      name: "hw-niche-research",
      arguments: { category: "Home & Garden" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("Home & Garden");
  });
});
