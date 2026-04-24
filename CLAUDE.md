<!-- GSD:project-start source:PROJECT.md -->
## Project

**Hertwill MCP**

A public Model Context Protocol (MCP) server that wraps the Hertwill dropshipping API, plus a bundled Claude Skill encoding the Hertwill sourcing playbook. It lets any MCP-capable AI agent (Claude Desktop, Cursor, Cline, Continue, Windsurf, Zed, VS Code + Copilot, Goose, OpenCode, Replit) discover Hertwill products, manage an import list, and trigger syncs to Shopify/WooCommerce — turning product sourcing for dropshippers from a multi-step manual workflow into a conversational one.

**Core Value:** **Make sourcing Hertwill products as simple as a single natural-language request from any AI agent.** Every scope decision should reduce the friction between "I need winning EU-shippable products under €30" and "they're in my Shopify import list."

### Constraints

- **Tech stack**: TypeScript + `@modelcontextprotocol/sdk` (official TS SDK) — biggest community, smallest install footprint, fastest ecosystem updates
- **Transport**: stdio only for v1 — zero infra cost, no uptime burden on Hertwill
- **Distribution**: npm (public) + GitHub (public repo) — required for directory listings
- **Auth model**: env var (`HERTWILL_API_KEY`) for authenticated endpoints — matches stdio convention, no OAuth infra required
- **Rate limits**: 60 req/min public, 300 req/min authenticated — client must throttle and return structured errors when limits hit
- **API compatibility**: must stay in sync with Hertwill API changes — versioning strategy needed so the MCP can deprecate tools gracefully
- **Security**: never log or persist API keys; never ship a default key in the package
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Recommendation
- `@modelcontextprotocol/sdk@^1.29` with the high-level `McpServer` + `registerTool` API over `StdioServerTransport`
- `zod@^4.3` for tool input schemas, leveraging the SDK's built-in Zod-v4 → JSON Schema bridge (no `zod-to-json-schema` needed)
- Native `fetch` (Node 20+ built-in, undici under the hood) wrapped in a thin client — no `axios`, no `ky`, no `ofetch`
- `openapi-typescript@^7.13` to generate types from Hertwill's OpenAPI 3.1 spec, consumed via `openapi-fetch@^0.17` for a 6 KB fully-typed client
- `bottleneck@^2.19` for rate limiting (60/min public, 300/min authenticated) + `p-retry@^6.2` for exponential backoff
- `pino@^10.3` piped to `pino.destination(2)` (stderr) — stdout is reserved for JSON-RPC
- `tsup@^8.5` for ESM-only build with shebang-injected `bin` entry
- `vitest@^4.1` for unit/integration tests, `@modelcontextprotocol/inspector@^0.21` for interactive debugging
- Claude Skill bundled as `skills/hertwill-sourcing/SKILL.md` in the same repo, distributed via the same npm package plus a separate "plugin" artifact for Claude Code users
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| **Node.js** | `>=20.11` (LTS) | Runtime | Node 20 ships native `fetch`/`undici`/`WebStreams`/`structuredClone`. Minimum supported by `@modelcontextprotocol/sdk`. Node 18 is EOL April 2025 — avoid. |
| **TypeScript** | `^5.7` | Language | `NodeNext` module resolution, `--erasableSyntaxOnly` for cleaner ESM output, stable `satisfies` and `const` type params. 5.7 is the current stable line as of Q2 2026. |
| **`@modelcontextprotocol/sdk`** | `^1.29.0` | MCP protocol implementation | Official Anthropic TS SDK, published 2026-03-30. Exposes high-level `McpServer` + `registerTool` API, `StdioServerTransport`, Standard Schema validation (Zod v4, Valibot, ArkType all work). Internally imports `zod/v4` but keeps backcompat with Zod v3.25+. **Do not pin to `~1.17` — that line was broken for Zod v4.** |
| **`zod`** | `^4.3.6` | Input/output schema validation | Zod v4 is faster, smaller, and ships `z.toJSONSchema()` natively. The MCP SDK uses Zod's Standard Schema contract to derive tool `inputSchema` JSON Schemas automatically — you write Zod, the SDK ships JSON Schema to the client. |
| **`tsup`** | `^8.5.1` | Bundler | Zero-config esbuild wrapper. Handles shebang injection, `.d.ts` emission, `--format esm`, and treeshaking. Produces a single `dist/index.js` ~200 KB including the SDK, which is what `npx` users download. Faster than `tsc` + `rollup`, simpler than `unbuild`. |
| **Package manager** | `pnpm@^9` or `npm@^10` | Install/publish | pnpm preferred for dev (strict `node_modules`, faster CI). `npm publish` for registry — no Yarn Berry lockfile quirks. |
### HTTP Client
| Library | Version | Purpose | Why |
|---|---|---|---|
| **Native `fetch`** | Node 20+ built-in | HTTP calls to Hertwill API | Zero-dependency, zero install-size cost. Node 20 ships a real WHATWG `fetch` backed by `undici`. For a CLI that users run via `npx`, every KB in the install tarball matters. `fetch` covers 100% of what we need (GET/POST, Bearer headers, JSON body, abort signal, timeout via `AbortSignal.timeout()`). |
| **`openapi-fetch`** | `^0.17.0` | Typed wrapper around `fetch` | ~6 KB runtime. Consumes the `openapi-typescript`-generated `paths` type and gives us end-to-end type safety on path params, query params, request bodies, and response shapes with zero codegen at the client layer (types only). Pairs perfectly with `openapi-typescript`. |
### Schema & API Type Generation
| Library | Version | Purpose | Why |
|---|---|---|---|
| **`openapi-typescript`** | `^7.13.0` | OpenAPI 3.1 → TS types | Hertwill publishes its docs at `https://hertwill.com/docs` as an OpenAPI 3.1.0 spec rendered via Scalar. We fetch the raw spec, commit a `vendor/hertwill.openapi.json` snapshot, and run `openapi-typescript` in a `prebuild` step to regenerate `src/generated/hertwill.d.ts`. Types-only output → zero runtime cost. |
| **`zod` (v4)** | `^4.3.6` | Runtime validation at MCP boundary | OpenAPI types validate the compile-time API shape, but MCP tool inputs come from an LLM — **must** be runtime-validated. Each tool gets a hand-written `z.object({...})` that mirrors the subset of Hertwill fields we expose. |
### Rate Limiting & Resilience
| Library | Version | Purpose | Why |
|---|---|---|---|
| **`bottleneck`** | `^2.19.5` | Client-side throttling | Battle-tested (used by Octokit). Supports weighted jobs, reservoir refills, priorities. Two limiters: one at 60 req/min for unauthenticated calls, one at 300 req/min for authenticated. Key by API key so multi-user scenarios (a future remote server) compose cleanly. |
| **`p-retry`** | `^6.2.0` | Exponential backoff on transient failures | Sindre Sorhus library, ESM-only, 2 KB. Wraps an async fn with retry + jitter. We retry on 429/502/503/504 and network errors, surface 4xx (except 429) as tool errors immediately. |
### Logging
| Library | Version | Purpose | Why |
|---|---|---|---|
| **`pino`** | `^10.3.1` | Structured stderr logger | Must log to **stderr only** — stdout carries JSON-RPC frames; any stray stdout write corrupts the protocol. Use `pino(pino.destination(2))` to bind to FD 2. Pino is the fastest Node logger (5–10× `winston`), ships structured JSON that users can pipe to `jq`, and supports log levels via `HERTWILL_MCP_LOG_LEVEL` env var. |
### Testing
| Tool | Version | Purpose | Why |
|---|---|---|---|
| **`vitest`** | `^4.1.4` | Unit + integration test runner | ESM-native (no `ts-jest` Babel gymnastics), 10× faster than Jest on cold start, same `describe/it/expect` API, built-in coverage via `v8`, watch mode with HMR. Jest has not kept up with ESM; for a Zod-v4/ESM/Node-20 stack, Vitest is the unambiguous choice. |
| **`@modelcontextprotocol/inspector`** | `^0.21.1` | Interactive MCP debugger | Official Anthropic tool. Spawns your server under stdio and gives you a web UI to list tools, invoke them with sample inputs, and inspect responses. Essential for manual QA before publishing. Run via `npx @modelcontextprotocol/inspector node dist/index.js`. |
| **In-process MCP client** | via `@modelcontextprotocol/sdk/client` | Automated end-to-end tests | Instantiate an `InMemoryTransport` pair (client + server) inside a Vitest test and assert on tool list/call responses. This is the idiomatic MCP test pattern in 2026 — no third-party `mcp-test-client` package needed; the SDK ships the primitives. |
| **`msw`** | `^2.7` | Mock Hertwill API in tests | Mock Service Worker intercepts `fetch` at the Node request layer. Lets us assert on headers (Bearer token), simulate 429 rate-limit responses, and golden-test response decoding — without hitting live Hertwill. |
### Packaging & Publishing
| Concern | Choice | Details |
|---|---|---|
| **Module format** | ESM-only | Node 20+ supports ESM natively; MCP SDK 1.29 is dual-published but ESM is the primary path. Dropping CJS saves build complexity and ~30% bundle size. Add `"type": "module"` in `package.json`. |
| **`bin` entry** | `"bin": { "hertwill-mcp": "./dist/index.js" }` | Single executable. `tsup` injects `#!/usr/bin/env node` at the top of `dist/index.js` via its `banner` option. `chmod +x` in postbuild. |
| **`exports` field** | `{ ".": "./dist/index.js" }` | Single entrypoint — we're a CLI, not a library. No subpath exports. |
| **`files` field** | `["dist", "skills", "README.md", "LICENSE"]` | Ship only built artifacts + the bundled Skill + docs. No `src/` in the tarball. |
| **`engines` field** | `{ "node": ">=20.11" }` | Forces install-time warning for Node 18. |
| **`publishConfig`** | `{ "access": "public", "provenance": true }` | Scoped package needs explicit public access. `provenance: true` generates an npm provenance attestation via GitHub Actions OIDC — important trust signal for a public MCP listed in six registries. |
| **CI** | GitHub Actions with `npm publish --provenance` | Publish from tag push; use `pnpm publish` or `npm publish` with OIDC-based provenance. |
### Claude Skill Bundling
- Repo layout: `skills/hertwill-sourcing/SKILL.md` + `skills/hertwill-sourcing/references/*.md` (supporting docs the Skill loads on-demand)
- The Skill ships **inside the npm tarball** so `npx @hertwill/mcp --install-skill` can copy it into `~/.claude/skills/hertwill-sourcing/` for Claude Code / Claude Desktop users
- Additionally publish a tiny Claude Code plugin manifest (`plugin.json`) in the same repo under `plugin/` so users of `claude plugin install github:hertwill/mcp` get the Skill + MCP config in one command
- The Skill's `description` frontmatter is what Claude reads to decide whether to load it — treat it as prompt-engineered copy, not a readme blurb
### Development Tools
| Tool | Purpose | Notes |
|---|---|---|
| **`tsx`** | Run TS directly in dev | `tsx src/index.ts` for fast iteration without rebuilds. Faster than `ts-node`, ESM-native. |
| **`@biomejs/biome`** | Lint + format | Replaces ESLint + Prettier. 25× faster, single binary, zero-config. Use `^2.0`. |
| **`@types/node`** | Node typings | `^20.17` to match runtime. |
| **`changesets`** | Version management | `@changesets/cli` for PR-driven versioning. Each PR adds a `.changeset/*.md` describing user-visible changes; CI reads them on merge to produce the published version. |
## Installation
# Core runtime
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `@modelcontextprotocol/sdk` (high-level `McpServer`) | Low-level `Server` class with manual `setRequestHandler` | If you need to customize JSON-RPC handling, implement non-standard capabilities, or build a proxy. For a conventional tool-only server, the high-level API is strictly better. |
| Native `fetch` | `undici` directly | If you need pooling control, HTTP/2, or interceptors. For a CLI hitting one host at modest rates, not worth it. |
| Native `fetch` | `ofetch` | If you were already in the Nuxt/UnJS ecosystem and wanted consistency. We're not. |
| `openapi-typescript` + `openapi-fetch` | `@hey-api/openapi-ts` | If you want a full generated SDK with runtime helpers, retries, and interceptors baked in. Worth it for large APIs with 100+ endpoints; overkill for ~15 Hertwill endpoints. |
| `zod` v4 | `valibot` | If bundle size is the dominant constraint (Valibot is ~70% smaller). Zod v4 closed most of the gap and has deeper MCP SDK integration. |
| `bottleneck` | `p-limit` + manual token bucket | If you only need concurrency limiting, not rate-per-time. Hertwill's 60/min limit is time-based → Bottleneck's reservoir is the right primitive. |
| `vitest` | `node --test` (built-in) | If you want zero test dependencies. Node's built-in runner works but lacks Vitest's ergonomics, coverage, and watch UX. |
| `tsup` | `unbuild` | If you want rollup-style multi-entry + stub mode for monorepos. Overkill for a single-bin CLI. |
| `pino` | `console.error` | For extremely minimal servers with no log levels. Pino gives you structured JSON + levels for ~15 KB — worth it. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| **`axios`** | 80+ KB, legacy XHR abstraction, duplicates native `fetch`, slow to adopt WHATWG standards. Adds meaningful bytes to an `npx`-installed CLI. | Native `fetch` + `openapi-fetch` |
| **`node-fetch`** | Obsolete since Node 18 shipped native `fetch`. Adds an install for no benefit. | Native `fetch` |
| **`zod-to-json-schema`** | Redundant with Zod v4's built-in `z.toJSONSchema()`, and the MCP SDK 1.29 derives JSON Schema from Zod automatically via Standard Schema. Adding it causes double-conversion bugs. | Let the MCP SDK consume your `z.object()` directly |
| **`@modelcontextprotocol/sdk@~1.17`** | That line had documented Zod v4 incompatibilities (issue #1429). 1.29 resolves them. | `@modelcontextprotocol/sdk@^1.29` |
| **`zod@^3`** | v3 still works but misses `toJSONSchema`, is slower, and is on a deprecation glidepath. Mixing Zod v3 in a codebase where the SDK internally uses `zod/v4` causes hard-to-debug type drift. | `zod@^4.3.6` |
| **`console.log`** (anywhere) | Writes to stdout → corrupts MCP JSON-RPC stream → client disconnects with cryptic parse errors. One of the top-5 MCP bugs in the wild. | `logger.info()` with pino→stderr; enforce via Biome lint rule `no-console` |
| **`jest`** | ESM support is still patchy, requires `@swc/jest` or `babel-jest`, 10× slower cold start, doesn't interop cleanly with Zod v4's ESM-first exports. | `vitest` |
| **`ts-node`** | Superseded by `tsx` (faster, ESM-native). `ts-node/esm` loader is deprecated. | `tsx` |
| **`eslint` + `prettier`** | Two tools, slow, config sprawl. Biome does both, faster, with one config file. | `@biomejs/biome` |
| **CJS dual-publishing** | Doubles build output, causes "dual package hazard" (two copies of Zod in memory, `instanceof` failures), and Node 20+ makes it unnecessary. | ESM-only with `"type": "module"` |
| **`winston`** | Slow, CJS-heavy, too many transports you won't use. | `pino` |
| **`lodash`** | Unnecessary for a CLI this size. Use native `Array`/`Object` methods. | Nothing |
| **Webhooks as a pattern** | Hertwill doesn't expose them (per PROJECT.md) and stdio MCP has no persistent endpoint to receive them anyway. | Polling tools (`get_sync_jobs`) on demand from the agent |
## Stack Patterns by Variant
- Add `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` — no new dependency
- Add `hono@^4` as the HTTP framework (lightweight, Cloudflare Workers + Node compatible)
- Add OAuth 2.1 PKCE via `@modelcontextprotocol/sdk/server/auth` helpers (1.29+ ships these)
- Keep `bottleneck` but key limiters per-session instead of per-process
- Polyfill `fetch` via `undici` (not `node-fetch`)
- Cannot use native `AbortSignal.timeout()` — use `AbortController` with `setTimeout` manually
- Lose `structuredClone` — inline the polyfill
- Swap `zod` for `valibot` (~70% smaller, same Standard Schema contract, works with MCP SDK 1.29)
- Swap `pino` for `console.error` wrapped in a level gate
- Swap `bottleneck` for a hand-rolled 20-line token bucket
## Version Compatibility
| Package | Compatible With | Notes |
|---|---|---|
| `@modelcontextprotocol/sdk@^1.29` | `zod@^3.25` **or** `zod@^4.0` | SDK internally uses `zod/v4` but accepts either via Standard Schema. **Pick one — don't install both.** Use Zod v4. |
| `@modelcontextprotocol/sdk@^1.29` | `node@>=20.11` | Uses `ReadableStream`, native `fetch`, `structuredClone`. |
| `openapi-typescript@^7` | `openapi-fetch@^0.17` | Matched pair from the same author (Drew Powers). 7.x emits types that 0.17 consumes directly. |
| `zod@^4.3` | `typescript@>=5.5` | Zod v4 requires TS 5.5+ for its generic inference tricks. |
| `tsup@^8.5` | `esbuild@^0.24` (transitive) | Handles shebang banner + `chmod +x` via `onSuccess` hook. |
| `vitest@^4` | `node@>=20`, `vite@^6` | v4 drops Node 18 support. |
| `pino@^10` | `node@>=18` | v10 ESM-first; use `pino.destination(2)` for stderr. |
## Sources
- **MCP TS SDK docs** — [github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — `McpServer`, `registerTool`, `StdioServerTransport` patterns (HIGH confidence)
- **npm registry** — version numbers for `@modelcontextprotocol/sdk@1.29.0` (published 2026-03-30), `zod@4.3.6`, `tsup@8.5.1`, `vitest@4.1.4`, `pino@10.3.1`, `p-retry@6.2.0`, `bottleneck@2.19.5`, `openapi-typescript@7.13.0`, `openapi-fetch@0.17.0`, `@modelcontextprotocol/inspector@0.21.1` (HIGH confidence)
- **Zod v4 release notes** — [zod.dev/v4](https://zod.dev/v4) and [zod.dev/json-schema](https://zod.dev/json-schema) — native `z.toJSONSchema()` replaces `zod-to-json-schema` (HIGH confidence)
- **MCP SDK Zod v4 compatibility** — [github.com/modelcontextprotocol/typescript-sdk/issues/1429](https://github.com/modelcontextprotocol/typescript-sdk/issues/1429), PR 63656a8 "feat: zod v4 with backwards compatibility for v3.25+" — confirms 1.29 handles Zod v4 correctly, 1.17.5 did not (HIGH confidence)
- **Hertwill API docs** — [hertwill.com/docs](https://hertwill.com/docs) — confirmed OpenAPI 3.1.0 spec embedded via Scalar viewer (HIGH confidence on format, MEDIUM on whether a raw `openapi.json` endpoint is exposed — must check at implementation time; worst case, scrape from the rendered page)
- **MCP stdio logging best practice** — [modelcontextprotocol.io/docs/tools/debugging](https://modelcontextprotocol.io/docs/tools/debugging) and [deepwiki.com/confluentinc/mcp-confluent/3.5-logging-system](https://deepwiki.com/confluentinc/mcp-confluent/3.5-logging-system) — `pino.destination(2)` to stderr is the 2026 consensus (HIGH confidence)
- **tsup dual-bin pattern for MCP** — [mastra.ai/docs/mcp/publishing-mcp-server](https://mastra.ai/docs/mcp/publishing-mcp-server) — shebang injection + `chmod +x` (HIGH confidence)
- **Claude Skill + MCP bundling** — [code.claude.com/docs/en/features-overview](https://code.claude.com/docs/en/features-overview), [morphllm.com/claude-code-skills-mcp-plugins](https://www.morphllm.com/claude-code-skills-mcp-plugins), [allaboutken.com/posts/20260408-mini-guide-claude-copilot-skills](https://www.allaboutken.com/posts/20260408-mini-guide-claude-copilot-skills/) — plugin format bundles skills + MCP configs; `SKILL.md` with YAML frontmatter is canonical (MEDIUM confidence — format is stabilizing but tooling still evolving in 2026)
## Confidence Summary
| Area | Confidence | Reason |
|---|---|---|
| MCP SDK version & API | HIGH | Verified against npm 1.29.0 metadata, official docs, and GitHub issue tracker |
| Zod v4 + MCP integration | HIGH | Release notes, MCP SDK PR, and Standard Schema docs all align |
| HTTP client choice | HIGH | Native `fetch` is unambiguously correct for Node 20+ CLI bundle-size constraints |
| OpenAPI tooling | HIGH | `openapi-typescript` + `openapi-fetch` pairing is well-documented and Hertwill confirmed OpenAPI 3.1 |
| Testing stack | HIGH | Vitest + Inspector + in-process client is the 2026 MCP testing consensus |
| Packaging (ESM + bin) | HIGH | Multiple published MCP servers follow this pattern; tsup's shebang pattern is documented |
| Rate limiting (Bottleneck) | HIGH | Octokit uses it; matches the "reservoir per time window" semantics of Hertwill's limits |
| Logging (Pino to stderr) | HIGH | Documented MCP best practice, enforced across major MCP server implementations |
| **Claude Skill packaging** | **MEDIUM** | Plugin spec exists but is still evolving; recommend shipping both loose-dir and plugin forms and revisiting at milestone 2 |
| Hertwill OpenAPI availability | MEDIUM | Confirmed spec exists in OpenAPI 3.1.0 format, unclear whether a stable JSON URL is exposed — validate at implementation time |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
