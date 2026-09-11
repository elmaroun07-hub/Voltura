import { describe, expect, it } from "vitest";
import {
  allowedFigures,
  extractFigures,
  normalizeFigureToken,
  parseOptimizePayload,
  renderOptimizeFacts,
  unsupportedFigures,
  OPTIMIZE_FAILURE_MESSAGE,
  type OptimizeFacts,
} from "./optimize-payload";
import { sizePvAndBattery } from "../lib/sizing";

/**
 * H-OPT — the /api/optimize model boundary.
 *
 * Two properties are locked here. The first is inherited: `explanation` arrives
 * as a string on some calls and a nested object or an array of bullets on
 * others, and all three must normalize rather than 500. The second is new and
 * is the reason this file grew: the model no longer chooses a size, so the only
 * thing left to police is whether the prose it wrote contains a number nobody
 * gave it.
 *
 * Offline: pure functions, no fetch, no provider. G10.
 */

const SOLAR_PROFILE: number[] = (() => {
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (h < 6 || h > 20) return 0;
    return Math.exp(-0.5 * Math.pow((h - 12) / 3.5, 2));
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
})();

const CLIENT_PROFILE = [
  2, 2, 2, 2, 3, 5, 8, 8, 6, 4, 3, 3, 3, 3, 4, 5, 7, 10, 8, 5, 3, 2, 2, 2,
];

function facts(): OptimizeFacts {
  const sized = sizePvAndBattery({
    annualUsageKwh: 5000,
    hourlyLoadShape: CLIENT_PROFILE,
    hourlySolarShape: SOLAR_PROFILE,
    irradianceKwhM2Day: 5.05,
  });
  if (!sized.ok) throw new Error("fixture sizing failed");

  return {
    location: "Fuengirola, Málaga, Spain",
    lat: 36.5388,
    lon: -4.6234,
    irradianceSource: "nasa-live",
    irradiancePeriod: { start: 2019, end: 2023 },
    sizing: sized.sizing,
  };
}

const FACTS_TEXT = renderOptimizeFacts(facts());

/** The real production payload captured from /api/optimize on 2026-08-03. */
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

describe("renderOptimizeFacts — what the model is shown", () => {
  it("carries the computed figures and the provenance, never the raw enum", () => {
    expect(FACTS_TEXT).toContain("3.391 kWp");
    expect(FACTS_TEXT).toContain("3391 W");
    expect(FACTS_TEXT).toContain("4.1 kWh");
    expect(FACTS_TEXT).toContain("5.05 kWh/m2/day");
    expect(FACTS_TEXT).toContain("5000 kWh/year");
    expect(FACTS_TEXT).toContain("NASA POWER satellite measurement, 2019–2023 monthly mean");
    // G7: `nasa-live` is a machine enum and never reaches prose, not even the
    // model's copy of it.
    expect(FACTS_TEXT).not.toContain("nasa-live");
    expect(FACTS_TEXT).not.toContain("fallback-lat");
  });

  it("says so when the figure came from the latitude estimate", () => {
    const text = renderOptimizeFacts({
      ...facts(),
      irradianceSource: "fallback-lat",
      irradiancePeriod: null,
    });
    expect(text).toContain("estimated from latitude");
    expect(text).not.toContain("NASA POWER satellite measurement");
  });

  it("throws rather than claiming NASA data with no period", () => {
    expect(() =>
      renderOptimizeFacts({ ...facts(), irradiancePeriod: null }),
    ).toThrow(/irradiancePeriod/);
  });

  it("uses an en dash for the year range, so 2023 is not read as -2023", () => {
    const allowed = allowedFigures(FACTS_TEXT);
    expect(allowed.has(2019)).toBe(true);
    expect(allowed.has(2023)).toBe(true);
    expect(allowed.has(-2023)).toBe(false);
  });
});

describe("normalizeFigureToken — a number, or a refusal", () => {
  it("reads the forms that appear in real prose", () => {
    expect(normalizeFigureToken("3391")).toBe(3391);
    expect(normalizeFigureToken("3.391")).toBe(3391 / 1000);
    expect(normalizeFigureToken("4.10")).toBe(4.1);
    expect(normalizeFigureToken("1,800")).toBe(1800);
    expect(normalizeFigureToken("1,234.56")).toBe(1234.56);
    expect(normalizeFigureToken("5,05")).toBe(5.05);
    expect(normalizeFigureToken("-999")).toBe(-999);
    // Sentence punctuation clings to the digits.
    expect(normalizeFigureToken("5.05.")).toBe(5.05);
    expect(normalizeFigureToken("3,")).toBe(3);
  });

  it("never reads 3.391 as three thousand — that is why dot-grouping is out", () => {
    expect(normalizeFigureToken("3.391")).toBeLessThan(4);
    expect(normalizeFigureToken("1.500")).toBeCloseTo(1.5, 3);
  });

  it("returns null for anything it cannot read unambiguously", () => {
    for (const token of ["1.2.3", "1,23,456", "-", "1,2345"]) {
      expect(normalizeFigureToken(token)).toBeNull();
    }
  });
});

