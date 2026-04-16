import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_NAMES } from "../../src/schemas/descriptions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillPath = join(__dirname, "../../skill/SKILL.md");
const packageJsonPath = join(__dirname, "../../package.json");

const skillContent = readFileSync(skillPath, "utf-8");

/**
 * Non-tool identifiers that legitimately appear in backticks within
 * SKILL.md. These are field names / enum values, not MCP tool names.
 */
const NON_TOOL_IDENTIFIERS = new Set([
  "stock_level",
  "stock_checked_at",
  "ships_to",
  "out_of_stock",
  "in_stock",
  "untrusted_supplier_content",
  "import_list_size",
]);

/**
 * Extract all backtick-wrapped identifiers that contain at least one
 * underscore (matching the shape of tool names like `search_products`).
 */
function extractToolNameCandidates(content: string): Set<string> {
  const toolNamePattern = /`([a-z]+(?:_[a-z]+)+)`/g;
  const candidates = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = toolNamePattern.exec(content)) !== null) {
    const name = match[1];
    if (!NON_TOOL_IDENTIFIERS.has(name)) {
      candidates.add(name);
    }
  }
  return candidates;
}

describe("Skill tool-name drift gate (SKILL-07)", () => {
  const referencedTools = extractToolNameCandidates(skillContent);

  it("every backtick-wrapped tool reference in SKILL.md exists in TOOL_NAMES", () => {
    for (const toolName of referencedTools) {
      expect(
        (TOOL_NAMES as readonly string[]).includes(toolName),
        `Skill references unknown tool: ${toolName}`,
      ).toBe(true);
    }
  });

  it("SKILL.md references at least 5 distinct tool names", () => {
    expect(referencedTools.size).toBeGreaterThanOrEqual(5);
  });
});

describe("Skill version-pin gate (SKILL-08)", () => {
  const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);

  it("SKILL.md has YAML frontmatter", () => {
    expect(frontmatterMatch).not.toBeNull();
  });

  it("frontmatter contains 'name' field equal to 'hertwill-sourcing'", () => {
    const nameMatch = frontmatterMatch![1].match(/^name:\s*(.+)$/m);
    expect(nameMatch).not.toBeNull();
    expect(nameMatch![1].trim()).toBe("hertwill-sourcing");
  });

  it("frontmatter contains a non-empty 'description' field", () => {
    const descriptionMatch = frontmatterMatch![1].match(/^description:/m);
    expect(descriptionMatch).not.toBeNull();
  });

  it("frontmatter contains 'version' field", () => {
    const versionMatch = frontmatterMatch![1].match(
      /^version:\s*"?(.+?)"?\s*$/m,
    );
    expect(versionMatch).not.toBeNull();
  });

  it("SKILL.md version matches package.json version", () => {
    const versionMatch = frontmatterMatch![1].match(
      /^version:\s*"?(.+?)"?\s*$/m,
    );
    const skillVersion = versionMatch![1];

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version: string;
    };

    expect(skillVersion).toBe(packageJson.version);
  });
});
