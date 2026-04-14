import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampPerPage,
  MCP_LIST_PAGE_CEILING,
} from "../../../src/tools/helpers.js";
import { RateResetTracker } from "../../../src/tools/rate-reset.js";

describe("clampPerPage", () => {
  it("returns the ceiling (unchanged flag) when requested is undefined", () => {
    expect(clampPerPage(undefined)).toEqual({
      value: MCP_LIST_PAGE_CEILING,
      clamped: false,
    });
  });

  it("returns the requested value when under the ceiling", () => {
    expect(clampPerPage(10)).toEqual({ value: 10, clamped: false });
  });

  it("returns the ceiling (not clamped) when requested equals the ceiling", () => {
    expect(clampPerPage(20)).toEqual({ value: 20, clamped: false });
  });

  it("clamps and flags when requested exceeds the ceiling", () => {
    expect(clampPerPage(50)).toEqual({ value: 20, clamped: true });
  });
});

describe("RateResetTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000_000_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("secondsRemaining() is undefined before any header is observed", () => {
    const tracker = new RateResetTracker();
    expect(tracker.secondsRemaining()).toBeUndefined();
  });

  it("secondsRemaining() returns a value in [0,N] immediately after observe(N)", () => {
    const tracker = new RateResetTracker();
    tracker.observe(7);
    const remaining = tracker.secondsRemaining();
    expect(typeof remaining).toBe("number");
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(7);
  });

  it("secondsRemaining() clamps to 0 (not negative) after the window has passed", () => {
    const tracker = new RateResetTracker();
    tracker.observe(1);
    vi.advanceTimersByTime(2000);
    expect(tracker.secondsRemaining()).toBe(0);
  });
});
