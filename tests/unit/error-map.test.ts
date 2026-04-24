import { describe, expect, it } from "vitest";
import { HertwillApiError } from "../../src/errors/api-error.js";
import { HertwillSchemaMismatchError } from "../../src/errors/schema-error.js";
import { mapHertwillError } from "../../src/errors/map.js";

describe("mapHertwillError", () => {
  it("with HertwillApiError(429) returns isError:true with rate limit hint", () => {
    const err = new HertwillApiError(429, "RATE_LIMITED", "Too many requests");
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.toLowerCase()).toContain("rate limit");
  });

  it("with HertwillApiError(502) returns isError:true with server error hint", () => {
    const err = new HertwillApiError(502, "BAD_GATEWAY", "Bad gateway");
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain("server error");
  });

  it("with HertwillApiError(401) returns isError:true with API key hint and HERTWILL_API_KEY", () => {
    const err = new HertwillApiError(401, "UNAUTHORIZED", "Invalid key");
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HERTWILL_API_KEY");
  });

  it("with HertwillApiError(404) returns isError:true with not found hint", () => {
    const err = new HertwillApiError(404, "NOT_FOUND", "Not found");
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain("not found");
  });

  it("with HertwillSchemaMismatchError returns isError:true with upgrade hint", () => {
    const err = new HertwillSchemaMismatchError("/v1/products", "price", []);
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("upgrade");
    expect(result.content[0].text).toContain("price");
  });

  it("with generic Error returns isError:true with generic message", () => {
    const err = new Error("Something broke");
    const result = mapHertwillError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unexpected error");
  });

  it("output NEVER contains hw_live_ or hw_test_ substring (regression gate)", () => {
    const errors = [
      new HertwillApiError(401, "UNAUTHORIZED", "Key hw_live_abc123 is invalid"),
      new HertwillApiError(429, "RATE_LIMITED", "Too many requests"),
      new HertwillSchemaMismatchError("/v1/products", "price", []),
      new Error("Something broke"),
    ];

    for (const err of errors) {
      const result = mapHertwillError(err);
      const text = JSON.stringify(result);
      expect(text).not.toContain("hw_live_");
      expect(text).not.toContain("hw_test_");
    }
  });
});
