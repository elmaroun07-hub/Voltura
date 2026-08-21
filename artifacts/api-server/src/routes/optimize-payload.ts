import type { z } from "zod/v4";
import { api } from "../shared-routes";

/**
 * Turns a raw /api/optimize model completion into either a validated response
 * or a structured failure. Extracted from the route handler so the payload
 * contract is unit-testable without booting Express or calling the provider —
 * a mock of the *route* is what let this bug survive earlier fixes.
 *
 * `response_format: json_object` guarantees valid JSON, never the shape of a
 * value: `explanation` arrives as a string, an object of labelled parts, or an
 * array of bullets, varying call to call. Coercion happens in the schema; this
 * function decides 200-vs-502 and never throws.
 */

const optimizeResponse = api.calculations.optimize.responses[200];

export type OptimizeIssue = { path: string; message: string };

export type OptimizePayloadResult =
  | { ok: true; data: z.infer<typeof optimizeResponse> }
  | { ok: false; reason: "not_json" | "invalid_shape"; issues: OptimizeIssue[] };

export function parseOptimizePayload(rawContent: string): OptimizePayloadResult {
  let rec: Record<string, unknown>;

  try {
    rec = JSON.parse(rawContent) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "not_json",
      issues: [{ path: "", message: "model response was not valid JSON" }],
    };
  }

  if (rec === null || typeof rec !== "object" || Array.isArray(rec)) {
    return {
      ok: false,
      reason: "invalid_shape",
      issues: [{ path: "", message: "model response was not a JSON object" }],
    };
  }

  const parsed = optimizeResponse.safeParse({
    optimalPv: rec["optimal_pv_watts"] || 5000,
    optimalBattery: rec["optimal_battery_kwh"] || 10,
    explanation: rec["explanation"],
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_shape",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { ok: true, data: parsed.data };
}

/** User-facing copy for a failed optimization. Never contains Zod detail. */
export const OPTIMIZE_FAILURE_MESSAGE =
  "The optimization model returned an unusable response. Please try again.";