describe("O.6 — no figure the model was not given", () => {
  it("accepts prose that copies the figures verbatim", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        explanation:
          "At 5.05 kWh/m2/day a 3.391 kWp array covers your 5000 kWh/year, and 4.1 kWh of storage carries the 2.955 kWh you use overnight.",
      }),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.explanation).toContain("3.391 kWp");
  });

  it("rejects an invented irradiance — the exact defect this block removes", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        explanation: "Fuengirola receives about 4.5 kWh/m2/day, so 3.391 kWp is right.",
      }),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported_figure");
    expect(result.issues[0]?.message).toContain("4.5");
  });

  it("rejects an invented payback, cost or efficiency", () => {
    for (const explanation of [
      "The system pays for itself in 7.5 years.",
      "Installation costs about EUR 6,500.",
      "Panel efficiency is typically 21%.",
    ]) {
      const result = parseOptimizePayload(JSON.stringify({ explanation }), FACTS_TEXT);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("unsupported_figure");
    }
  });

  it("rejects a rounded version of a figure it was given", () => {
    // 3.4 is not 3.391. A rounding is a different number, and letting one
    // through is how "close enough" becomes a fabricated figure.
    const result = parseOptimizePayload(
      JSON.stringify({ explanation: "A 3.4 kWp array suits this roof." }),
      FACTS_TEXT,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects the whole real production payload, figure by figure", () => {
    const result = parseOptimizePayload(
      JSON.stringify(PROD_OBJECT_EXPLANATION),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported_figure");
    // ~1,800 kWh/m2/year and ~2,800 sunshine hours were never in any input.
    expect(result.issues.map((i) => i.message).join(" ")).toMatch(/1,800|2,800/);
  });

  it("ignores optimal_pv_watts even when the model volunteers one (P3)", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        optimal_pv_watts: 25000,
        optimal_battery_kwh: 40,
        explanation: "A 3.391 kWp array is the right size here.",
      }),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Nothing in the result can carry the model's 25000; the type has no field
    // for it and the route reads the sizing function instead.
    expect(JSON.stringify(result)).not.toContain("25000");
  });

  it("prose with no figures at all is fine", () => {
    const result = parseOptimizePayload(
      JSON.stringify({ explanation: "Your array is sized to your yearly consumption." }),
      FACTS_TEXT,
    );
    expect(result.ok).toBe(true);
  });

  it("unsupportedFigures reports the offending tokens and caps the list", () => {
    const allowed = allowedFigures("only 7 here");
    const bad = unsupportedFigures("1 2 3 4 5 6 7 8 9 10 11 12", allowed);
    expect(bad).toContain("1");
    expect(bad).not.toContain("7");
    expect(bad.length).toBeLessThanOrEqual(8);
  });

  it("extractFigures finds digit runs inside units and punctuation", () => {
    const tokens = extractFigures("5.05 kWh/m2/day, 3,391 W.").map((f) => f.token);
    expect(tokens).toEqual(["5.05", "2", "3,391"]);
  });
});

describe("explanation shape tolerance — inherited behaviour", () => {
  it("normalizes a nested object into labelled readable text", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        explanation: {
          pv_sizing: "The array matches your yearly use.",
          battery_sizing: "Storage covers the evening peak.",
        },
      }),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.explanation).toContain("Pv sizing: The array matches your yearly use.");
    expect(result.explanation).toContain("Battery sizing: Storage covers the evening peak.");
  });

  it("joins an array of bullets into a single string", () => {
    const result = parseOptimizePayload(
      JSON.stringify({
        explanation: ["Peak demand is in the evening.", "A battery shifts surplus into it."],
      }),
      FACTS_TEXT,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.explanation).toBe(
      "Peak demand is in the evening. A battery shifts surplus into it.",
    );
  });

  it("fails when explanation carries no usable text, so the route can 502", () => {
    for (const explanation of [{}, [], null, "   "]) {
      const result = parseOptimizePayload(JSON.stringify({ explanation }), FACTS_TEXT);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("invalid_shape");
    }
  });
});

describe("malformed input is handled, never thrown", () => {
  it("reports non-JSON without throwing", () => {
    const result = parseOptimizePayload(
      "Here is my recommendation: 5kW of solar!",
      FACTS_TEXT,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_json");
    expect(result.issues[0]?.message).toMatch(/not valid JSON/i);
  });

  it("reports a JSON array (not an object) without throwing", () => {
    const result = parseOptimizePayload('["4500 W", "8 kWh"]', FACTS_TEXT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_shape");
  });

  it("does not throw on any of these inputs", () => {
    for (const raw of ["", "null", "{}", "[]", "not json", '{"explanation":123}']) {
      expect(() => parseOptimizePayload(raw, FACTS_TEXT)).not.toThrow();
    }
  });

  it("never emits raw Zod internals in the user-facing failure message", () => {
    expect(OPTIMIZE_FAILURE_MESSAGE).not.toMatch(/invalid_type|zod|expected|received/i);
    expect(OPTIMIZE_FAILURE_MESSAGE.length).toBeGreaterThan(10);
  });
});
