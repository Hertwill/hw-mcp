import Bottleneck from "bottleneck";
import { logger } from "../logger.js";

/**
 * Parsed rate limit information from IETF draft-8 combined header.
 * Format: "60-in-1min"; r=59; t=60
 */
export interface RateLimitInfo {
  /** Remaining requests in the current window */
  remaining: number;
  /** Seconds until the window resets */
  resetSeconds: number;
}

/**
 * Parse the IETF draft-8 combined `ratelimit` response header.
 *
 * Expected format: `"60-in-1min"; r=59; t=60`
 *   - `r` = remaining requests in the window
 *   - `t` = seconds until the window resets
 *
 * Returns null if the header is absent or malformed.
 */
export function parseRateLimitHeader(
  header: string | null,
): RateLimitInfo | null {
  if (header === null) return null;

  const rMatch = /\br=(\d+)/.exec(header);
  const tMatch = /\bt=(\d+)/.exec(header);

  if (!rMatch || !tMatch) return null;

  return {
    remaining: Number.parseInt(rMatch[1], 10),
    resetSeconds: Number.parseInt(tMatch[1], 10),
  };
}

/** Configuration for a public (60/min) rate limit bucket. */
export const PUBLIC_LIMITER_CONFIG: Bottleneck.ConstructorOptions = {
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 5,
  minTime: 100,
};

/** Configuration for an authenticated (300/min) rate limit bucket. */
export const AUTH_LIMITER_CONFIG: Bottleneck.ConstructorOptions = {
  reservoir: 300,
  reservoirRefreshAmount: 300,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 10,
  minTime: 50,
};

export interface LimiterPair {
  public: Bottleneck;
  auth: Bottleneck;
}

/**
 * Per-key rate limiter registry for multi-session support.
 *
 * In stdio mode (single user), all calls share one pair of buckets.
 * In HTTP mode (multiple users), each API key gets its own pair so
 * one user's traffic doesn't starve another's.
 *
 * Idle buckets are evicted after `idleTtlMs` to prevent memory leaks
 * from disconnected sessions.
 */
export class RateLimiterRegistry {
  private buckets = new Map<string, { pair: LimiterPair; lastUsed: number }>();
  private readonly idleTtlMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(idleTtlMs = 10 * 60 * 1000) {
    this.idleTtlMs = idleTtlMs;
    // Sweep every 2 minutes; unref so it doesn't keep the process alive
    this.sweepTimer = setInterval(() => this.evictIdle(), 2 * 60 * 1000);
    this.sweepTimer.unref();
  }

  /** Get or create a limiter pair for the given API key ("_anonymous" if none). */
  get(apiKey?: string): LimiterPair {
    const key = apiKey ?? "_anonymous";
    const entry = this.buckets.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry.pair;
    }
    const pair: LimiterPair = {
      public: new Bottleneck(PUBLIC_LIMITER_CONFIG),
      auth: new Bottleneck(AUTH_LIMITER_CONFIG),
    };
    this.buckets.set(key, { pair, lastUsed: Date.now() });
    return pair;
  }

  /** Number of active bucket pairs (for diagnostics/testing). */
  get size(): number {
    return this.buckets.size;
  }

  /** Remove idle entries older than idleTtlMs. */
  private evictIdle(): void {
    const cutoff = Date.now() - this.idleTtlMs;
    for (const [key, entry] of this.buckets) {
      if (entry.lastUsed < cutoff) {
        this.buckets.delete(key);
      }
    }
  }

  /** Stop the sweep timer (for clean test teardown). */
  dispose(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }
}

/**
 * Default registry used by stdio mode and backward-compatible imports.
 * Multi-session HTTP mode should create its own registry instance.
 */
export const defaultRegistry = new RateLimiterRegistry();

/**
 * Public API rate limiter: 60 requests per minute.
 * Backward-compatible singleton from the default registry.
 */
export const publicLimiter = defaultRegistry.get().public;

/**
 * Authenticated API rate limiter: 300 requests per minute.
 * Backward-compatible singleton from the default registry.
 */
export const authLimiter = defaultRegistry.get().auth;

/**
 * Adaptively update a Bottleneck limiter's reservoir based on the
 * `ratelimit` response header. When remaining requests drop below
 * the proactive threshold (5), the reservoir is set to the actual
 * remaining count to avoid hitting 429.
 */
export function updateFromHeaders(
  limiter: Bottleneck,
  response: Response,
): void {
  const parsed = parseRateLimitHeader(response.headers.get("ratelimit"));
  if (!parsed) return;

  const { remaining, resetSeconds } = parsed;

  if (remaining < 5) {
    limiter.updateSettings({ reservoir: remaining });
    logger.debug({ remaining, resetSeconds }, "Rate limit proactive throttle");
  }
}
