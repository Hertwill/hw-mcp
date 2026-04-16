import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-winner-scan prompt (PROMPT-01)", () => {
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
      { name: "test-winner-scan", version: "0.0.0" },
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
    expect(names).toContain("hw-winner-scan");
  });

  it("returns messages with tool instructions", async () => {
    const result = await client.getPrompt({
      name: "hw-winner-scan",
      arguments: {},
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("search_products");
    expect(content.text).toContain("evaluate_product");
    expect(content.text).toContain("calculate_margin");
  });

  it("interpolates optional args into instructions", async () => {
    const result = await client.getPrompt({
      name: "hw-winner-scan",
      arguments: { budget_max: "25", category: "Electronics" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("EUR 25");
    expect(content.text).toContain("Electronics");
  });

  it("uses default VAT rate when vat_rate not provided", async () => {
    const result = await client.getPrompt({
      name: "hw-winner-scan",
      arguments: {},
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("0.20");
  });

  it("uses custom VAT rate when provided", async () => {
    const result = await client.getPrompt({
      name: "hw-winner-scan",
      arguments: { vat_rate: "0.25" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("0.25");
  });
});
