import { describe, expect, it } from "vitest";
import {
  IndexInputError,
  METHOD_V1,
  ageBand,
  computeReferences,
  quantile,
  scoreBuilding,
  type BuildingInputs,
} from "./heat-index";

const census = { over64: 0.2, onePersonHouseholds: 25, households: 100, unemployment: 0.2 };
const base: BuildingInputs = {
  ref: "X",
  dwellings: 1,
  year: 1960,
  hsolHorizontal: 235.31,
  streetKwhPerMetre: 1000,
  perimeterM: 40,
  certificate: null,
  census,
};

/** A small municipality whose medians are easy to read off. */
const town: BuildingInputs[] = [
  { ...base, ref: "A", certificate: { entries: 1, median: 20, min: 20, max: 20 } },
  { ...base, ref: "B", certificate: { entries: 1, median: 30, min: 30, max: 30 } },
  { ...base, ref: "C", certificate: { entries: 1, median: 40, min: 40, max: 40 } },
  { ...base, ref: "D", year: 1990, certificate: { entries: 1, median: 25, min: 25, max: 25 } },
  { ...base, ref: "E" },
];

/**
 * Certificate values for the cap. The 1,000 puts the cap (p99 ≈ 961.6) far
 * above every value these tests use, so only the cap's own tests see it bind.
 */
const VALUES = [20, 30, 40, 25, 1000];

describe("ageBand — thermal-regulation eras", () => {
  it("splits at NBE-CT-79 (1980) and CTE DB-HE (2007)", () => {
    expect([1979, 1980, 2006, 2007, null].map(ageBand)).toEqual(["pre-1980", "1980-2006", "1980-2006", "2007-on", null]);
  });
});

describe("quantile — type 7", () => {
  it("interpolates linearly between order statistics", () => {
    expect(quantile([20, 30, 40], 0.5)).toBe(30);
    expect(quantile([20, 30, 40], 0.1)).toBeCloseTo(22, 10);
    expect(quantile([20, 30, 40], 0.9)).toBeCloseTo(38, 10);
    expect(() => quantile([], 0.5)).toThrow(IndexInputError);
  });
});

describe("computeReferences", () => {
  const r = computeReferences(town, VALUES);

  it("builds the cooling prior from certified buildings, by age band", () => {
    expect(r.coolingPrior["pre-1980"]).toMatchObject({ low: 22, mid: 30, high: 38, n: 3 });
    expect(r.coolingPrior["1980-2006"]).toMatchObject({ low: 25, mid: 25, high: 25, n: 1 });
    // No certified 2007-on building: that band is the all-buildings prior, flagged n = 0.
    expect(r.coolingPrior["2007-on"].n).toBe(0);
    expect(r.coolingPrior["2007-on"].mid).toBe(r.coolingPrior.all.mid);
  });

  it("medians: E (uncertified, pre-1980) sits at its band's median, 30", () => {
    expect(r.median.coolingDemand).toBe(30); // [20, 25, 30, 30, 40]
    expect(r.median.hsolHorizontal).toBe(235.31);
    expect(r.median.facadeIrradiationPerMetre).toBe(25);
  });

  it("refuses a municipality with no certified building or no census", () => {
    expect(() => computeReferences([{ ...base }], [])).toThrow(/no certified/);
    expect(() => computeReferences([{ ...base, census: null, certificate: { entries: 1, median: 1, min: 1, max: 1 } }], [1])).toThrow(/census/);
  });
});

describe("the certificate cap — a data-entry error cannot carry a building to the top", () => {
  // 100 certificates 1..100 → p99 (type 7) = 99.01.
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const r = computeReferences(town, values);

  it("is the 99th percentile of every certificate value", () => {
    expect(r.coolingCap).toEqual({ value: expect.closeTo(99.01, 9), certificates: 100 });
  });

  it("a 1,592 kWh/m² certificate counts as the cap, and is flagged", () => {
    const wild = scoreBuilding({ ...base, ref: "W", dwellings: 16, certificate: { entries: 5, median: 16.37, min: 15.85, max: 1592.18 } }, r);
    const atCap = scoreBuilding({ ...base, ref: "K", dwellings: 16, certificate: { entries: 5, median: 16.37, min: 15.85, max: r.coolingCap.value } }, r);
    expect(wild.index.high).toBeCloseTo(atCap.index.high, 12);
    expect(wild.completeness.certificateCapped).toBe(true);
    expect(atCap.completeness.certificateCapped).toBe(false);
  });
});

