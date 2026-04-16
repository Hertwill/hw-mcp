import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-competitor-match prompt (PROMPT-05)", () => {
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
      { name: "test-competitor-match", version: "0.0.0" },
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
    expect(names).toContain("hw-competitor-match");
  });

  it("input argument is required", async () => {
    const { prompts } = await client.listPrompts();
    const match = prompts.find((p) => p.name === "hw-competitor-match");
    const inputArg = match?.arguments?.find((a) => a.name === "input");
    expect(inputArg).toBeDefined();
    expect(inputArg?.required).toBe(true);
  });

  it("returns messages referencing search_products and the input text", async () => {
    const result = await client.getPrompt({
      name: "hw-competitor-match",
      arguments: { input: "Minimalist bamboo phone stand" },
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("search_products");
    expect(content.text).toContain("Minimalist bamboo phone stand");
  });

  it("references evaluate_product and calculate_margin", async () => {
    const result = await client.getPrompt({
      name: "hw-competitor-match",
      arguments: { input: "Wireless earbuds under $20" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("evaluate_product");
    expect(content.text).toContain("calculate_margin");
  });

  it("includes side-by-side comparison instructions", async () => {
    const result = await client.getPrompt({
      name: "hw-competitor-match",
      arguments: { input: "Test product" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("comparison");
  });
});
