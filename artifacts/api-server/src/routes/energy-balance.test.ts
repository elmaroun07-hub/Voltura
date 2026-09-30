import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

/**
 * H-D8D52 — measure the battery, account for the surplus.
 *
 * The hourly engine used to record neither what the battery delivered (D8: the
 * donut's "From Battery" was an algebraic formula, 0 in every case measured at
 * fc04551) nor the PV it could not absorb (D52: dropped, while "Generated"
 * still counted it). These tests pin the recorded flows:
 *
 *   T1  supply, every hour:  generation = PV direct + PV into battery + surplus
 *   T2  demand, every hour:  load = PV direct + battery delivered + grid import
 *   T3  battery ledger:      losses where the dispatch puts them; SoC reconciles
 *   T4  monthly and yearly:  the same identities on the sums; year = sum of months
 *   T5  D8, at the Optimizer's Fuengirola sizing: From Battery > 0, from recorded sums
 *   T6  money pin: identical to the unmodified engine (captured at fc04551)
 *
 * T7 (old rows in the PDF) is in pdf-report.test.ts, next to its PDF reader.
 *
 * G10: no network. The route cases are served from calculate.fixtures.json;
 * any other outbound request throws.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("./calculate.fixtures.json", import.meta.url), "utf8"),
);

const realFetch = globalThis.fetch;

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ ...calc, id: 7001 }),
    getHistory: async () => [],
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
}));

const routes: any = await import("./routes");
const { registerRoutes } = routes;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    if (url.includes("nominatim.openstreetmap.org")) {
      const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      return json(fixtures[q] ? fixtures[q].nominatim : []);
    }
    if (url.includes("power.larc.nasa.gov")) {
      const u = new URL(url);
      const hit = Object.values(fixtures).find(
        (f) => f.lat.toFixed(4) === u.searchParams.get("latitude") && f.lon.toFixed(4) === u.searchParams.get("longitude"),
      );
      return hit ? json(structuredClone(hit.nasa)) : json({}, 404);
    }
    throw new Error(`unexpected outbound request in test: ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

async function calculate(body: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  await registerRoutes(createServer(app), app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    const { port } = server.address() as AddressInfo;
    const res = await realFetch(`http://127.0.0.1:${port}/api/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Session-Id": "e8e8e8e8-8888-4888-8888-e8e8e8e8e8e8" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

// ── The engine, directly ─────────────────────────────────────────────────────

// Synthetic test inputs, not claims: a Mediterranean-shaped year of daily
// irradiance (kWh/m²/day) and temperatures (°C). The identities must hold for
// any input; the regimes below make every branch of the dispatch run.
const IRR = [2.73, 3.55, 4.79, 5.86, 6.73, 7.31, 7.39, 6.62, 5.37, 4.02, 2.95, 2.35];
const TEMP = [12.5, 13.1, 14.9, 16.8, 19.9, 23.6, 26.3, 26.8, 23.9, 20.1, 16.2, 13.4];

const REGIMES = [
  { name: "Optimizer-sized: battery cycles, summer surplus", usage: 5000, pvW: 3391, battKwh: 4.1, rte: 0.9 },
  { name: "small PV, battery rarely charged", usage: 5000, pvW: 1500, battKwh: 5, rte: 0.9 },
  { name: "no battery: every surplus kWh is lost", usage: 5000, pvW: 3391, battKwh: 0, rte: 0.9 },
  { name: "large PV, very large battery", usage: 5000, pvW: 8000, battKwh: 50, rte: 0.95 },
  { name: "heavy losses (RTE 0.5, the input minimum)", usage: 4000, pvW: 6000, battKwh: 10, rte: 0.5 },
];

const TOL = 1e-9;
const FLOWS = ["generationKwh", "consumptionKwh", "pvDirectKwh", "batteryChargeKwh", "surplusKwh", "batteryDischargeKwh", "gridImportKwh", "storedKwh", "drawnKwh"] as const;

function run(r: (typeof REGIMES)[number]) {
  const hours: { month: number; h: any }[] = [];
  const sim = routes.simulate8760(r.usage, r.pvW, r.battKwh, r.rte, 1.0, IRR, TEMP, 0.78, (month: number, h: any) =>
    hours.push({ month, h }),
  );
  return { sim, hours };
}

describe("H-D8D52 — the engine records every kWh", () => {
  it.each(REGIMES)("T1 supply, every hour: generation = PV direct + PV into battery + surplus ($name)", (r) => {
    const { hours } = run(r);
    expect(hours).toHaveLength(8760);
    for (const { h } of hours) {
      expect(Math.abs(h.generationKwh - (h.pvDirectKwh + h.batteryChargeKwh + h.surplusKwh))).toBeLessThanOrEqual(TOL);
      for (const f of FLOWS) expect(h[f]).toBeGreaterThanOrEqual(-TOL);
    }
    // Every regime but the smallest has surplus to account for — the branch D52 is about.
    if (r.pvW >= 3391) expect(hours.some(({ h }) => h.surplusKwh > 0.01)).toBe(true);
  });

  it.each(REGIMES)("T2 demand, every hour: load = PV direct + battery delivered + grid import ($name)", (r) => {
    const { hours } = run(r);
    for (const { h } of hours) {
      expect(Math.abs(h.consumptionKwh - (h.pvDirectKwh + h.batteryDischargeKwh + h.gridImportKwh))).toBeLessThanOrEqual(TOL);
    }
    if (r.battKwh > 0) expect(hours.some(({ h }) => h.batteryDischargeKwh > 0.01)).toBe(true);
  });

  it.each(REGIMES)("T3 battery ledger: losses where the dispatch puts them, and the state of charge reconciles ($name)", (r) => {
    const { sim, hours } = run(r);
    const eff = Math.sqrt(r.rte); // the engine splits the round trip evenly, charge side and discharge side
    let soc = sim.socStartKwh;
    expect(soc).toBe(0);
    for (const { h } of hours) {
      // The charge loss is taken on the way in, the discharge loss on the way out.
      expect(Math.abs(h.storedKwh - h.batteryChargeKwh * eff)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(h.batteryDischargeKwh - h.drawnKwh * eff)).toBeLessThanOrEqual(TOL);
      soc += h.storedKwh - h.drawnKwh;
      expect(Math.abs(h.socKwh - soc)).toBeLessThanOrEqual(1e-6);
      expect(h.socKwh).toBeLessThanOrEqual(r.battKwh + TOL);
      expect(h.socKwh).toBeGreaterThanOrEqual(-TOL);
    }
    // Whole year: energy in, minus both losses, minus energy out, is the change in charge.
    const y = sim.year;
    const chargeLoss = y.batteryChargeKwh - y.storedKwh;
    const dischargeLoss = y.drawnKwh - y.batteryDischargeKwh;
    expect(Math.abs(y.storedKwh - y.batteryChargeKwh * eff)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(y.batteryDischargeKwh - y.drawnKwh * eff)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(y.batteryChargeKwh - chargeLoss - dischargeLoss - y.batteryDischargeKwh - (sim.socEndKwh - sim.socStartKwh))).toBeLessThanOrEqual(1e-6);
  });

  it.each(REGIMES)("T4 monthly and yearly sums: Generated = self-consumed + stored + surplus; the year is the sum of its months ($name)", (r) => {
    const { sim } = run(r);
    expect(sim.months).toHaveLength(12);
    for (const m of sim.months) {
      expect(Math.abs(m.generationKwh - (m.pvDirectKwh + m.batteryChargeKwh + m.surplusKwh))).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(m.consumptionKwh - (m.pvDirectKwh + m.batteryDischargeKwh + m.gridImportKwh))).toBeLessThanOrEqual(1e-6);
    }
    for (const f of FLOWS) {
      const sum = sim.months.reduce((a: number, m: any) => a + m[f], 0);
      expect(Math.abs(sim.year[f] - sum)).toBeLessThanOrEqual(1e-6);
    }
    // Display rounding, stated separately: every field of `monthly` is its exact
    // monthly sum rounded to 0.1 kWh, so a displayed row balances within 4 × 0.05.
    sim.monthly.forEach((row: any, i: number) => {
      for (const f of ["generationKwh", "consumptionKwh", "gridImportKwh", "pvDirectKwh", "batteryChargeKwh", "batteryDischargeKwh", "surplusKwh"]) {
        expect(row[f]).toBe(parseFloat(sim.months[i][f].toFixed(1)));
      }
      expect(Math.abs(row.generationKwh - (row.pvDirectKwh + row.batteryChargeKwh + row.surplusKwh))).toBeLessThanOrEqual(0.2 + TOL);
    });
  });
});

// ── Through the route, on the Fuengirola fixture ─────────────────────────────

const FUENGIROLA = "Fuengirola, Málaga, Spain";

describe("H-D8D52 — the mix is measured (D8)", () => {
  it("T5 at the Optimizer's sizing (3,391 W / 4.1 kWh / 5,000 kWh), From Battery > 0, and every slice is a recorded share", async () => {
    const { status, body } = await calculate({ location: FUENGIROLA, energyUsage: 5000, pvWattage: 3391, batteryCapacity: 4.1 });
    expect(status).toBe(200);
    expect(body.breakdown.battery).toBeGreaterThan(0);
    const sum = (f: string) => body.monthlyData.reduce((a: number, m: any) => a + m[f], 0);
    const cons = sum("consumptionKwh");
    // Each slice is its recorded annual sum as a share of consumption, rounded to
    // a whole percent. The monthly values carry 0.1 kWh rounding, hence 0.6.
    expect(Math.abs(body.breakdown.solar - (100 * sum("pvDirectKwh")) / cons)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(body.breakdown.battery - (100 * sum("batteryDischargeKwh")) / cons)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(body.breakdown.grid - (100 * sum("gridImportKwh")) / cons)).toBeLessThanOrEqual(0.6);
  });
});

// Captured from the unmodified engine at fc04551 (the code of production ff44a9c),
// through this same route and fixture. A pin, not failing-first evidence: it
// passes before and after. If any figure moves, dispatch changed (F-d) — stop.
const PINS: { name: string; body: Record<string, unknown>; regime: ">=" | "<"; pin: Record<string, unknown> }[] = [
  { name: "Optimizer sizing, €6,000", regime: "<", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 3391, batteryCapacity: 4.1, installationCost: 6000 },
    pin: { savingsKwh: 3476, co2Reduction: 299, annualSavings: 927.85, currency: "EUR", paybackYears: 6.2, lifetimeSavings: 27894, generationKwh: 4808.8 } },
  { name: "small system, €4,000", regime: "<", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 1500, batteryCapacity: 5, installationCost: 4000 },
    pin: { savingsKwh: 2080, co2Reduction: 179, annualSavings: 555.21, currency: "EUR", paybackYears: 6.9, lifetimeSavings: 16691, generationKwh: 2127.1 } },
  { name: "never paid back, €200,000", regime: "<", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 3391, batteryCapacity: 4.1, installationCost: 200000 },
    pin: { savingsKwh: 3476, co2Reduction: 299, annualSavings: 927.85, currency: "EUR", paybackYears: null, lifetimeSavings: 27894, generationKwh: 4808.8 } },
  { name: "large system, generation above usage, €12,000", regime: ">=", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 6000, batteryCapacity: 10, installationCost: 12000 },
    pin: { savingsKwh: 4471, co2Reduction: 385, annualSavings: 1193.2, currency: "EUR", paybackYears: 9.4, lifetimeSavings: 35871, generationKwh: 8508.7 } },
  { name: "no battery, €5,000", regime: "<", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 3391, batteryCapacity: 0, installationCost: 5000 },
    pin: { savingsKwh: 2474, co2Reduction: 213, annualSavings: 660.39, currency: "EUR", paybackYears: 7.2, lifetimeSavings: 19853, generationKwh: 4808.8 } },
  { name: "London, user tariff 0.28, £7,000", regime: "<", body: { location: "London, United Kingdom", energyUsage: 4000, pvWattage: 4000, batteryCapacity: 5, electricityTariff: 0.28, installationCost: 7000 },
    pin: { savingsKwh: 2392, co2Reduction: 313, annualSavings: 669.73, currency: "GBP", paybackYears: 9.8, lifetimeSavings: 20134, generationKwh: 3410.8 } },
  { name: "form defaults, ROI pending", regime: ">=", body: { location: FUENGIROLA, energyUsage: 5000, pvWattage: 4000, batteryCapacity: 10 },
    pin: { savingsKwh: 3860, co2Reduction: 333, annualSavings: 1030.34, currency: "EUR", paybackYears: null, lifetimeSavings: null, generationKwh: 5672.5 } },
];

describe("H-D8D52 — T6, the money does not move (F-d)", () => {
  it.each(PINS)("$name", async ({ body, regime, pin }) => {
    const { status, body: res } = await calculate(body);
    expect(status).toBe(200);
    const gen = parseFloat(res.monthlyData.reduce((a: number, m: any) => a + m.generationKwh, 0).toFixed(1));
    // The fixture set covers both regimes; check each case is in the one it claims.
    expect(regime === ">=" ? gen >= (body.energyUsage as number) : gen < (body.energyUsage as number)).toBe(true);
    expect({
      savingsKwh: res.savingsKwh,
      co2Reduction: res.co2Reduction,
      annualSavings: res.money.annualSavings,
      currency: res.money.currency,
      paybackYears: res.money.roi.status === "computed" ? res.money.roi.paybackYears : null,
      lifetimeSavings: res.money.roi.status === "computed" ? res.money.roi.lifetimeSavings : null,
      generationKwh: gen,
    }).toEqual(pin);
  });
});
