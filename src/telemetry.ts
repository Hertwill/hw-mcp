/**
 * SEC-06: Opt-in telemetry module.
 *
 * Off by default. Enable by setting HERTWILL_MCP_TELEMETRY=true.
 * When enabled, records lightweight spans for tool invocations.
 *
 * Privacy invariant: spans contain ONLY static tool names, duration buckets,
 * outcome flags, and error codes. No query text, product IDs, filter values,
 * or API key material ever enters a span.
 */

export interface TelemetrySpan {
  tool: string;
  duration_bucket: "fast" | "medium" | "slow";
  outcome: "ok" | "error";
  error_code?: string;
}

export interface Telemetry {
  /** Record a tool invocation span. Only static/enum values accepted — no user data. */
  recordSpan(
    toolName: string,
    durationMs: number,
    outcome: "ok" | "error",
    errorCode?: string,
  ): void;
  /** Return a copy of all recorded spans (empty array in no-op mode). */
  spans(): TelemetrySpan[];
}

function durationBucket(ms: number): "fast" | "medium" | "slow" {
  if (ms < 500) return "fast";
  if (ms < 2000) return "medium";
  return "slow";
}

function createNoOpTelemetry(): Telemetry {
  return {
    recordSpan: () => {},
    spans: () => [],
  };
}

function createStubTelemetry(): Telemetry {
  const buffer: TelemetrySpan[] = [];
  return {
    recordSpan(toolName, durationMs, outcome, errorCode) {
      const span: TelemetrySpan = {
        tool: toolName,
        duration_bucket: durationBucket(durationMs),
        outcome,
      };
      if (errorCode !== undefined) {
        span.error_code = errorCode;
      }
      buffer.push(span);
    },
    spans: () => [...buffer],
  };
}

/**
 * Initialise telemetry from the environment.
 * Returns a no-op implementation unless HERTWILL_MCP_TELEMETRY=true.
 */
export function initTelemetry(): Telemetry {
  const enabled = process.env.HERTWILL_MCP_TELEMETRY === "true";
  return enabled ? createStubTelemetry() : createNoOpTelemetry();
}
