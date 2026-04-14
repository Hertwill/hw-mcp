import { expect } from "vitest";

/**
 * Structural shape of a well-formed MCP tool success response (D-11 contract):
 * both a typed structuredContent payload AND a human/agent-readable text
 * summary, with no isError flag.
 */
export interface StructuredAndTextResult {
  structuredContent: Record<string, unknown>;
  content: Array<{ type: "text"; text: string }>;
  isError?: undefined | false;
}

/**
 * Assert that a tool response honours the D-11 dual-shape contract. On
 * success, narrows `result` to `StructuredAndTextResult`.
 */
export function expectStructuredAndText(
  result: unknown,
): asserts result is StructuredAndTextResult {
  expect(result).toBeTypeOf("object");
  const r = result as {
    isError?: unknown;
    structuredContent?: unknown;
    content?: unknown;
  };
  expect(r.isError).not.toBe(true);
  expect(r.structuredContent).toBeDefined();
  expect(Array.isArray(r.content)).toBe(true);
  const content = r.content as Array<{ type?: unknown; text?: unknown }>;
  expect(content[0]?.type).toBe("text");
  expect(typeof content[0]?.text).toBe("string");
  expect((content[0]?.text as string).length).toBeGreaterThan(0);
}

/**
 * Assert that a tool response is an MCP error envelope (isError:true, no
 * structuredContent) whose text matches the supplied regex and contains no
 * API-key fragments (key-leakage regression guard).
 */
export function expectToolError(result: unknown, textMatcher: RegExp): void {
  const r = result as {
    isError?: unknown;
    structuredContent?: unknown;
    content?: Array<{ type?: unknown; text?: unknown }>;
  };
  expect(r.isError).toBe(true);
  expect(r.structuredContent).toBeUndefined();
  const text = r.content?.[0]?.text;
  expect(typeof text).toBe("string");
  expect(text as string).toMatch(textMatcher);
  expect(text as string).not.toMatch(/hw_(live|test)_[a-zA-Z0-9]+/);
}
