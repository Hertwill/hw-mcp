export class HertwillSchemaMismatchError extends Error {
  readonly endpoint: string;
  readonly fields: string;
  readonly issues: unknown[];

  constructor(endpoint: string, fields: string, issues: unknown[]) {
    super(
      `Hertwill API response schema mismatch on ${endpoint}: field(s) [${fields}] ` +
        `do not match expected shape. The Hertwill API may have changed — ` +
        `please upgrade @hertwill/mcp to the latest version: npx @hertwill/mcp@latest`,
    );
    this.name = "HertwillSchemaMismatchError";
    this.endpoint = endpoint;
    this.fields = fields;
    this.issues = issues;
  }
}
