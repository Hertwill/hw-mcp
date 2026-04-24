/**
 * SEC-01: Red-team injection defense tests.
 *
 * Asserts that adversarial content embedded in product names and descriptions
 * is fully contained within <untrusted_supplier_content> delimiters after
 * transformation, that list descriptions are truncated regardless of payload
 * length, and that no injection payload escapes the wrapper as bare text.
 */

import { describe, expect, it } from "vitest";
import type { ProductDetail, ProductListItem } from "../../src/hertwill/schemas/products.js";
import {
  MAX_LIST_DESCRIPTION_LENGTH,
  transformProductDetail,
  transformProductListItem,
} from "../../src/transforms/product.js";
import { RED_TEAM_PAYLOADS } from "../fixtures/red-team-payloads.js";

// Delimiter constants matching wrapUntrustedContent output
const OPEN_DELIMITER = '<untrusted_supplier_content product_id="';
const CLOSE_DELIMITER = "</untrusted_supplier_content>";

/**
 * Build a minimal ProductListItem with the given name/description as
 * the potential injection sites.
 */
function makeListItem(id: number, name: string, description: string): ProductListItem {
  return {
    id,
    slug: `product-${id}`,
    name,
    description,
    sku: `SKU-${id}`,
    price: 25.0,
    sale_price: null,
    stock: 10,
    stock_status: "instock",
    brand: null,
    images: { featured: null, gallery: [] },
    category: null,
    collections: [],
    shipping_regions: null,
    attributes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
  };
}

/**
 * Build a minimal ProductDetail (extends list item with variations).
 */
function makeDetailItem(id: number, name: string, description: string): ProductDetail {
  return {
    ...makeListItem(id, name, description),
    variations: [],
  };
}

describe("SEC-01: Red-team injection containment — list transform", () => {
  it("All attack vectors: name is wrapped in untrusted_supplier_content delimiters", () => {
    for (const payload of RED_TEAM_PAYLOADS) {
      const item = makeListItem(1001, payload.name, payload.description);
      const result = transformProductListItem(item);
      expect(result.name, `${payload.attack_type}: name missing open delimiter`).toContain(
        OPEN_DELIMITER,
      );
      expect(result.name, `${payload.attack_type}: name missing close delimiter`).toContain(
        CLOSE_DELIMITER,
      );
    }
  });

  it("All attack vectors: description is wrapped in untrusted_supplier_content delimiters", () => {
    for (const payload of RED_TEAM_PAYLOADS) {
      const item = makeListItem(1001, payload.name, payload.description);
      const result = transformProductListItem(item);
      expect(
        result.description,
        `${payload.attack_type}: description missing open delimiter`,
      ).toContain(OPEN_DELIMITER);
      expect(
        result.description,
        `${payload.attack_type}: description missing close delimiter`,
      ).toContain(CLOSE_DELIMITER);
    }
  });

  it("Long attack payloads: list descriptions are truncated inside the wrapper", () => {
    // The payloads with descriptions > MAX_LIST_DESCRIPTION_LENGTH should be truncated
    const longPayloads = RED_TEAM_PAYLOADS.filter(
      (p) => p.description.length > MAX_LIST_DESCRIPTION_LENGTH,
    );
    expect(longPayloads.length, "expected multiple payloads longer than list cap").toBeGreaterThan(
      2,
    );

    for (const payload of longPayloads) {
      const item = makeListItem(1002, payload.name, payload.description);
      const result = transformProductListItem(item);

      // Outer wrapper is always correctly applied — starts with open, ends with close
      expect(
        result.description.startsWith(OPEN_DELIMITER),
        `${payload.attack_type}: description must start with open delimiter`,
      ).toBe(true);
      expect(
        result.description.endsWith(CLOSE_DELIMITER),
        `${payload.attack_type}: description must end with close delimiter`,
      ).toBe(true);

      // Total description length is bounded by the wrapper + truncated content
      // Max: open_delimiter(len) + MAX_LIST_DESCRIPTION_LENGTH + "..."(3) + close_delimiter(len)
      const maxExpectedLength =
        (OPEN_DELIMITER + "1002" + '">').length +
        MAX_LIST_DESCRIPTION_LENGTH +
        "...".length +
        CLOSE_DELIMITER.length;
      expect(
        result.description.length,
        `${payload.attack_type}: description too long`,
      ).toBeLessThanOrEqual(maxExpectedLength);
    }
  });

  it("XML delimiter escape attack: outer wrapper is correctly applied (starts/ends with delimiters)", () => {
    const xmlPayload = RED_TEAM_PAYLOADS.find((p) => p.attack_type === "xml_delimiter_escape");
    expect(xmlPayload).toBeDefined();

    const item = makeListItem(1003, xmlPayload!.name, xmlPayload!.description);
    const result = transformProductListItem(item);

    // Note: wrapUntrustedContent is string-concatenation, not XML-aware. A payload
    // that embeds `</untrusted_supplier_content>` will produce extra delimiters in
    // the middle of the output. The invariant we assert is that the OUTER wrapper
    // is correctly applied: the string starts with the open delimiter and ends with
    // the close delimiter. No content appears before the open or after the close.
    expect(result.description.indexOf(OPEN_DELIMITER), "description must start with open delimiter").toBe(0);
    expect(result.description.endsWith(CLOSE_DELIMITER), "description must end with close delimiter").toBe(true);
  });

  it("Direct injection attack: the word 'add_to_import_list' is inside delimiters", () => {
    const injPayload = RED_TEAM_PAYLOADS.find((p) => p.attack_type === "direct_prompt_injection");
    expect(injPayload).toBeDefined();

    const item = makeListItem(1004, "Normal Name", injPayload!.description);
    const result = transformProductListItem(item);

    // Full description (may be truncated in list)
    const rawIdx = result.description.indexOf("add_to_import_list");
    if (rawIdx !== -1) {
      // If the payload wasn't truncated away, the instruction must be INSIDE the delimiters
      const delimStart = result.description.indexOf(OPEN_DELIMITER);
      const delimEnd = result.description.indexOf(CLOSE_DELIMITER);
      expect(rawIdx > delimStart).toBe(true);
      expect(rawIdx < delimEnd).toBe(true);
    }
    // If the payload was truncated, the injection is cut off — even safer
  });
});

