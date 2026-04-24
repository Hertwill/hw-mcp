import { execSync } from "node:child_process";

const BANNED_PREFIXES = ["package/src/", "package/.planning/", "package/node_modules/", "package/tests/", "package/vendor/", "package/scripts/"];

const output = execSync("npm pack --dry-run 2>&1", { encoding: "utf-8" });
const lines = output.split("\n");

const errors = [];
for (const line of lines) {
  for (const banned of BANNED_PREFIXES) {
    if (line.includes(banned)) {
      errors.push(`Tarball contains banned path: ${banned} (line: ${line.trim()})`);
    }
  }
}

if (errors.length > 0) {
  console.error("ERROR: npm pack validation failed:");
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log("Tarball contents validated — no banned paths found.");
