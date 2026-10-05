import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { calculationInputSchema } from "@workspace/db";
import { VOLTURA_FACTS, NASA_FACT, LEGACY_CARBON_COUNTRIES } from "./facts";
import { simulate8760 } from "../../routes/routes";
import { resolveCarbonSource } from "../../lib/emissions/carbon-source";
import { COUNTRY_KEY_BY_ISO } from "../../lib/carbon-intensity";
import { loadCountries, roi, ROI_INFLATION, ROI_YEARS } from "../../lib/emissions/countries";
import { SIZING_DEFAULTS } from "../../lib/sizing";

/**
 * H-ASST-ACC TF1: every fact the Assistant is given is pinned to the code that
 * makes it true (A.1, contracts/evidence/h-asst-accuracy/a1-claims.md).
 *
 * Each pin asserts the code's behaviour AND that the sentence says it, so a
 * change on either side fails here (A-b: a pin that passes when its fact
 * changes is no pin). Behaviour is read through POST /api/calculate where a
 * route decides it, with G10's fixtures: Nominatim and NASA come from
 * routes/calculate.fixtures.json, storage is a map, any other request throws.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("../../routes/calculate.fixtures.json", import.meta.url), "utf8"),
);
// Line endings folded: a Windows checkout writes CRLF, and the pins compare code text.
const source = (repoPath: string) =>
  readFileSync(new URL(`../../../../../${repoPath}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fact = (id: string) => {
  const f = VOLTURA_FACTS.find((x) => x.id === id);
  if (!f) throw new Error(`no fact "${id}"`);
  return f.text;
};

const SESSION = "fac7fac7-7777-4777-8777-fac7fac7fac7";
const realFetch = globalThis.fetch;
const history = vi.hoisted(() => ({ asked: [] as string[] }));

vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ ...calc, id: 1 }),
    getHistory: async (sessionId: string) => {
      history.asked.push(sessionId);
      return [];
    },
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
}));

const { registerRoutes } = await import("../../routes/routes");

let nasaMode: "fixture" | "http-500" | "malformed" | "fill" | "partial" = "fixture";
let requested: string[] = [];

beforeEach(() => {
  nasaMode = "fixture";
  requested = [];
  history.asked = [];
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    requested.push(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.includes("nominatim.openstreetmap.org")) {
      const q = new URL(url).searchParams.get("q") ?? "";
      return json(fixtures[q] ? fixtures[q].nominatim : []);
    }
    if (url.includes("power.larc.nasa.gov")) {
      if (nasaMode === "http-500") return json({}, 500);
      if (nasaMode === "malformed") return json({});
      const u = new URL(url);
      const hit = Object.values(fixtures).find(
        (f) => f.lat.toFixed(4) === u.searchParams.get("latitude") && f.lon.toFixed(4) === u.searchParams.get("longitude"),
      );
      if (!hit) return json({}, 404);
      const body = structuredClone(hit.nasa);
      const irr = body.properties.parameter.ALLSKY_SFC_SW_DWN;
      const firstKey = Object.keys(irr)[0];
      if (nasaMode === "fill") irr[firstKey] = -999;
      if (nasaMode === "partial") delete irr[firstKey];
      return json(body);
    }
    throw new Error(`unexpected outbound request in test: ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  await registerRoutes(createServer(app), app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

async function calculate(body: Record<string, unknown>) {
  return withServer(async (base) => {
    const res = await realFetch(`${base}/api/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": SESSION },
      body: JSON.stringify({ location: "Fuengirola, Málaga, Spain", energyUsage: 5000, pvWattage: 4000, batteryCapacity: 10, ...body }),
    });
    return { status: res.status, body: (await res.json()) as any };
  });
}

const yearlyGeneration = (body: any) => body.monthlyData.reduce((a: number, m: any) => a + m.generationKwh, 0);
const FLAT_IRR = Array(12).fill(5);

describe("H-ASST-ACC TF1 — each fact, pinned to the code", () => {
  it("the facts module holds the thirteen lines, each with an id", () => {
    expect(VOLTURA_FACTS.map((f) => f.id)).toEqual([
      "geocoder", "nasa", "simulation", "orientation", "monthly-chart", "energy-mix",
      "carbon", "tariff", "payback", "pdf", "history", "optimizer", "assistant",
    ]);
  });

  it("geocoder: Nominatim, first match; no match is no result", async () => {
    expect(fact("geocoder")).toContain("OpenStreetMap Nominatim geocoder");
    const r = await calculate({ location: "Nowhere That Geocodes" });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("geocode_failed");
    const url = new URL(requested.find((u) => u.includes("nominatim"))!);
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("nasa: the monthly endpoint, the stated period, irradiance and temperature", async () => {
    expect(fact("nasa")).toContain(`from NASA POWER, averaged over ${NASA_FACT.start}-${NASA_FACT.end}: twelve ${NASA_FACT.resolution} values, not hourly data`);
    const r = await calculate({});
    expect(r.status).toBe(200);
    const url = new URL(requested.find((u) => u.includes("power.larc.nasa.gov"))!);
    expect(url.pathname).toContain(`/temporal/${NASA_FACT.resolution}/`);
    expect([url.searchParams.get("start"), url.searchParams.get("end")]).toEqual([`${NASA_FACT.start}`, `${NASA_FACT.end}`]);
    expect(url.searchParams.get("parameters")!.split(",")).toEqual(["ALLSKY_SFC_SW_DWN", "T2M"]);
    expect(r.body.resolution.irradiancePeriod).toEqual({ start: NASA_FACT.start, end: NASA_FACT.end });
    expect(r.body.resolution.irradianceMonthly).toHaveLength(12);
  });

  it("nasa: temperature changes the modelled consumption, never the generation", () => {
    expect(fact("nasa")).toContain("Temperature affects only the modelled household consumption, not the solar generation.");
    // Temperatures that differ by month: a uniform shift scales out against the annual kWh.
    const run = (temps: number[]) => simulate8760(5000, 4000, 10, 0.9, 1, FLAT_IRR, temps, 0.78).monthly;
    const cold = run(Array(12).fill(15)), warm = run([0, 2, 6, 10, 16, 22, 30, 31, 25, 16, 8, 2]);
    expect(cold.map((m) => m.generationKwh)).toEqual(warm.map((m) => m.generationKwh));
    expect(cold.map((m) => m.consumptionKwh)).not.toEqual(warm.map((m) => m.consumptionKwh));
  });

  it.each([
    ["fill", "nasa_fill_value"],
    ["partial", "nasa_partial_coverage"],
  ] as const)("nasa: missing data (%s) is no result - a typed 422", async (mode, code) => {
    expect(fact("nasa")).toContain("When NASA does reply but marks months as having no data, or leaves months out, there is no estimate and no result: the calculation stops with an error.");
    nasaMode = mode;
    const r = await calculate({});
    expect(r.status).toBe(422);
    expect(r.body.code).toBe(code);
    expect(r.body.savingsKwh).toBeUndefined();
  });

  it.each(["http-500", "malformed"] as const)("nasa: no usable answer (%s) -> the labelled latitude estimate", async (mode) => {
    expect(fact("nasa")).toContain(
      "The latitude estimate is used in one case only: when NASA cannot be used at all - it does not reply, replies with an error status, or sends a reply Voltura cannot read. Voltura then estimates irradiance and temperature from the latitude and labels the result as that estimate, in the API response and on the page.",
    );
    nasaMode = mode;
    const r = await calculate({});
    expect(r.status).toBe(200);
    expect(r.body.irradianceSource).toBe("fallback-lat");
    expect(r.body.resolution.irradianceSource).toBe("fallback-lat");
    expect(source("artifacts/green-energy-calculator/src/lib/provenance.ts")).toContain(
      'case "fallback-lat":\n      return "Estimated from latitude — NASA data unavailable";',
    );
  });

  it("simulation: 8,760 hours, consumption scaled to the annual kWh entered", () => {
    expect(fact("simulation")).toContain("(8,760 hours)");
    expect(fact("simulation")).toContain("spread from the annual kWh the user enters over a typical residential profile");
    let hours = 0;
    const sim = simulate8760(4321, 3000, 5, 0.9, 1, FLAT_IRR, Array(12).fill(15), 0.78, () => hours++);
    expect(hours).toBe(8760);
    expect(sim.year.consumptionKwh).toBeCloseTo(4321, 6);
  });

  it("orientation: south > east = west > north; tilt away from ~35 degrees loses output", async () => {
    expect(fact("orientation")).toContain("panel orientation (south, east, west, north) and tilt angle");
    const gen: Record<string, number> = {};
    for (const o of ["south", "east", "west", "north"]) gen[o] = yearlyGeneration((await calculate({ panelOrientation: o, roofAngle: 35 })).body);
    expect(gen.south).toBeGreaterThan(gen.east);
    expect(gen.east).toBeCloseTo(gen.west, 6);
    expect(gen.west).toBeGreaterThan(gen.north);
    const flat = yearlyGeneration((await calculate({ panelOrientation: "south", roofAngle: 0 })).body);
    expect(gen.south).toBeGreaterThan(flat);
  });

  it("battery (guideline): efficiency is an input, 50-100 %, 90 % by default; it charges only from solar", () => {
    const parsed = calculationInputSchema.parse({ location: "x y", energyUsage: 4000, pvWattage: 3000, batteryCapacity: 5 });
    expect(parsed.batteryEfficiency).toBe(0.9);
    expect(calculationInputSchema.safeParse({ ...parsed, batteryEfficiency: 0.49 }).success).toBe(false);
    expect(calculationInputSchema.safeParse({ ...parsed, batteryEfficiency: 1.01 }).success).toBe(false);
    const form = source("artifacts/green-energy-calculator/src/components/calculator/CalculatorForm.tsx");
    expect(form).toContain("batteryEfficiency: 0.9,");
    expect(form).toContain("min={0.5} max={1.0} step={0.01}");
    // No PV, no charge: the battery never delivers a kWh it did not take from solar.
    expect(simulate8760(4000, 0, 10, 0.9, 1, FLAT_IRR, Array(12).fill(15), 0.78).year.batteryDischargeKwh).toBe(0);
  });

  it("monthly-chart: exactly four series, none of them battery; savings = consumption - grid import", () => {
    expect(fact("monthly-chart")).toContain('a monthly chart with four series: Generation, Savings, Grid Import and "Surplus not used"');
    expect(fact("monthly-chart")).toContain("The monthly chart has no battery series.");
    const display = source("artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx");
    const block = display.slice(display.indexOf("const barData"), display.indexOf("}));", display.indexOf("const barData")));
    expect([...block.matchAll(/^\s+("?[A-Za-z ]+"?):\s*m\./gm)].map((m) => m[1].replace(/"/g, ""))).toEqual([
      "name", "Generation", "Savings", "Grid Import", "Surplus not used",
    ]);
    expect(block).not.toMatch(/battery/i);
    for (const m of simulate8760(5000, 4000, 10, 0.9, 1, FLAT_IRR, Array(12).fill(15), 0.78).monthly) {
      expect(Math.abs(m.savingsKwh - (m.consumptionKwh - m.gridImportKwh))).toBeLessThanOrEqual(0.11);
    }
  });

  it("energy-mix: Direct Solar, From Battery, Grid Import as shares of consumption", async () => {
    expect(fact("energy-mix")).toContain("Direct Solar, From Battery and Grid Import, as shares of consumption");
    const display = source("artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx");
    for (const n of ["Direct Solar", "From Battery", "Grid Import"]) expect(display).toContain(`{ name: "${n}", value: results.breakdown.`);
    const { body } = await calculate({});
    const { solar, battery, grid } = body.breakdown;
    expect(Math.abs(solar + battery + grid - 100)).toBeLessThanOrEqual(2);
  });

  it("carbon: the legacy list is exactly the countries that still get an unsourced factor", () => {
    expect(fact("carbon")).toContain(`${LEGACY_CARBON_COUNTRIES.slice(0, -1).join(", ")} and ${LEGACY_CARBON_COUNTRIES.at(-1)}: an older factor with no cited source`);
    const codeOf = Object.fromEntries(Object.entries(COUNTRY_KEY_BY_ISO).map(([code, key]) => [key, code]));
    expect(LEGACY_CARBON_COUNTRIES.length).toBeGreaterThan(0);
    for (const name of LEGACY_CARBON_COUNTRIES) {
      expect(resolveCarbonSource(codeOf[name.toLowerCase()], name, "x").status, name).toBe("unsourced_legacy");
    }
    expect(resolveCarbonSource("us", "United States", "Atlanta")).toEqual({ status: "unsourced_legacy", country: "United States", valueKgPerKwh: 0.386 });
    // The page shows the factor and does not say it is unsourced.
    expect(source("artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx")).not.toMatch(/unsourced/i);
    expect(fact("carbon")).toContain("which the results page does not mark as unsourced");
  });

  it.each([
    ["Fuengirola, Málaga, Spain", 200, "REE", "peninsular"],
    ["London, United Kingdom", 200, "DESNZ", "gb"],
  ] as const)("carbon: %s -> the official factor", async (location, status, authority, system) => {
    const r = await calculate({ location });
    expect(r.status).toBe(status);
    expect(r.body.resolution.carbonSource.status).toBe("sourced");
    expect(r.body.resolution.carbonSource.factor.authority).toContain(authority);
    expect(r.body.resolution.carbonSource.factor.system).toBe(system);
    expect(fact("carbon")).toContain("Spain: the official REE factor, for mainland addresses only");
    expect(fact("carbon")).toContain("United Kingdom: the official DESNZ factor.");
  });

  it.each([
    ["Palma de Mallorca, Spain", "carbon_factor_pending"],
    ["Las Palmas de Gran Canaria, Spain", "carbon_factor_pending"],
    ["Thimphu, Bhutan", "unknown_carbon_country"],
  ] as const)("carbon: %s -> the whole calculation is refused", async (location, code) => {
    const r = await calculate({ location });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(code);
    for (const k of ["savingsKwh", "money", "co2Reduction", "monthlyData"]) expect(r.body[k]).toBeUndefined();
    expect(fact("carbon")).toContain("has no factor yet and the calculation is refused");
    expect(fact("carbon")).toContain("Any other country has no factor, and the whole calculation is refused: no energy, money or CO2 result.");
  });

  it("tariff: priced only for Spain and the UK; typed wins; Spain Eurostat 2025-S2; UK none", async () => {
    const t = fact("tariff");
    expect(t).toContain("Prices the saving only for Spain and the UK.");
    expect(t).toContain("With no tariff typed, Spain uses Eurostat's 2025-S2 national household average while that figure is current. The UK has no national tariff in Voltura, so a UK saving is priced only when the user types a tariff.");
    expect(t).toContain("For any other country there is no money figure, even if the user types a tariff.");
    const [spain, uk] = ["spain", "united kingdom"].map((k) => loadCountries().find((c) => c.key === k)!);
    expect(spain.tariff.status).toBe("current");
    if (spain.tariff.status === "current") {
      expect(spain.tariff.authority).toBe("Eurostat");
      expect(spain.tariff.period.label).toBe("2025-S2");
    }
    expect(uk.tariff.status).toBe("pending");
    expect((await calculate({ location: "Tétouan, Morocco", electricityTariff: 0.3 })).body.money).toMatchObject({ currency: null, annualSavings: null });
    expect((await calculate({ location: "London, United Kingdom" })).body.money).toMatchObject({ annualSavings: null, tariff: { status: "pending" } });
    expect((await calculate({ location: "London, United Kingdom", electricityTariff: 0.25 })).body.money.tariff).toMatchObject({ status: "used", source: "user" });
    expect((await calculate({ electricityTariff: 0.3 })).body.money.tariff).toMatchObject({ status: "used", source: "user" });
    expect((await calculate({})).body.money.tariff).toMatchObject({ status: "used", source: "registry", label: "Eurostat 2025-S2" });
  });

  it("payback: typed cost in Spain/UK; UK registry PV-only cost to 10 kW, not with a battery; Spain none", async () => {
    const p = fact("payback");
    expect(p).toContain(`a ${ROI_YEARS}-year ROI curve (savings rising ${Math.round(ROI_INFLATION * 1000) / 10}% a year)`);
    expect(p).toContain("Spain has no sourced installation cost yet.");
    expect(p).toContain("in the UK only, DESNZ's average cost for PV-only systems up to 10 kW, which is not used when a battery is included");
    const [spain, uk] = ["spain", "united kingdom"].map((k) => loadCountries().find((c) => c.key === k)!);
    expect(spain.installCost.status).toBe("pending");
    expect(uk.installCost.status).toBe("current");
    if (uk.installCost.status === "current" && uk.installCost.kind === "banded") {
      expect(Math.max(...uk.installCost.bands.map((b) => b.toKw))).toBe(10);
    } else throw new Error("UK install cost must be banded");
    const curve = roi({ amount: 1000, currency: "EUR" }, { amount: 5000, currency: "EUR" }).curve;
    expect(curve).toHaveLength(ROI_YEARS + 1);
    expect((curve[3].cumulativeSavings - curve[2].cumulativeSavings) / (curve[2].cumulativeSavings - curve[1].cumulativeSavings)).toBeCloseTo(1 + ROI_INFLATION, 2);
    const ukPv = await calculate({ location: "London, United Kingdom", electricityTariff: 0.25, batteryCapacity: 0 });
    expect(ukPv.body.money.installCost).toMatchObject({ status: "used", source: "registry_band" });
    expect(ukPv.body.money.roi.status).toBe("computed");
    expect((await calculate({ location: "London, United Kingdom", electricityTariff: 0.25, batteryCapacity: 5 })).body.money.installCost)
      .toMatchObject({ status: "pending", reason: "battery_not_in_registry_cost" });
    expect((await calculate({ location: "London, United Kingdom", electricityTariff: 0.25, batteryCapacity: 0, pvWattage: 12000 })).body.money.installCost)
      .toMatchObject({ status: "pending", reason: "size_outside_registry_bands" });
    const es = await calculate({ batteryCapacity: 0 });
    expect(es.body.money.installCost).toMatchObject({ status: "pending", reason: "registry_cost_pending" });
    expect(es.body.money.roi.status).toBe("pending");
    expect((await calculate({ installationCost: 9200 })).body.money.roi.status).toBe("computed");
  });

  it("pdf: inputs, result rows and the monthly table; no charts", () => {
    expect(fact("pdf")).toContain("the result figures and the monthly table. The installation cost is not printed, and the PDF has no charts.");
    const routes = source("artifacts/api-server/src/routes/routes.ts");
    const handler = routes.slice(routes.indexOf('app.get("/api/calculate/:id/pdf"'), routes.indexOf("app.post(api.calculations.create.path"));
    for (const h of ['text("Summary"', 'text("Results"', 'text("Monthly Breakdown"']) expect(handler).toContain(h);
    expect(handler).not.toMatch(/\.image\(|\.path\(|bezierCurveTo|\.polygon\(/);
  });

  it("history: an id kept in this browser, sent as X-Session-Id; no accounts", async () => {
    expect(fact("history")).toContain("The calculations themselves are stored on Voltura's server; this browser keeps only a random id that links it to them.");
    const qc = source("artifacts/green-energy-calculator/src/lib/queryClient.ts");
    expect(qc).toContain('const SESSION_ID_KEY = "voltura.sessionId";');
    expect(qc).toContain("sessionId = crypto.randomUUID();");
    expect(qc).toContain("localStorage.setItem(SESSION_ID_KEY, sessionId);");
    await withServer(async (base) => {
      const res = await realFetch(`${base}/api/history`, { headers: { "X-Session-Id": "browser-a" } });
      expect(res.status).toBe(200);
    });
    expect(history.asked).toEqual(["browser-a"]);
  });

  it("optimizer: a fixed standard profile, a formula at 100 % annual parity, the AI writes prose", () => {
    const o = fact("optimizer");
    expect(o).toContain("using a fixed standard daily usage profile, not the user's own");
    expect(o).toContain(`so its yearly generation equals ${SIZING_DEFAULTS.coverageTarget * 100}% of yearly use`);
    const page = source("artifacts/green-energy-calculator/src/pages/Optimizer.tsx");
    expect([...page.matchAll(/energyPattern:/g)]).toHaveLength(1);
    expect(page).toContain("energyPattern: DEFAULT_PATTERN,");
    expect(page).not.toMatch(/set(Energy)?Pattern|useState\(DEFAULT_PATTERN/);
  });
});
