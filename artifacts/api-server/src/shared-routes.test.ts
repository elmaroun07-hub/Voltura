import { describe, expect, it } from "vitest";
import { api } from "./shared-routes";

/**
 * Regression guard for the /api/optimize Zod failure:
 *   {"code":"invalid_type","expected":"string","received":"object","path":["explanation"]}
 *
 * `response_format: json_object` guarantees the model returns valid JSON but NOT
 * the shape of any value — `explanation` came back as a string on some calls and a
 * nested object on others. The failure is non-deterministic, so it cannot be caught
 * by manual testing; these fixtures pin the tolerated shapes.
 */

const schema = api.calculations.optimize.responses[200];

/**
 * H-OPT — `sizing` and `resolution` are now required, and `optimalPv` /
 * `optimalBattery` are computed server-side rather than read off the model.
 * The values below are the ones `/api/optimize` returns for a 5,000 kWh/year
 * house at Fuengirola's 5.05 kWh/m2/day.
 */
const sizing = {
  pvKwp: 3.391,
  pvWatts: 3391,
  batteryKwh: 4.1,
  annualUsageKwh: 5000,
  dailyUsageKwh: 13.699,
  nightUsageKwh: 2.955,
  nightShare: 0.2157,
  darkHours: 9,
  irradianceKwhM2Day: 5.05,
  coverageTarget: 1,
  performanceRatio: 0.8,
  roundTripEfficiency: 0.9,
  usableDepthOfDischarge: 0.8,
  daysPerYear: 365,
};

const resolution = {
  locationInput: "Fuengirola, Málaga, Spain",
  geocodeStatus: "resolved" as const,
  lat: 36.5388,
  lon: -4.6234,
  irradianceSource: "nasa-live" as const,
  irradiancePeriod: { start: 2019, end: 2023 },
  nasaHttpStatus: 200,
  nasaKeysRequested: ["201901", "201902", "201903"],
  nasaKeysPresent: ["201901", "201902", "201903"],
  irradianceMonthly: [2.73, 3.5, 4.6, 5.6, 6.5, 7.2, 7.3, 6.6, 5.3, 3.9, 2.9, 2.5],
};

const base = { optimalPv: 3391, optimalBattery: 4.1, sizing, resolution };

describe("optimize response — explanation shape tolerance", () => {
  it("(i) accepts a plain string unchanged", () => {
    const result = schema.parse({
      ...base,
      explanation: "A 5 kW array covers your midday load; 10 kWh shifts it to the evening.",
    });

    expect(result.explanation).toBe(
      "A 5 kW array covers your midday load; 10 kWh shifts it to the evening.",
    );
  });

  it("(ii) normalizes a nested object into labelled readable text", () => {
    const result = schema.parse({
      ...base,
      explanation: {
        pv_sizing: "5 kW suits your roof area.",
        battery_sizing: "10 kWh covers the evening peak.",
      },
    });

    expect(typeof result.explanation).toBe("string");
    expect(result.explanation).toContain("Pv sizing: 5 kW suits your roof area.");
    expect(result.explanation).toContain("Battery sizing: 10 kWh covers the evening peak.");
  });

  it("(ii-b) flattens a deeply nested object rather than throwing", () => {
    const result = schema.parse({
      ...base,
      explanation: {
        summary: "Solar covers most daytime demand.",
        details: { roi: "Payback in 7.5 years.", export: "Surplus is exported." },
      },
    });

    expect(typeof result.explanation).toBe("string");
    expect(result.explanation).toContain("Solar covers most daytime demand.");
    expect(result.explanation).toContain("Payback in 7.5 years.");
  });

  it("(iii) joins an array of bullets into a single string", () => {
    const result = schema.parse({
      ...base,
      explanation: [
        "Peak demand is in the evening.",
        "A battery shifts midday surplus into that peak.",
      ],
    });

    expect(result.explanation).toBe(
      "Peak demand is in the evening. A battery shifts midday surplus into that peak.",
    );
  });

  it("rejects an explanation with no usable text, so the route can return 502", () => {
    expect(schema.safeParse({ ...base, explanation: {} }).success).toBe(false);
    expect(schema.safeParse({ ...base, explanation: [] }).success).toBe(false);
    expect(schema.safeParse({ ...base, explanation: null }).success).toBe(false);
    expect(schema.safeParse({ ...base, explanation: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...base }).success).toBe(false);
  });
});

describe("optimize response — the sizes are computed, not coerced (H-OPT)", () => {
  it("carries the computed figures through unchanged", () => {
    const result = schema.parse({ ...base, explanation: "ok" });

    expect(result.optimalPv).toBe(3391);
    expect(result.optimalBattery).toBe(4.1);
    expect(result.sizing.irradianceKwhM2Day).toBe(5.05);
    expect(result.sizing.coverageTarget).toBe(1);
  });

  it("no longer tolerates a numeric STRING where a computed number belongs", () => {
    // `llmNumberSchema` used to sit on these two fields, accepting "5000"
    // because a language model was choosing the size. It no longer is. A
    // string here would mean a model value had reached the field, so it fails.
    expect(schema.safeParse({ ...base, optimalPv: "3391", explanation: "ok" }).success).toBe(
      false,
    );
  });

  it("rejects non-numeric junk instead of silently yielding 0", () => {
    for (const bad of [{}, [], null, "", "  ", "not a number", true]) {
      expect(schema.safeParse({ ...base, optimalPv: bad, explanation: "ok" }).success).toBe(false);
    }
  });

  it("requires the provenance and the sizing record, so neither can be dropped", () => {
    expect(schema.safeParse({ ...base, sizing: undefined, explanation: "ok" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, resolution: undefined, explanation: "ok" }).success).toBe(
      false,
    );
  });

  it("rejects an irradianceSource outside the enum, so a raw label cannot ship", () => {
    expect(
      schema.safeParse({
        ...base,
        explanation: "ok",
        resolution: { ...resolution, irradianceSource: "nasa" },
      }).success,
    ).toBe(false);
  });
});
