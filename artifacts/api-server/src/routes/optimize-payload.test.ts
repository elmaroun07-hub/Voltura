import { describe, expect, it } from "vitest";
import { parseOptimizePayload, OPTIMIZE_FAILURE_MESSAGE } from "./optimize-payload";

/**
 * These fail against the pre-fix route (which echoed the model payload straight
 * to res.json with a bare `|| fallback`) and pass after it.
 *
 * The object fixture below is a REAL production payload, captured from
 * https://voltura-api.onrender.com/api/optimize on 2026-08-03 — the model
 * returned `explanation` as a six-key object with HTTP 200, which the browser
 * then rejected as: expected string, received object.
 */

const PROD_OBJECT_EXPLANATION = {
  optimal_pv_watts: 4500,
  optimal_battery_kwh: 8,
  explanation: {
    location_analysis:
      "Madrid, Spain has high solar irradiance (~1,800 kWh/m2/year) with ~2,800 sunshine hours annually.",
    energy_pattern_analysis:
      "Daily energy demand peaks at 1.9 kWh (18:00-19:00) with low overnight consumption.",
    pv_sizing_rationale: "4.5 kW PV system covers ~80% of daily demand.",
    battery_sizing_rationale: "8 kWh battery stores midday surplus for the evening peak.",
    roi_considerations: "System cost ~EUR 6,500; annual savings ~EUR 1,500.",
    additional_notes: "Depth-of-discharge set to 80% for longevity.",
  },
};

describe("parseOptimizePayload — object where a string was expected", () => {
  it("coerces the real production object payload instead of failing", () => {
    const result = parseOptimizePayload(JSON.stringify(PROD_OBJECT_EXPLANATION));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.data.explanation).toBe("string");
    expect(result.data.optimalPv).toBe(4500);
    expect(result.data.optimalBattery).toBe(8);
    // Every part of the object survives as readable labelled text.
    expect(result.data.explanation).toContain("Location analysis:");
    expect(result.data.explanation).toContain("Madrid, Spain has high solar irradiance");
    expect(result.data.explanation).toContain("Pv sizing rationale:");
  });

  it("never emits raw Zod internals in the user-facing failure message", () => {
    expect(OPTIMIZE_FAILURE_MESSAGE).not.toMatch(/invalid_type|zod|expected|received/i);
    expect(OPTIMIZE_FAILURE_MESSAGE.length).toBeGreaterThan(10);
  });

  it("coerces an array of bullets to a single string", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        optimal_pv_watts: 5000,
        optimal_battery_kwh: 10,
        explanation: ["Peak demand is in the evening.", "A battery shifts midday surplus."],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.explanation).toBe(
      "Peak demand is in the evening. A battery shifts midday surplus.",
    );
  });
});

describe("parseOptimizePayload — valid shape passes through unchanged", () => {
  it("returns the model's own values when the contract is honoured", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        optimal_pv_watts: 6200,
        optimal_battery_kwh: 12.5,
        explanation: "A 6.2 kW array with 12.5 kWh of storage covers your evening peak.",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.optimalPv).toBe(6200);
    expect(result.data.optimalBattery).toBe(12.5);
    expect(result.data.explanation).toBe(
      "A 6.2 kW array with 12.5 kWh of storage covers your evening peak.",
    );
  });

  it("coerces numeric strings, which the model also emits", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        optimal_pv_watts: "5000",
        optimal_battery_kwh: "10.5",
        explanation: "ok",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.optimalPv).toBe(5000);
    expect(result.data.optimalBattery).toBe(10.5);
  });
});

describe("parseOptimizePayload — malformed input is handled, never thrown", () => {
  it("reports non-JSON without throwing", () => {
    const result = parseOptimizePayload("Here is my recommendation: 5kW of solar!");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_json");
    expect(result.issues[0]?.message).toMatch(/not valid JSON/i);
  });

  it("reports a JSON array (not an object) without throwing", () => {
    const result = parseOptimizePayload('["4500 W", "8 kWh"]');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_shape");
  });

  it("fails when explanation carries no usable text, so the route can 502", () => {
    for (const explanation of [{}, [], null, "   "]) {
      const result = parseOptimizePayload(
        JSON.stringify({ optimal_pv_watts: 5000, optimal_battery_kwh: 10, explanation }),
      );
      expect(result.ok).toBe(false);
    }
  });

  it("does not throw on any of these inputs", () => {
    for (const raw of ["", "null", "{}", "[]", "not json", '{"explanation":123}']) {
      expect(() => parseOptimizePayload(raw)).not.toThrow();
    }
  });
});