describe("scoreBuilding", () => {
  const r = computeReferences(town, VALUES);

  it("a typical building scores 1.0 with every factor at 1", () => {
    const s = scoreBuilding({ ...base, ref: "T", certificate: { entries: 1, median: 30, min: 30, max: 30 } }, r);
    for (const f of Object.values(s.factors)) expect(f.mid).toBeCloseTo(1, 12);
    expect(s.index).toEqual({ low: expect.closeTo(1, 12), mid: expect.closeTo(1, 12), high: expect.closeTo(1, 12) });
  });

  it("weights are risk thirds: doubling cooling demand multiplies the index by 2^(1/3)", () => {
    const s = scoreBuilding({ ...base, ref: "T", certificate: { entries: 1, median: 60, min: 60, max: 60 } }, r);
    expect(s.index.mid).toBeCloseTo(2 ** (1 / 3), 12);
    expect(METHOD_V1.weights).toEqual({ hazard: 1 / 6, exposure: 1 / 6, sensitivity: 1 / 3, people: 1 / 3 });
  });

  it("exposure is half roof (constant) and half façade: no exposed façade gives 0.5, not 0", () => {
    const s = scoreBuilding({ ...base, ref: "T", streetKwhPerMetre: 0 }, r);
    expect(s.factors.exposure.mid).toBe(0.5);
    expect(s.index.mid).toBeGreaterThan(0);
  });

  it("a fully certified dwelling has a zero-width cooling band", () => {
    const s = scoreBuilding(town[0], r);
    expect(s.factors.sensitivity.low).toBe(s.factors.sensitivity.high);
    expect(s.completeness.certificateCoverage).toBe(1);
  });

  it("an uncertified building carries its age band's p10–p90", () => {
    const s = scoreBuilding(town[4], r);
    expect(s.factors.sensitivity).toEqual({ low: 22 / 30, mid: 1, high: 38 / 30 });
    expect(s.completeness).toMatchObject({ certificateCoverage: 0, coolingPrior: "pre-1980" });
  });

  it("one certified unit of four narrows the band by a quarter, not to a point", () => {
    const s = scoreBuilding({ ...base, ref: "T", dwellings: 4, certificate: { entries: 1, median: 40, min: 40, max: 40 } }, r);
    const lowKwh = 0.25 * 40 + 0.75 * 22;
    const highKwh = 0.25 * 40 + 0.75 * 38;
    expect(s.factors.sensitivity.low).toBeCloseTo(lowKwh / 30, 12);
    expect(s.factors.sensitivity.high).toBeCloseTo(highKwh / 30, 12);
    expect(s.completeness.certificateCoverage).toBe(0.25);
  });

  it("no census section: people takes the municipal p10–p90, and says so", () => {
    const s = scoreBuilding({ ...town[4], census: null }, r);
    expect(s.factors.people).toEqual(r.peoplePrior);
    expect(s.completeness.censusSection).toBe(false);
  });

  it("no year and no certificate: the all-buildings prior", () => {
    const s = scoreBuilding({ ...town[4], year: null }, r);
    expect(s.completeness.coolingPrior).toBe("all");
    expect(s.completeness.constructionYear).toBe(false);
  });

  it("low ≤ mid ≤ high for every building", () => {
    for (const b of [...town, { ...town[4], census: null, year: null }]) {
      const s = scoreBuilding(b, r);
      expect(s.index.low).toBeLessThanOrEqual(s.index.mid);
      expect(s.index.mid).toBeLessThanOrEqual(s.index.high);
    }
  });

  it("refuses inputs that cannot be scored rather than defaulting them", () => {
    expect(() => scoreBuilding({ ...base, perimeterM: 0 }, r)).toThrow(IndexInputError);
    expect(() => scoreBuilding({ ...base, certificate: { entries: 1, median: 50, min: 60, max: 70 } }, r)).toThrow(IndexInputError);
    expect(() => scoreBuilding({ ...base, dwellings: 0, certificate: { entries: 1, median: 30, min: 30, max: 30 } }, r)).toThrow(IndexInputError);
  });

  it("never names itself a grade, a rating or a compliance result (P7)", () => {
    const text = JSON.stringify(scoreBuilding(town[0], r)) + JSON.stringify(METHOD_V1);
    expect(text).not.toMatch(/grade|rating|compliance/i);
  });
});
