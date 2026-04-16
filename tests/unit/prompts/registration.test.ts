import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

const EXPECTED_PROMPT_NAMES = [
  "hw-competitor-match",
  "hw-eu-winners",
  "hw-import-batch",
  "hw-margin-check",
  "hw-niche-research",
  "hw-seasonal-picks",
  "hw-store-health",
  "hw-winner-scan",
];

describe("Phase 7: prompt registration (PROMPT-01..08)", () => {
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

    // Use API key so authenticated tools register (store-health references them)
    const server = createServer({ apiKey: "hw_test_fake" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client(
      { name: "test-prompt-registration", version: "0.0.0" },
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

  it("prompts/list returns all 8 hw-* prompts", async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name).sort();
    expect(names).toEqual(EXPECTED_PROMPT_NAMES);
  });

  it("all prompts have name and description", async () => {
    const { prompts } = await client.listPrompts();
    for (const prompt of prompts) {
      expect(prompt.name).toBeTruthy();
      expect(prompt.description).toBeTruthy();
      expect(typeof prompt.description).toBe("string");
      expect(prompt.description!.length).toBeGreaterThan(0);
    }
  });

  it("hw-winner-scan returns messages with tool instructions", async () => {
    const result = await client.getPrompt({
      name: "hw-winner-scan",
      arguments: {},
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const text = result.messages[0].content.type === "text"
      ? result.messages[0].content.text
      : "";
    expect(text).toContain("search_products");
    expect(text).toContain("evaluate_product");
    expect(text).toContain("calculate_margin");
  });

  it("hw-seasonal-picks requires season arg", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-seasonal-picks");
    expect(prompt).toBeDefined();
    const seasonArg = prompt!.arguments?.find((a) => a.name === "season");
    expect(seasonArg).toBeDefined();
    expect(seasonArg!.required).toBe(true);
  });

  it("hw-competitor-match requires input arg", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-competitor-match");
    expect(prompt).toBeDefined();
    const inputArg = prompt!.arguments?.find((a) => a.name === "input");
    expect(inputArg).toBeDefined();
    expect(inputArg!.required).toBe(true);
  });

  it("hw-margin-check requires product_id arg", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-margin-check");
    expect(prompt).toBeDefined();
    const productIdArg = prompt!.arguments?.find(
      (a) => a.name === "product_id",
    );
    expect(productIdArg).toBeDefined();
    expect(productIdArg!.required).toBe(true);
  });

  it("hw-import-batch requires product_ids arg", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-import-batch");
    expect(prompt).toBeDefined();
    const productIdsArg = prompt!.arguments?.find(
      (a) => a.name === "product_ids",
    );
    expect(productIdsArg).toBeDefined();
    expect(productIdsArg!.required).toBe(true);
  });

  it("hw-margin-check returns instructions referencing get_product", async () => {
    const result = await client.getPrompt({
      name: "hw-margin-check",
      arguments: { product_id: "42" },
    });
    const text = result.messages[0].content.type === "text"
      ? result.messages[0].content.text
      : "";
    expect(text).toContain("get_product");
    expect(text).toContain("calculate_margin");
    expect(text).toContain("42");
  });

  it("hw-import-batch includes confirmation step", async () => {
    const result = await client.getPrompt({
      name: "hw-import-batch",
      arguments: { product_ids: "123,456" },
    });
    const text = result.messages[0].content.type === "text"
      ? result.messages[0].content.text
      : "";
    expect(text.toLowerCase()).toContain("confirm");
  });

  it("hw-store-health returns diagnostic instructions", async () => {
    const result = await client.getPrompt({
      name: "hw-store-health",
      arguments: {},
    });
    const text = result.messages[0].content.type === "text"
      ? result.messages[0].content.text
      : "";
    expect(text).toContain("check_auth");
    expect(text).toContain("check_health");
    expect(text).toContain("list_import_list");
    expect(text).toContain("get_sync_jobs");
  });

  it("hw-eu-winners references EU filter", async () => {
    const result = await client.getPrompt({
      name: "hw-eu-winners",
      arguments: {},
    });
    const text = result.messages[0].content.type === "text"
      ? result.messages[0].content.text
      : "";
    expect(text.toLowerCase()).toMatch(/shipping_region|eu/);
  });
});
