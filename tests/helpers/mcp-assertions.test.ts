import { describe, expect, it } from "vitest";
import {
  expectStructuredAndText,
  expectToolError,
} from "./mcp-assertions.js";

describe("expectStructuredAndText", () => {
  it("passes when both structuredContent and non-empty text content are present", () => {
    const good = {
      structuredContent: { x: 1 },
      content: [{ type: "text" as const, text: "hi" }],
    };
    expect(() => expectStructuredAndText(good)).not.toThrow();
  });

  it("throws when content[0].text is missing / empty", () => {
    const bad = {
      structuredContent: { x: 1 },
      content: [] as Array<{ type: "text"; text: string }>,
    };
    expect(() => expectStructuredAndText(bad)).toThrow();
  });

  it("throws when structuredContent is absent", () => {
    const bad = {
      content: [{ type: "text" as const, text: "only text" }],
    };
    expect(() => expectStructuredAndText(bad)).toThrow();
  });
});

describe("expectToolError", () => {
  it("passes when isError:true and text matches the regex", () => {
    const err = {
      isError: true as const,
      content: [
        { type: "text" as const, text: "Rate limit exceeded. Retry after 5s." },
      ],
    };
    expect(() => expectToolError(err, /Retry after 5s/)).not.toThrow();
  });

  it("throws when text does not match the regex", () => {
    const err = {
      isError: true as const,
      content: [
        { type: "text" as const, text: "Rate limit exceeded. Retry after 5s." },
      ],
    };
    expect(() => expectToolError(err, /wrong/)).toThrow();
  });

  it("throws when the text would leak an hw_live_ / hw_test_ key fragment", () => {
    const leaky = {
      isError: true as const,
      content: [
        {
          type: "text" as const,
          text: "Bad key hw_live_abc123def456 used",
        },
      ],
    };
    expect(() => expectToolError(leaky, /Bad key/)).toThrow();
  });
});
