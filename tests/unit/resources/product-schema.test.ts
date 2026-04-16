import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("RES-03: product-schema resource handler", () => {
  let registerProductSchema: typeof import("../../../src/resources/product-schema.js").registerProductSchema;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../src/resources/product-schema.js");
    registerProductSchema = mod.registerProductSchema;
  });

  it("registers with correct URI and mimeType", () => {
    const registerResource = vi.fn();
    const server = { registerResource } as never;
    const deps = {} as never;

    registerProductSchema(server, deps);

    expect(registerResource).toHaveBeenCalledOnce();
    const [name, uri, metadata] = registerResource.mock.calls[0];
    expect(name).toBe("product-schema");
    expect(uri).toBe("hertwill://schemas/product");
    expect(metadata.mimeType).toBe("application/json");
  });

  it("read callback returns byte-identical content to committed file", async () => {
    const registerResource = vi.fn();
    const server = { registerResource } as never;
    const deps = {} as never;

    registerProductSchema(server, deps);

    const readCallback = registerResource.mock.calls[0][3];
    const result = await readCallback(new URL("hertwill://schemas/product"));

    const committedContent = readFileSync(
      new URL("../../../docs/resources/product.schema.json", import.meta.url),
      "utf8",
    );

    expect(result.contents[0].text).toBe(committedContent);
    expect(result.contents[0].mimeType).toBe("application/json");
  });

  it("returned JSON parses to an object schema with required product fields", async () => {
    const registerResource = vi.fn();
    const server = { registerResource } as never;
    const deps = {} as never;

    registerProductSchema(server, deps);

    const readCallback = registerResource.mock.calls[0][3];
    const result = await readCallback(new URL("hertwill://schemas/product"));
    const schema = JSON.parse(result.contents[0].text as string);

    expect(schema.type).toBe("object");
    const requiredFields = [
      "id", "slug", "name", "description", "sku",
      "price", "stock", "ships_to", "category", "variations",
    ];
    for (const field of requiredFields) {
      expect(schema.properties).toHaveProperty(field);
    }
  });

  it("returns same content on repeated reads (module-level cache)", async () => {
    const registerResource = vi.fn();
    const server = { registerResource } as never;
    const deps = {} as never;

    registerProductSchema(server, deps);

    const readCallback = registerResource.mock.calls[0][3];
    const r1 = await readCallback(new URL("hertwill://schemas/product"));
    const r2 = await readCallback(new URL("hertwill://schemas/product"));

    expect(r1.contents[0].text).toBe(r2.contents[0].text);
  });
});
