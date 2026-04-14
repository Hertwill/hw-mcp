/**
 * Tracks the most recently observed rate-limit reset window and exposes
 * seconds-remaining with wall-clock decay.
 *
 * Hertwill advertises reset via the draft-8 combined header
 * `RateLimit: "...";  t=<seconds>`. `updateFromHeaders` in
 * `src/hertwill/rate-limiter.ts` already parses it and adjusts the Bottleneck
 * reservoir. This tracker is the read-side complement: `check_health` and
 * rate-limit-exhaustion error paths ask it "how long until the bucket refills?"
 * without re-reading a header.
 */
export class RateResetTracker {
  private resetAt: number | undefined; // epoch ms

  /** Record that the next reset occurs `secondsUntilReset` from now. */
  observe(secondsUntilReset: number): void {
    this.resetAt = Date.now() + secondsUntilReset * 1000;
  }

  /**
   * Seconds until the observed reset window, clamped to >=0. Returns
   * `undefined` when no header has been observed yet so callers can
   * distinguish "I don't know" from "0 seconds left".
   */
  secondsRemaining(): number | undefined {
    if (this.resetAt === undefined) return undefined;
    return Math.max(0, Math.ceil((this.resetAt - Date.now()) / 1000));
  }
}
