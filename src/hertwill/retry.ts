import pRetry from "p-retry";
import { parseRateLimitHeader } from "./rate-limiter.js";

/** Status codes that are safe to retry. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/**
 * Returns true if the HTTP status code is retryable.
 * Only 429 (rate limited) and 5xx gateway errors are retried.
 * All other 4xx errors are terminal.
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

/**
 * Determine the retry delay (in ms) for a 429 response using the D-03 fallback chain:
 *
 * 1. `Retry-After` header (seconds) -> convert to ms
 * 2. `ratelimit` header `t` value (seconds) -> convert to ms
 * 3. Conservative fallback: 30,000ms
 *
 * Adds 0-2s random jitter to avoid thundering herd.
 */
export function getRetryDelay(response: Response): number {
  let baseDelay: number;

  // 1. Check Retry-After header
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter !== null) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds) && seconds > 0) {
      baseDelay = seconds * 1000;
      return baseDelay + Math.random() * 2000;
    }
  }

  // 2. Check ratelimit header for `t` (reset seconds)
  const rateLimitInfo = parseRateLimitHeader(response.headers.get("ratelimit"));
  if (rateLimitInfo !== null) {
    baseDelay = rateLimitInfo.resetSeconds * 1000;
    return baseDelay + Math.random() * 2000;
  }

  // 3. Conservative fallback: 30s
  baseDelay = 30_000;
  return baseDelay + Math.random() * 2000;
}

/**
 * Create p-retry options with the project's retry policy.
 *
 * - 3 retries with exponential backoff (factor=2)
 * - Randomized jitter
 * - Only retries on retryable status codes (429, 502, 503, 504) and network errors
 * - Non-retryable 4xx errors abort immediately
 * - 429 errors respect `retryAfterSeconds` from the error when available,
 *   overriding the generic exponential backoff with the server-specified delay.
 */
export function createRetryOptions(): pRetry.Options {
  return {
    retries: 3,
    minTimeout: 1_000,
    factor: 2,
    randomize: true,
    shouldRetry: (error: unknown) => {
      if (
        error !== null &&
        typeof error === "object" &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
      ) {
        const status = (error as { status: number }).status;
        if (!isRetryableStatus(status)) {
          return false;
        }
      }
      // Network errors and retryable statuses: retry
      return true;
    },
    onFailedAttempt: async (error) => {
      // When a 429 carries retryAfterSeconds, sleep for that duration
      // instead of p-retry's generic exponential backoff.
      const cause = error.cause ?? error;
      if (
        cause !== null &&
        typeof cause === "object" &&
        "retryAfterSeconds" in cause &&
        typeof (cause as { retryAfterSeconds: unknown }).retryAfterSeconds ===
          "number"
      ) {
        const delay =
          (cause as { retryAfterSeconds: number }).retryAfterSeconds * 1000 +
          Math.random() * 2000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },
  };
}

/**
 * Convenience wrapper: execute an async function with the project's
 * retry policy (3 retries, exponential backoff, jitter).
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  return pRetry(fn, createRetryOptions());
}
