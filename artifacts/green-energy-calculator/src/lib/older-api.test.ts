import { describe, expect, it } from "vitest";
import { api } from "./api";
import { monthlyBars } from "./chart-data";

/**
 * #7 deploy order: Render deploys the web and the API independently. A fresh web
 * page can reach an API from before H-D8D52, whose monthly rows lack the four
 * recorded flows. The page must then render the calculation, and must draw no
 * surplus series, never a surplus of 0 (D6 family).
 */
const month = (n: number) => ({
  month: n,
  name: "Jan",
  generationKwh: 400,
  consumptionKwh: 420,
  savingsKwh: 300,
  gridImportKwh: 120,
  co2Kg: 25,
});

const olderApiResponse = () => ({
  id: 7,
  savingsKwh: 3860,
  co2Reduction: 333,
  carbonIntensity: 0.086,
  avgIrradiance: 5.1,
  irradianceSource: "nasa-live",
  recommendation: "Great result!",
  breakdown: { solar: 40, grid: 40, battery: 20 },
  monthlyData: Array.from({ length: 12 }, (_, i) => month(i + 1)),
  money: {
    currency: null,
    tariff: { status: "pending", reason: "country_not_in_registry", detail: "x" },
    annualSavings: null,
    installCost: { status: "pending", reason: "country_not_in_registry", detail: "x" },
    roi: { status: "pending", detail: "x" },
  },
  resolution: {
    locationInput: "Madrid",
    geocodeStatus: "resolved",
    lat: 40.4,
    lon: -3.7,
    irradianceSource: "nasa-live",
    irradiancePeriod: { start: 2022, end: 2022 },
    nasaHttpStatus: 200,
    nasaKeysRequested: [],
    nasaKeysPresent: [],
    irradianceMonthly: [],
    carbonSource: { status: "not_reached" },
  },
});

describe("#7 — a response from an API older than H-D8D52", () => {
  const schema = api.calculations.create.responses[200];

  it("is accepted although its monthly rows lack pvDirectKwh, batteryChargeKwh, batteryDischargeKwh, surplusKwh", () => {
    const r = schema.safeParse(olderApiResponse());
    expect(r.success).toBe(true);
  });

  it("draws no surplus series, and never a surplus of 0", () => {
    const parsed = schema.parse(olderApiResponse());
    const { data, hasSurplus } = monthlyBars(parsed.monthlyData, (m) => `m${m}`);
    expect(hasSurplus).toBe(false);
    for (const row of data) {
      expect(row.surplus).toBeUndefined();
      expect(row.generation).toBe(400);
    }
  });

  it("still draws the surplus when the API sends the flows", () => {
    const body = olderApiResponse();
    body.monthlyData = body.monthlyData.map((m) => ({ ...m, pvDirectKwh: 200, batteryChargeKwh: 50, batteryDischargeKwh: 40, surplusKwh: 12.5 })) as any;
    const parsed = schema.parse(body);
    const { data, hasSurplus } = monthlyBars(parsed.monthlyData, (m) => `m${m}`);
    expect(hasSurplus).toBe(true);
    expect(data.every((r) => r.surplus === 12.5)).toBe(true);
  });
});
