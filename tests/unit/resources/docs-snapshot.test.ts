import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";

function hash(path: string): string {
  const buf = readFileSync(new URL(path, import.meta.url));
  return createHash("sha256").update(buf).digest("hex");
}

describe("docs/resources/*.md content snapshots (D-27 drift gate)", () => {
  it("rate-limits.md content is locked", () => {
    expect(hash("../../../docs/resources/rate-limits.md")).toMatchSnapshot();
  });

  it("eu-shipping.md content is locked", () => {
    expect(hash("../../../docs/resources/eu-shipping.md")).toMatchSnapshot();
  });
});
