import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-margin-check prompt (PROMPT-06)", () => {
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
      { name: "test-margin-check", version: "0.0.0" },
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
    expect(names).toContain("hw-margin-check");
  });

  it("product_id arg is required", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-margin-check");
    const productIdArg = prompt?.arguments?.find(
      (a) => a.name === "product_id",
    );
    expect(productIdArg?.required).toBe(true);
  });

  it("returns instructions referencing get_product and calculate_margin for valid ID", async () => {
    const result = await client.getPrompt({
      name: "hw-margin-check",
      arguments: { product_id: "42" },
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as {
      type: string;
      text: string;
    };
    expect(content.type).toBe("text");
    expect(content.text).toContain("get_product");
    expect(content.text).toContain("calculate_margin");
    expect(content.text).toContain("42");
  });

  it("returns error for non-numeric product_id", async () => {
    const result = await client.getPrompt({
      name: "hw-margin-check",
      arguments: { product_id: "abc" },
    });
    const content = result.messages[0].content as {
      type: string;
      text: string;
    };
    expect(content.text).toContain("Invalid");
    expect(content.text).toContain("abc");
  });

  it("returns error for zero product_id", async () => {
    const result = await client.getPrompt({
      name: "hw-margin-check",
      arguments: { product_id: "0" },
    });
    const content = result.messages[0].content as {
      type: string;
      text: string;
    };
    expect(content.text).toContain("Invalid");
  });
});
