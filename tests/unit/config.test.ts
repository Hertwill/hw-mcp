import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config with optional hertwillApiKey when key is not set", () => {
    delete process.env.HERTWILL_API_KEY;
    const config = loadConfig();
    expect(config.hertwillApiKey).toBeUndefined();
  });

  it("returns config with hertwillApiKey when key is set", () => {
    process.env.HERTWILL_API_KEY = "hw_test_abc123";
    const config = loadConfig();
    expect(config.hertwillApiKey).toBe("hw_test_abc123");
  });

  it("defaults logLevel to info when not set", () => {
    delete process.env.HERTWILL_MCP_LOG_LEVEL;
    const config = loadConfig();
    expect(config.logLevel).toBe("info");
  });

  it("accepts valid logLevel values", () => {
    process.env.HERTWILL_MCP_LOG_LEVEL = "debug";
    expect(loadConfig().logLevel).toBe("debug");

    process.env.HERTWILL_MCP_LOG_LEVEL = "warn";
    expect(loadConfig().logLevel).toBe("warn");

    process.env.HERTWILL_MCP_LOG_LEVEL = "error";
    expect(loadConfig().logLevel).toBe("error");
  });

  it("throws on invalid logLevel", () => {
    process.env.HERTWILL_MCP_LOG_LEVEL = "verbose";
    expect(() => loadConfig()).toThrow();
  });
});