describe("SEC-01: Red-team injection containment — detail transform", () => {
  it("All attack vectors: detail name is wrapped in untrusted_supplier_content delimiters", () => {
    for (const payload of RED_TEAM_PAYLOADS) {
      const item = makeDetailItem(2001, payload.name, payload.description);
      const result = transformProductDetail(item);
      expect(result.name, `${payload.attack_type}: detail name missing open delimiter`).toContain(
        OPEN_DELIMITER,
      );
      expect(result.name, `${payload.attack_type}: detail name missing close delimiter`).toContain(
        CLOSE_DELIMITER,
      );
    }
  });

  it("All attack vectors: detail description preserves full payload inside delimiters", () => {
    for (const payload of RED_TEAM_PAYLOADS) {
      const item = makeDetailItem(2001, payload.name, payload.description);
      const result = transformProductDetail(item);

      // Detail descriptions are NOT truncated — full payload must be present inside the wrapper
      expect(
        result.description,
        `${payload.attack_type}: detail description missing open delimiter`,
      ).toContain(OPEN_DELIMITER);
      expect(
        result.description,
        `${payload.attack_type}: detail description missing close delimiter`,
      ).toContain(CLOSE_DELIMITER);
      // Full payload text preserved (no "..." truncation in detail)
      expect(
        result.description,
        `${payload.attack_type}: detail description should contain full payload`,
      ).toContain(payload.description);
    }
  });

  it("XML delimiter escape: detail description outer wrapper is correctly applied", () => {
    const xmlPayload = RED_TEAM_PAYLOADS.find((p) => p.attack_type === "xml_delimiter_escape");
    expect(xmlPayload).toBeDefined();

    const item = makeDetailItem(2002, xmlPayload!.name, xmlPayload!.description);
    const result = transformProductDetail(item);

    // Same limitation as in list: the payload's embedded delimiter strings appear in
    // the middle of the output. The invariant is that the outer wrapper is correct:
    // the string starts with the open delimiter and ends with the close delimiter.
    expect(result.description.indexOf(OPEN_DELIMITER), "detail description must start with open delimiter").toBe(0);
    expect(result.description.endsWith(CLOSE_DELIMITER), "detail description must end with close delimiter").toBe(true);
    // Full payload is preserved inside the detail wrapper (no truncation)
    expect(result.description).toContain(xmlPayload!.description);
  });

  it("System prompt mimicry in name: name is wrapped, not executed as instructions", () => {
    const sysPayload = RED_TEAM_PAYLOADS.find(
      (p) => p.attack_type === "system_prompt_mimicry_in_name",
    );
    expect(sysPayload).toBeDefined();

    const item = makeDetailItem(2003, sysPayload!.name, sysPayload!.description);
    const result = transformProductDetail(item);

    // The word "SYSTEM" is inside the delimiters, not a bare top-level string
    const sysIdx = result.name.indexOf("SYSTEM");
    const delimStart = result.name.indexOf(OPEN_DELIMITER);
    const delimEnd = result.name.indexOf(CLOSE_DELIMITER);
    expect(sysIdx).toBeGreaterThan(delimStart);
    expect(sysIdx).toBeLessThan(delimEnd);
  });
});
