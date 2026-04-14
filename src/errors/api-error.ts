/**
 * Parse a seconds value from the IETF draft-8 combined RateLimit header.
 * Inlined (not imported from hertwill/rate-limiter) to avoid cross-package
 * cycles — errors/ must not depend on hertwill/.
 */
function parseRateLimitTSeconds(header: string | null): number | undefined {
  if (header === null) return undefined;
  const match = /\bt=(\d+)/.exec(header);
  if (!match) return undefined;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Defense-in-depth: never let API key fragments reach toString output. */
function sanitizeKeyFragments(text: string): string {
  return text.replace(/hw_(live|test)_[a-zA-Z0-9]+/g, "hw_***_REDACTED");
}

export class HertwillApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  /**
   * Seconds the caller should wait before retrying, when the server advertises
   * it (429 responses). Populated from `Retry-After` first, falling back to the
   * IETF draft-8 `RateLimit: ...; t=<seconds>` combined header.
   *
   * Intentionally NOT serialized via toJSON — consumers (e.g. mapHertwillError)
   * read it directly from the instance to build a user-facing hint. Excluding
   * it from toJSON preserves the Phase 2 three-field serialization contract
   * and shrinks the information-disclosure surface.
   */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    correlationId?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HertwillApiError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static fromResponse(
    response: Response,
    errorBody: { error: { code: string; message: string } },
  ): HertwillApiError {
    const retryAfterHeader = response.headers.get("Retry-After");
    let retryAfterSeconds: number | undefined;
    if (retryAfterHeader !== null) {
      const parsed = Number.parseInt(retryAfterHeader, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        retryAfterSeconds = parsed;
      }
    }
    if (retryAfterSeconds === undefined) {
      retryAfterSeconds = parseRateLimitTSeconds(
        response.headers.get("RateLimit") ?? response.headers.get("ratelimit"),
      );
    }

    return new HertwillApiError(
      response.status,
      errorBody.error.code,
      errorBody.error.message,
      response.headers.get("x-correlation-id") ?? undefined,
      retryAfterSeconds,
    );
  }

  toJSON(): { status: number; code: string; message: string } {
    return { status: this.status, code: this.code, message: this.message };
  }

  override toString(): string {
    return sanitizeKeyFragments(
      `HertwillApiError [${this.status}] ${this.code}: ${this.message}`,
    );
  }
}
