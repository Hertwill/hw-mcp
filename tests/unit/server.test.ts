import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOOL_DESCRIPTIONS } from "../../src/schemas/descriptions.js";
import { createServer } from "../../src/server.js";
import { mockServer } from "../mocks/server.js";

const EXPECTED_TOOLS = [
  "search_products",
  "list_products",
  "get_product",
  "evaluate_product",
  "calculate_margin",
  "check_health",
].sort();

async function listToolsViaInMemory(apiKey: string | undefined) {
  const server = createServer({ apiKey });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  const result = await client.listTools();
  await client.close();
  await server.close();
  return result.tools;
}

describe("createServer", () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey = process.env.HERTWILL_API_KEY;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.HERTWILL_API_KEY;
    else process.env.HERTWILL_API_KEY = savedKey;
  });

  it("starts without an API key", () => {
    delete process.env.HERTWILL_API_KEY;
    expect(() => createServer({ apiKey: undefined })).not.toThrow();
  });

  it("registers all 6 public tools (TOOLS-PUB-07)", async () => {
    const tools = await listToolsViaInMemory(undefined);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOLS);
  });

  it("wires descriptions from TOOL_DESCRIPTIONS verbatim", async () => {
    const tools = await listToolsViaInMemory(undefined);
    for (const t of tools) {
      expect(t.description).toBe(
        (TOOL_DESCRIPTIONS as Record<string, string>)[t.name],
      );
    }
  });

  it("still registers the same 6 tools with an API key set", async () => {
    const tools = await listToolsViaInMemory("hw_test_FAKEKEY");
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);
  });

  it("no tool description leaks a key-shaped substring (T-4-01)", async () => {
    const tools = await listToolsViaInMemory("hw_test_FAKEKEY");
    for (const t of tools) {
      expect(t.description ?? "").not.toMatch(/hw_(live|test)_[a-zA-Z0-9]+/);
    }
  });

  it("check_health reports authenticated.configured per apiKey wiring (Test 6)", async () => {
    mockServer.use(
      http.get(
        "https://api.hertwill.com/health",
        () => new HttpResponse("OK", { status: 200 }),
      ),
    );
    // With key
    {
      const server = createServer({ apiKey: "hw_test_FAKEKEY" });
      const [c, s] = InMemoryTransport.createLinkedPair();
      await server.connect(s);
      const client = new Client({ name: "t", version: "0" });
      await client.connect(c);
      const result = await client.callTool({
        name: "check_health",
        arguments: {},
      });
      const sc = result.structuredContent as {
        rate_limits: { authenticated: { configured: boolean } };
      };
      expect(sc.rate_limits.authenticated.configured).toBe(true);
      await client.close();
      await server.close();
    }
    // Without key
    {
      const server = createServer({ apiKey: undefined });
      const [c, s] = InMemoryTransport.createLinkedPair();
      await server.connect(s);
      const client = new Client({ name: "t", version: "0" });
      await client.connect(c);
      const result = await client.callTool({
        name: "check_health",
        arguments: {},
      });
      const sc = result.structuredContent as {
        rate_limits: { authenticated: { configured: boolean } };
      };
      expect(sc.rate_limits.authenticated.configured).toBe(false);
      await client.close();
      await server.close();
    }
  });
});
