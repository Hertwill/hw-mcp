import { describe, expect, it } from "vitest";
import { HertwillApiError } from "../../src/errors/api-error.js";
import { HertwillSchemaMismatchError } from "../../src/errors/schema-error.js";

describe("HertwillApiError", () => {
  it("toJSON() returns exactly {status, code, message} with no other keys", () => {
    const err = new HertwillApiError(404, "NOT_FOUND", "Resource not found", "corr-123");
    const json = err.toJSON();
    expect(json).toEqual({ status: 404, code: "NOT_FOUND", message: "Resource not found" });
    expect(Object.keys(json)).toEqual(["status", "code", "message"]);
  });

  it("toString() returns formatted string with status, code, and message", () => {
    const err = new HertwillApiError(404, "NOT_FOUND", "Resource not found");
    expect(err.toString()).toBe("HertwillApiError [404] NOT_FOUND: Resource not found");
  });

  it("serialized via JSON.stringify contains no Authorization substring", () => {
    const err = new HertwillApiError(401, "UNAUTHORIZED", "Invalid API key");
    const serialized = JSON.stringify(err);
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("Bearer");
  });

  it("serialized via JSON.stringify contains no hw_live_ or hw_test_ substring", () => {
    const err = new HertwillApiError(401, "UNAUTHORIZED", "Invalid API key");
    const serialized = JSON.stringify(err);
    expect(serialized).not.toContain("hw_live_");
    expect(serialized).not.toContain("hw_test_");
  });

  it("fromResponse() extracts status, code, message, and correlationId", () => {
    const headers = new Headers({ "x-correlation-id": "req-abc-123" });
    const response = new Response(null, { status: 422, headers });
    const errorBody = {
      error: { code: "VALIDATION_ERROR", message: "The product_id field is required." },
    };

    const err = HertwillApiError.fromResponse(response, errorBody);
    expect(err.status).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("The product_id field is required.");
    expect(err.correlationId).toBe("req-abc-123");
  });

  it("correlationId is accessible as property but NOT included in toJSON()", () => {
    const err = new HertwillApiError(500, "INTERNAL", "Server error", "corr-xyz");
    expect(err.correlationId).toBe("corr-xyz");
    const json = err.toJSON();
    expect(json).not.toHaveProperty("correlationId");
  });
});

describe("HertwillSchemaMismatchError", () => {
  it("message names the drifted field(s)", () => {
    const err = new HertwillSchemaMismatchError("/v1/products", "price, stock_status", []);
    expect(err.message).toContain("price, stock_status");
    expect(err.message).toContain("/v1/products");
  });

  it("message contains upgrade @hertwill/mcp", () => {
    const err = new HertwillSchemaMismatchError("/v1/products", "price", []);
    expect(err.message).toContain("upgrade @hertwill/mcp");
  });
});
