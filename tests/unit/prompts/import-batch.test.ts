import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-import-batch prompt (PROMPT-07)", () => {
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

    const server = createServer({ apiKey: "hw_test_fake" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client(
      { name: "test-import-batch", version: "0.0.0" },
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
    expect(names).toContain("hw-import-batch");
  });

  it("product_ids arg is required", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-import-batch");
    const arg = prompt?.arguments?.find((a) => a.name === "product_ids");
    expect(arg?.required).toBe(true);
  });

  it("returns instructions with validation, confirmation, and import steps", async () => {
    const result = await client.getPrompt({
      name: "hw-import-batch",
      arguments: { product_ids: "123,456,789" },
    });
    expect(result.messages.length).toBeGreaterThan(0);
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("get_product");
    expect(content.text).toContain("add_to_import_list");
    expect(content.text).toContain("123");
    expect(content.text).toContain("456");
    expect(content.text).toContain("789");
  });

  it("includes explicit confirmation step (D-32)", async () => {
    const result = await client.getPrompt({
      name: "hw-import-batch",
      arguments: { product_ids: "42" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toMatch(/confirm|consent|yes.*no/i);
    expect(content.text).toContain("MUST ask the user to confirm");
  });

  it("returns error for invalid product_ids", async () => {
    const result = await client.getPrompt({
      name: "hw-import-batch",
      arguments: { product_ids: "abc,xyz" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("Invalid");
  });

  it("returns error for empty product_ids", async () => {
    const result = await client.getPrompt({
      name: "hw-import-batch",
      arguments: { product_ids: "" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("Invalid");
  });
});
