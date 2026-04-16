import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-eu-winners prompt (PROMPT-03)", () => {
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
      { name: "test-eu-winners", version: "0.0.0" },
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
    expect(names).toContain("hw-eu-winners");
  });

  it("returns messages with EU shipping filter", async () => {
    const result = await client.getPrompt({ name: "hw-eu-winners", arguments: {} });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("shipping_region");
    expect(content.text).toContain("eu");
  });

  it("references required tools", async () => {
    const result = await client.getPrompt({ name: "hw-eu-winners", arguments: {} });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("search_products");
    expect(content.text).toContain("evaluate_product");
    expect(content.text).toContain("calculate_margin");
  });

  it("defaults to 20% VAT rate", async () => {
    const result = await client.getPrompt({ name: "hw-eu-winners", arguments: {} });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("0.20");
  });

  it("mentions EU-specific considerations", async () => {
    const result = await client.getPrompt({ name: "hw-eu-winners", arguments: {} });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("DDP");
    expect(content.text).toContain("DDU");
  });

  it("uses custom VAT rate when provided", async () => {
    const result = await client.getPrompt({
      name: "hw-eu-winners",
      arguments: { vat_rate: "0.19" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("0.19");
  });
});
