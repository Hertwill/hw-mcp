import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-seasonal-picks prompt (PROMPT-04)", () => {
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
      { name: "test-seasonal-picks", version: "0.0.0" },
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
    expect(names).toContain("hw-seasonal-picks");
  });

  it("season argument is required", async () => {
    const { prompts } = await client.listPrompts();
    const seasonal = prompts.find((p) => p.name === "hw-seasonal-picks");
    const seasonArg = seasonal?.arguments?.find((a) => a.name === "season");
    expect(seasonArg).toBeDefined();
    expect(seasonArg?.required).toBe(true);
  });

  it("returns messages referencing search_products and the season text", async () => {
    const result = await client.getPrompt({
      name: "hw-seasonal-picks",
      arguments: { season: "Q4 gifts" },
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("search_products");
    expect(content.text).toContain("Q4 gifts");
  });

  it("references evaluate_product and calculate_margin", async () => {
    const result = await client.getPrompt({
      name: "hw-seasonal-picks",
      arguments: { season: "summer" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("evaluate_product");
    expect(content.text).toContain("calculate_margin");
  });

  it("interpolates optional budget filter", async () => {
    const result = await client.getPrompt({
      name: "hw-seasonal-picks",
      arguments: { season: "back-to-school", budget_max: "15" },
    });
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("EUR 15");
  });
});
