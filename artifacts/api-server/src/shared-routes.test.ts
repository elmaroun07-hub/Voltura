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
const base = { optimalPv: 5000, optimalBattery: 10, roiYears: 7.5 };

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

describe("optimize response — numeric coercion", () => {
  it("coerces numeric strings to numbers", () => {
    const result = schema.parse({
      optimalPv: "5000",
      optimalBattery: "10.5",
      roiYears: "7.5",
      explanation: "ok",
    });

    expect(result.optimalPv).toBe(5000);
    expect(result.optimalBattery).toBe(10.5);
    expect(result.roiYears).toBe(7.5);
  });

  it("leaves real numbers untouched", () => {
    const result = schema.parse({ ...base, explanation: "ok" });

    expect(result.optimalPv).toBe(5000);
    expect(result.optimalBattery).toBe(10);
    expect(result.roiYears).toBe(7.5);
  });

  it("rejects non-numeric junk instead of silently yielding 0", () => {
    for (const bad of [{}, [], null, "", "  ", "not a number", true]) {
      expect(schema.safeParse({ ...base, optimalPv: bad, explanation: "ok" }).success).toBe(false);
    }
  });
});
