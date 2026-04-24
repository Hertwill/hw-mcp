import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../src/server.js";

describe("hw-store-health prompt (PROMPT-08)", () => {
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
      { name: "test-store-health", version: "0.0.0" },
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
    expect(names).toContain("hw-store-health");
  });

  it("has no required arguments", async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "hw-store-health");
    const requiredArgs = (prompt?.arguments ?? []).filter((a) => a.required);
    expect(requiredArgs).toHaveLength(0);
  });

  it("returns diagnostic instructions referencing all 4 auth tools", async () => {
    const result = await client.getPrompt({
      name: "hw-store-health",
    });
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as {
      type: string;
      text: string;
    };
    expect(content.type).toBe("text");
    expect(content.text).toContain("check_health");
    expect(content.text).toContain("list_import_list");
    expect(content.text).toContain("get_sync_jobs");
  });
});
