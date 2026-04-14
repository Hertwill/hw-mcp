import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_DESCRIPTIONS, TOOL_NAMES } from "../../src/schemas/descriptions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsMdPath = join(__dirname, "../../docs/TOOLS.md");
const fixturesDir = join(__dirname, "../fixtures/tool-descriptions");

describe("Tool descriptions (golden-file snapshots)", () => {
  for (const toolName of TOOL_NAMES) {
    it(`${toolName} matches golden file`, async () => {
      const description = TOOL_DESCRIPTIONS[toolName];
      await expect(description.trim()).toMatchFileSnapshot(
        join(fixturesDir, `${toolName}.snap.txt`),
      );
    });
  }
});

describe("TOOL_DESCRIPTIONS completeness", () => {
  it("has exactly 12 entries", () => {
    expect(Object.keys(TOOL_DESCRIPTIONS)).toHaveLength(12);
  });

  it("matches TOOL_NAMES (no orphans, no missing)", () => {
    expect(Object.keys(TOOL_DESCRIPTIONS).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it("every description contains a sibling tool name (disambiguation)", () => {
    for (const toolName of TOOL_NAMES) {
      const description = TOOL_DESCRIPTIONS[toolName];
      const siblings = TOOL_NAMES.filter((n) => n !== toolName);
      const referenced = siblings.some((s) => description.includes(s));
      expect(
        referenced,
        `${toolName} description does not reference any sibling tool by name`,
      ).toBe(true);
    }
  });

  it("add_to_import_list description carries the batch-50 guidance", () => {
    const description = TOOL_DESCRIPTIONS.add_to_import_list;
    expect(description).toContain("50 product IDs");
    expect(description).toContain("Do NOT call");
  });
});

describe("docs/TOOLS.md sync (D-04)", () => {
  const toolsMd = readFileSync(toolsMdPath, "utf-8");
  const headings = [...toolsMd.matchAll(/^## (\w+)$/gm)].map((m) => m[1] as string);

  it("every TOOL_DESCRIPTIONS entry has a ## heading in docs/TOOLS.md", () => {
    for (const toolName of Object.keys(TOOL_DESCRIPTIONS)) {
      expect(headings, `missing ## ${toolName} in docs/TOOLS.md`).toContain(toolName);
    }
  });

  it("every ## tool heading in docs/TOOLS.md has a TOOL_DESCRIPTIONS entry", () => {
    const toolHeadings = headings.filter((h) =>
      (TOOL_NAMES as readonly string[]).includes(h),
    );
    for (const heading of toolHeadings) {
      expect(
        TOOL_DESCRIPTIONS,
        `orphan ## ${heading} heading in docs/TOOLS.md`,
      ).toHaveProperty(heading);
    }
    // Also make sure the file contains exactly 12 tool headings.
    expect(toolHeadings).toHaveLength(12);
  });

  it("every tool section contains DO NOT USE WHEN", () => {
    for (const toolName of TOOL_NAMES) {
      const sectionRegex = new RegExp(
        `## ${toolName}\\b[\\s\\S]*?(?=\\n## \\w|$)`,
      );
      const section = toolsMd.match(sectionRegex)?.[0];
      expect(section, `missing section for ${toolName}`).toBeDefined();
      expect(section, `${toolName} missing DO NOT USE WHEN`).toContain(
        "DO NOT USE WHEN",
      );
    }
  });

  it("every DO NOT USE WHEN clause references at least one sibling tool", () => {
    for (const toolName of TOOL_NAMES) {
      const sectionRegex = new RegExp(
        `## ${toolName}\\b[\\s\\S]*?(?=\\n## \\w|$)`,
      );
      const section = toolsMd.match(sectionRegex)?.[0] ?? "";
      const dontUseMatch =
        section.match(/DO NOT USE WHEN[\s\S]*?(?=\*\*PREFER|\*\*AUTH|$)/)?.[0] ?? "";
      const siblings = TOOL_NAMES.filter((n) => n !== toolName);
      const referencedSibling = siblings.some((s) => dontUseMatch.includes(s));
      expect(
        referencedSibling,
        `${toolName} DO NOT USE WHEN does not reference any sibling`,
      ).toBe(true);
    }
  });
});
