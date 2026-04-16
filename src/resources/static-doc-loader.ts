import { readFileSync } from "node:fs";

/**
 * Resolve a markdown doc across dev (tsx src/index.ts -- source tree) and prod
 * (node dist/index.js -- bundled, docs copied into dist/docs/resources/) layouts.
 *
 * dev:  src/resources/static-doc-loader.ts -> ../../docs/resources/<name>
 * prod: dist/index.js                      -> ./docs/resources/<name>
 *
 * Throws at import time if the file is missing in both candidates so that
 * misconfiguration surfaces immediately at startup, not per-read.
 */
export function loadStaticDoc(relName: string): string {
  const candidates = [
    new URL(`../../docs/resources/${relName}`, import.meta.url),
    new URL(`./docs/resources/${relName}`, import.meta.url),
  ];
  for (const url of candidates) {
    try {
      return readFileSync(url, "utf8");
    } catch {
      // try next
    }
  }
  throw new Error(
    `Static doc not found: ${relName} (looked in both dev and prod layouts). Ensure tsup copied docs/resources/ into dist/.`,
  );
}
