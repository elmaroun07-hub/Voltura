import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { api } from "../shared-routes";
import { z } from "zod/v4";
import { registerChatRoutes } from "../replit_integrations/chat";
import OpenAI from "openai";
import PDFDocument from "pdfkit";
import rateLimit from "express-rate-limit";
import { parseOptimizePayload, OPTIMIZE_FAILURE_MESSAGE } from "./optimize-payload";
import { CARBON_INTENSITY_BY_COUNTRY, type MonthlyEntry } from "@workspace/db";

// Mistral exposes an OpenAI-compatible API, so we reuse the openai SDK
// pointed at api.mistral.ai. Lazy init: server boots even if the key is
// missing; only the AI endpoints fail, with a clear error.
let _mistral: OpenAI | null = null;
function getMistral(): OpenAI {
  if (_mistral) return _mistral;
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not configured.");
  _mistral = new OpenAI({ apiKey, baseURL: "https://api.mistral.ai/v1" });
  return _mistral;
}
export const MISTRAL_MODEL = "mistral-small-latest";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

// Typical residential monthly weight (normalised, sum=1)
const MONTHLY_CONSUMPTION_WEIGHTS = [
  0.103, 0.094, 0.091, 0.082, 0.076, 0.072,
  0.074, 0.076, 0.079, 0.086, 0.093, 0.094,
];

// Hourly solar production profile (fraction of daily output)
const SOLAR_HOURLY_PROFILE: number[] = (() => {
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (h < 6 || h > 20) return 0;
    return Math.exp(-0.5 * Math.pow((h - 12) / 3.5, 2));
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
})();

// Hourly consumption profile (fraction of daily consumption)
const CONSUMPTION_HOURLY_PROFILE = [
  0.024, 0.020, 0.018, 0.017, 0.018, 0.025,
  0.045, 0.060, 0.055, 0.045, 0.042, 0.040,
  0.042, 0.040, 0.042, 0.048, 0.058, 0.075,
  0.082, 0.072, 0.058, 0.048, 0.040, 0.034,
];

// ML consumption prediction: [month,hour,irradiance,temp] → kWh
function mlPredictConsumption(month: number, hour: number, irradiance: number, temp: number): number {
  const seasonFactor = 1 + 0.25 * Math.cos((month * Math.PI) / 6);
  const hourFactor = CONSUMPTION_HOURLY_PROFILE[hour] * 24;
  const tempEffect = 1 + 0.012 * Math.max(0, 25 - temp) + 0.010 * Math.max(0, temp - 28);
  const lightingReduction = irradiance > 0.2 ? 0.08 : 0;
  return 0.5 * seasonFactor * hourFactor * tempEffect * (1 - lightingReduction);
}

// Tilt + orientation efficiency multiplier
function panelEfficiencyFactor(roofAngle: number, orientation: string): number {
  const orientationFactor: Record<string, number> = { south: 1.0, east: 0.87, west: 0.87, north: 0.70 };
  const oFactor = orientationFactor[orientation] ?? 1.0;
  // Optimal tilt ≈ 35°; penalty for deviation
  const tiltDelta = Math.abs(roofAngle - 35);
  const tiltFactor = 1 - 0.003 * tiltDelta;
  return Math.max(0.4, oFactor * tiltFactor);
}

// Detect carbon intensity from location string
function detectCarbonIntensity(location: string): number {
  const loc = location.toLowerCase();
  for (const [country, intensity] of Object.entries(CARBON_INTENSITY_BY_COUNTRY)) {
    if (loc.includes(country)) return intensity;
  }
  return 0.4; // global average fallback
}

// Geocode location string to lat/lon via Nominatim
async function geocode(location: string): Promise<{ lat: number; lon: number; country: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=1&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GreenEnergyCalculator/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      country: data[0].address?.country ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * NASA POWER keys monthly data YYYYMM. The previous code built `2022${m}` from
 * ["JAN","FEB",...], so every one of the twelve lookups missed, and the
 * `|| 4.0` / `|| 15.0` defaults on the read supplied fabricated values for
 * every location on Earth while the response still reported live NASA data.
 *
 * The month list is explicit and is never read off the response: NASA appends
 * YYYY13 as the annual mean, so Object.keys() would yield thirteen entries and
 * a wrong annual figure.
 */
const NASA_MONTH_KEYS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

/**
 * NASA POWER's documented fill value for a month it has no data for.
 *
 * It is FINITE, so `Number.isFinite` — the only guard this code had — accepts
 * it, and -999 flows through as though it were an irradiance reading. H1.0.
 *
 * Compared exactly, not by threshold. A threshold like `v < -900` would be a
 * guess about values NASA has never documented, and P2 forbids guessing.
 * Physically impossible readings are rejected separately below, by physics
 * rather than by sentinel-hunting.
 */
const NASA_FILL_VALUE = -999;

/**
 * The irradiance period. 2022 alone is a single year, not a climate normal,
 * and a single anomalous year moves a euro figure a user reads. H1.8.
 *
 * A parameter with a stated default, per the block's own constraint — never
 * hardcoded at a call site. The period actually used is reported in the
 * response, because the number means nothing without it.
 */
const NASA_PERIOD_START = 2019;
const NASA_PERIOD_END = 2023;

/**
 * Why a read fails, in the caller's terms.
 *
 * `fill-value` and `partial-coverage` are DATA defects: NASA answered, and the
 * answer cannot support a number. They become a typed error and no figure at
 * all — never a substitution, which is the whole of H1.0.
 *
 * `http`, `request-failed` and `malformed` are TRANSPORT defects: NASA did not
 * answer. Those keep the existing labelled latitude fallback, which is not a
 * silent default — it is reported as `fallback-lat` and rendered as such.
 * H1.0 is about the fill value; widening it to kill the transport fallback
 * would be a different change and is not taken here.
 */
type NasaFailure =
  | { kind: "http"; status: number }
  | { kind: "request-failed" }
  | { kind: "malformed"; status: number }
  | { kind: "non-finite-value"; parameter: string; keys: string[] }
  | { kind: "fill-value"; parameter: string; keys: string[] }
  | {
      kind: "partial-coverage";
      parameter: string;
      missing: string[];
      yearsRequested: number;
      monthsExpected: number;
      monthsPresent: number;
    };

type NasaProbe = {
  httpStatus: number | "not-called" | "request-failed";
  keysRequested: string[];
  keysPresent: string[];
  period: { start: number; end: number } | null;
  data: { irradiance: number[]; temperature: number[] } | null;
  failure: NasaFailure | null;
};

/**
 * Read one NASA parameter across the whole period and return the twelve
 * monthly means — or the reason it cannot.
 *
 * This is THE parse boundary (A11). Every value NASA sends is filtered here,
 * once, on the way in. Guarding at a call site was the rejected design: it
 * leaves every other call site open, which is exactly how `-999` survived.
 *
 * Three rejections, all typed and none substituting. Two are FATAL to the
 * request; the third is not, and the difference is deliberate:
 *
 *   1. absent key   -> partial coverage. FATAL. A mean over three years when
 *                      five were requested, reported as five, is the `4.0`
 *                      defect wearing a different constant. A11's named
 *                      failure mode for 1.8, and the likelier one.
 *   2. the fill value -> FATAL. H1.0. NASA answered "I have no data for this
 *                      month" in a finite number, and no figure can be built
 *                      on it.
 *   3. non-finite   -> NOT fatal. null, "", {} and friends: the key is there
 *                      and the value is garbage. That is a malformed response,
 *                      which the existing design already answers with the
 *                      labelled latitude fallback and reports as
 *                      `fallback-lat`. Gate A3.5 pins that behaviour and it is
 *                      not H1.0's to change - H1.0 is about the fill value.
 *                      Promoting this to a hard error would silently retire a
 *                      tested honesty guarantee under cover of a different task.
 */
function readNasaSeries(
  raw: Record<string, unknown>,
  parameter: string,
  years: number[],
): { values: number[] } | { failure: NasaFailure } {
  const monthlyMeans: number[] = [];
  const missing: string[] = [];
  const fillHits: string[] = [];
  const nonFinite: string[] = [];
  let monthsPresent = 0;

  for (const mm of NASA_MONTH_KEYS) {
    const perYear: number[] = [];

    for (const year of years) {
      const key = `${year}${mm}`;
      if (!(key in raw)) { missing.push(key); continue; }

      // Type first, and NEVER Number() before this check.
      //
      // Number(null) === 0 and Number("") === 0. Both are finite, so a
      // Number.isFinite guard accepts them and a month NASA sent as null
      // becomes 0 kWh/m2/day - a plausible-looking winter reading that no
      // instrument produced. The old code only escaped this because its test
      // deleted keys, making Number(undefined) NaN; a null in a live response
      // would have sailed straight through.
      //
      // This is the same defect as `|| 4.0`, one coercion further down.
      const rawValue = raw[key];
      const isNumeric =
        typeof rawValue === "number" ||
        (typeof rawValue === "string" && rawValue.trim() !== "");
      if (!isNumeric) { nonFinite.push(key); continue; }

      const value = Number(rawValue);
      if (value === NASA_FILL_VALUE) { fillHits.push(key); continue; }
      if (!Number.isFinite(value)) { nonFinite.push(key); continue; }

      perYear.push(value);
      monthsPresent++;
    }

    // Only reached when nothing was rejected; the guards below fire first.
    if (perYear.length > 0) {
      monthlyMeans.push(perYear.reduce((a, b) => a + b, 0) / perYear.length);
    }
  }

  // Fill value first: it is the most specific diagnosis, and a response
  // carrying -999 usually carries missing keys too. Reporting "partial
  // coverage" for what is really a fill value would send the next reader
  // hunting the wrong defect.
  if (fillHits.length > 0) {
    return { failure: { kind: "fill-value", parameter, keys: fillHits.slice(0, 6) } };
  }

  // Non-finite before partial coverage, for the same reason: "the value is
  // garbage" is a sharper finding than "some months are absent", and this one
  // is not fatal.
  if (nonFinite.length > 0) {
    return { failure: { kind: "non-finite-value", parameter, keys: nonFinite.slice(0, 6) } };
  }

  const monthsExpected = NASA_MONTH_KEYS.length * years.length;
  if (missing.length > 0 || monthsPresent !== monthsExpected) {
    return {
      failure: {
        kind: "partial-coverage",
        parameter,
        missing: missing.slice(0, 6),
        yearsRequested: years.length,
        monthsExpected,
        monthsPresent,
      },
    };
  }

  return { values: monthlyMeans.map((v) => parseFloat(v.toFixed(4))) };
}

async function fetchNasaPower(
  lat: number,
  lon: number,
  period: { start: number; end: number } = { start: NASA_PERIOD_START, end: NASA_PERIOD_END },
): Promise<NasaProbe> {
  const years: number[] = [];
  for (let y = period.start; y <= period.end; y++) years.push(y);

  // The first three month keys of the period, in the order NASA returns them.
  // Compared against keysPresent to prove our YYYYMM format still matches the
  // response shape - that comparison is what caught the YYYYMON mismatch, so
  // the two lists must stay directly comparable.
  const keysRequested = NASA_MONTH_KEYS.slice(0, 3).map((mm) => `${period.start}${mm}`);
  const miss = (
    httpStatus: number | "not-called" | "request-failed",
    failure: NasaFailure,
    keysPresent: string[] = [],
  ): NasaProbe => ({ httpStatus, keysRequested, keysPresent, period: null, data: null, failure });

  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/monthly/point` +
      `?parameters=ALLSKY_SFC_SW_DWN,T2M&community=RE` +
      `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
      `&start=${period.start}&end=${period.end}&format=JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    // An out-of-range period is rejected rather than filled - the monthly
    // endpoint answers "Your end date out of range". That arrives here as a
    // non-2xx and stays a transport failure, which is correct: we asked for
    // something that does not exist, so there is nothing to report a period on.
    if (!res.ok) return miss(res.status, { kind: "http", status: res.status });
    const data: any = await res.json();
    const param = data?.properties?.parameter;
    if (!param) return miss(res.status, { kind: "malformed", status: res.status });
    const irr = param["ALLSKY_SFC_SW_DWN"];
    const temp = param["T2M"];
    if (!irr || !temp) return miss(res.status, { kind: "malformed", status: res.status });

    // Object.keys is deliberate and must NOT be rewritten to
    // monthKeys.filter((k) => k in irr). This field's job is to report the
    // shape the response actually arrived in, including a shape we did not
    // anticipate; built from the keys we expected it would have returned []
    // when the YYYYMM/YYYYMON mismatch was live, which is the evidence that
    // found that defect. Diagnostic only - never feeds a calculated number.
    const keysPresent = Object.keys(irr).slice(0, 3);

    // Every parameter through the same boundary. Guarding irradiance and not
    // temperature would leave -999 reaching the consumption model.
    const irrRead = readNasaSeries(irr, "ALLSKY_SFC_SW_DWN", years);
    if ("failure" in irrRead) return miss(res.status, irrRead.failure, keysPresent);
    const tempRead = readNasaSeries(temp, "T2M", years);
    if ("failure" in tempRead) return miss(res.status, tempRead.failure, keysPresent);

    return {
      httpStatus: res.status,
      keysRequested,
      keysPresent,
      period: { start: period.start, end: period.end },
      data: { irradiance: irrRead.values, temperature: tempRead.values },
      failure: null,
    };
  } catch {
    // A request was issued and no HTTP response came back.
    return miss("request-failed", { kind: "request-failed" });
  }
}

// Fallback irradiance by latitude
export function fallbackIrradiance(lat: number): { irradiance: number[]; temperature: number[] } {
  // Was `Math.abs(lat || 45)`. `||` is falsy-coalescing, so it also fired at
  // latitude 0 and silently moved the equator to 45 degrees north. Deleted, not
  // replaced: this function receives a real latitude or it is not called.
  if (!Number.isFinite(lat)) {
    throw new Error(`fallbackIrradiance received a non-finite latitude: ${lat}`);
  }
  const absLat = Math.abs(lat);
  const baseIrr = Math.max(2.5, 6.5 - absLat * 0.06);
  const irradiance = MONTH_NAMES.map((_, i) => {
    const seasonalFactor = 1 + 0.45 * Math.cos(((i + 6) * Math.PI) / 6);
    return parseFloat((baseIrr * seasonalFactor).toFixed(2));
  });
  const temperature = [3,4,8,12,17,21,23,22,18,13,7,3].map((t) => t + (15 - absLat) * 0.3);
  return { irradiance, temperature };
}

// 8760-hour annual battery simulation
function simulate8760(
  annualKwh: number,
  pvWattage: number,
  batteryCapacityKwh: number,
  batteryEfficiency: number,
  panelFactor: number,
  irradianceMonthly: number[],
  temperatureMonthly: number[],
  systemEfficiency: number
): MonthlyEntry[] {
  const chargeEff = Math.sqrt(batteryEfficiency);
  const dischargeEff = Math.sqrt(batteryEfficiency);
  let soc = 0; // state of charge in kWh

  const monthly: MonthlyEntry[] = MONTH_NAMES.map((name, m) => ({
    month: m + 1,
    name,
    generationKwh: 0,
    consumptionKwh: 0,
    savingsKwh: 0,
    gridImportKwh: 0,
    co2Kg: 0,
  }));

  // Compute total predicted consumption to scale to actual annual usage
  let totalPredicted = 0;
  for (let m = 0; m < 12; m++) {
    for (let d = 0; d < DAYS_IN_MONTH[m]; d++) {
      for (let h = 0; h < 24; h++) {
        const irrH = irradianceMonthly[m] * SOLAR_HOURLY_PROFILE[h];
        totalPredicted += mlPredictConsumption(m, h, irrH, temperatureMonthly[m]);
      }
    }
  }
  const consumptionScale = annualKwh / (totalPredicted || 1);

  for (let m = 0; m < 12; m++) {
    const dailyIrr = irradianceMonthly[m];
    const temp = temperatureMonthly[m];
    let mGen = 0, mCons = 0, mGrid = 0;

    for (let d = 0; d < DAYS_IN_MONTH[m]; d++) {
      for (let h = 0; h < 24; h++) {
        const irrH = dailyIrr * SOLAR_HOURLY_PROFILE[h];
        const genH = (pvWattage / 1000) * irrH * systemEfficiency * panelFactor;
        const consH = mlPredictConsumption(m, h, irrH, temp) * consumptionScale;

        mGen += genH;
        mCons += consH;

        const net = genH - consH;
        if (net > 0) {
          const chargeAmount = Math.min(net * chargeEff, batteryCapacityKwh - soc);
          soc += chargeAmount;
        } else {
          const needed = -net;
          const fromBattery = Math.min(needed, soc * dischargeEff);
          soc -= fromBattery / dischargeEff;
          mGrid += Math.max(0, needed - fromBattery);
        }
      }
    }

    monthly[m].generationKwh = parseFloat(mGen.toFixed(1));
    monthly[m].consumptionKwh = parseFloat(mCons.toFixed(1));
    monthly[m].gridImportKwh = parseFloat(mGrid.toFixed(1));
    monthly[m].savingsKwh = parseFloat(Math.max(0, mCons - mGrid).toFixed(1));
  }

  return monthly;
}

/**
 * /api/optimize is one of only two routes that spend money on a paid API, and
 * it was open. Conservative on purpose: a single Mistral completion per request,
 * and no legitimate visitor runs the optimizer ten times in a quarter hour.
 * Keyed on IP by the library default - no custom key generator, no store, no
 * bypass list.
 */
const optimizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many optimization requests. Please try again later." },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerChatRoutes(app);

  // Enhanced PDF report
  //
  // Session-scoped since H-S (finding F2). This route previously read no header
  // and took a sequential integer, so /api/calculate/1/pdf, /2/pdf, /3/pdf
  // walked every calculation ever made and rendered location, usage, PV size,
  // battery, tariff and roof angle for each. No id was needed at all - not a
  // replay of someone's session, an enumeration oracle.
  app.get("/api/calculate/:id/pdf", async (req, res) => {
    try {
      // Header only, same as every other session-carrying route. Absent means
      // reject before any lookup: 400 says the request was malformed, and says
      // nothing about whether the row exists.
      // Header only, same as every other session-carrying route. Absent means
      // reject before any lookup: 400 says the request was malformed, and says
      // nothing about whether the row exists.
      const sessionId = req.get("x-session-id");
      if (!sessionId) { res.status(400).json({ message: "X-Session-Id header is required" }); return; }

      const id = parseInt(req.params.id);
      // Scoped lookup. "Not yours" and "does not exist" collapse to the same
      // undefined inside the query, so the 404 below cannot confirm a row
      // exists. A 403 here would have re-opened exactly the oracle this closes.
      const calc = await storage.getCalculationById(id, sessionId);
      if (!calc) { res.status(404).json({ message: "Calculation not found" }); return; }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=energy-report-${id}.pdf`);
      doc.pipe(res);

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill("#10b981");
      doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
        .text("Green Energy Savings Report", 50, 25, { align: "center" });
      doc.fillColor("#d1fae5").fontSize(11)
        .text(`Generated: ${new Date().toLocaleDateString("en-GB", { day:"numeric",month:"long",year:"numeric" })}`, 50, 52, { align: "center" });
      doc.fillColor("#1f2937").moveDown(3);

      // Summary section
      doc.fontSize(14).font("Helvetica-Bold").text("Summary", 50, 100);
      doc.moveTo(50, 118).lineTo(doc.page.width - 50, 118).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.5);

      const summaryRows = [
        ["Location", calc.location],
        ["Annual Energy Usage", `${calc.energyUsage.toLocaleString()} kWh`],
        ["PV System Size", `${calc.pvWattage.toLocaleString()} W`],
        ["Battery Capacity", `${calc.batteryCapacity} kWh`],
        ["Battery Efficiency", `${((calc.batteryEfficiency ?? 0.9) * 100).toFixed(0)}%`],
        ["Electricity Tariff", `€${(calc.electricityTariff ?? 0.25).toFixed(2)}/kWh`],
        ["Panel Orientation", calc.panelOrientation],
        ["Roof Angle", `${calc.roofAngle}°`],
      ];

      let y = 130;
      summaryRows.forEach(([label, value], i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 22).fill("#f9fafb");
        doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text(label, 58, y + 6);
        doc.fillColor("#111827").font("Helvetica-Bold").text(value, 0, y + 6, { align: "right", width: doc.page.width - 70 });
        y += 22;
      });

      doc.moveDown(1);
      y += 10;

      // Results section
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1f2937").text("Results", 50, y);
      y += 20;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e5e7eb").stroke();
      y += 12;


      // Payback + lifetime for PDF — read persisted values for an exact match to the app.



      const annualSav = calc.annualSavingsEur ?? 0;

      let pdfPayback: string;
      let pdfLifetimeSav: number;
      if (calc.paybackYears != null && calc.lifetimeSavingsEur != null) {
        pdfPayback = annualSav > 0 ? calc.paybackYears.toFixed(1) : "N/A";
        pdfLifetimeSav = Math.round(calc.lifetimeSavingsEur);
      } else {
        const instCost = calc.installationCostEur
          ?? ((calc.pvWattage / 1000) * 900 + calc.batteryCapacity * 500 + 1200);
        const INFLATION = 0.015;
        const YEARS = 25;
        let cumulative = 0;
        let lifetime = 0;
        let payback = YEARS;
        let paid = false;
        for (let y = 0; y <= YEARS; y++) {
          if (y === YEARS) lifetime = cumulative;
          const yearSavings = annualSav * Math.pow(1 + INFLATION, y);
          if (!paid && cumulative < instCost && cumulative + yearSavings >= instCost) {
            payback = parseFloat((y + (instCost - cumulative) / yearSavings).toFixed(1));
            paid = true;
          }
          cumulative += yearSavings;
        }
        pdfPayback = annualSav > 0 ? payback.toFixed(1) : "N/A";
        pdfLifetimeSav = annualSav > 0 ? Math.round(lifetime) : 0;
      }



      const resultRows = [
        ["Annual Energy Saved", `${(calc.savingsKwh ?? 0).toLocaleString()} kWh`, "#10b981"],
        ["Annual Cost Savings", `€${annualSav.toFixed(0)}`, "#10b981"],
        ["Estimated Payback Period", `${pdfPayback} years`, "#2563eb"],
        ["Est. 25-Year Net Gain", `€${pdfLifetimeSav.toLocaleString()}`, "#2563eb"],
        ["CO₂ Emissions Reduced", `${(calc.co2Reduction ?? 0).toLocaleString()} kg`, "#059669"],
        ["Trees Equivalent", `${Math.round((calc.co2Reduction ?? 0) / 20)} trees/year`, "#059669"],
      ];

      resultRows.forEach(([label, value, color], i) => {
        if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 22).fill("#f0fdf4");
        doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text(label, 58, y + 6);
        doc.fillColor(color).font("Helvetica-Bold").text(value, 0, y + 6, { align: "right", width: doc.page.width - 70 });
        y += 22;
      });

      y += 20;

      // Monthly breakdown table
      if (calc.monthlyData && (calc.monthlyData as MonthlyEntry[]).length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1f2937").text("Monthly Breakdown", 50, y);
        y += 20;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#e5e7eb").stroke();
        y += 8;

        const colW = (doc.page.width - 100) / 5;
        const headers = ["Month", "Generated", "Consumed", "Saved", "Grid Import"];
        headers.forEach((h, i) => {
          doc.rect(50 + i * colW, y, colW, 20).fill("#10b981");
          doc.fillColor("white").fontSize(9).font("Helvetica-Bold").text(h, 54 + i * colW, y + 6, { width: colW - 4 });
        });
        y += 20;

        (calc.monthlyData as MonthlyEntry[]).forEach((row, i) => {
          if (i % 2 === 0) doc.rect(50, y, doc.page.width - 100, 18).fill("#f9fafb");
          const cells = [row.name, `${row.generationKwh} kWh`, `${row.consumptionKwh} kWh`, `${row.savingsKwh} kWh`, `${row.gridImportKwh} kWh`];
          cells.forEach((cell, j) => {
            doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(cell, 54 + j * colW, y + 5, { width: colW - 4 });
          });
          y += 18;
        });
      }

      // Footer
      y += 30;
      doc.rect(50, y, doc.page.width - 100, 1).fill("#e5e7eb");
      doc.fillColor("#9ca3af").fontSize(9).font("Helvetica")
        // No irradiance claim here, in either direction. This footer renders a
        // persisted calculations row, and that row carries no provenance - no
        // source, no year - so the PDF cannot know whether the figures came
        // from NASA or from the latitude fallback. Naming a year it cannot
        // verify would read as a verified fact on the artefact most likely to
        // be forwarded onward. Silence is the honest option until the row can
        // carry the fact.
        .text("Generated by Green Energy Savings Calculator", 50, y + 10, { align: "center" });

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Main calculation endpoint
  app.post(api.calculations.create.path, async (req, res) => {
    try {
      // Header only: never defaulted, never generated server-side, never taken
      // from the body. Absent means reject, before any work is done.
      const sessionId = req.get("x-session-id");
      if (!sessionId) {
        return res.status(400).json({ message: "X-Session-Id header is required" });
      }

      const input = api.calculations.create.input.parse(req.body);

      // Geocode location. A failure used to fall through to lat 45, lon 10 -
      // northern Italy - and produce a complete, confident result computed from
      // a location the user never asked about, with nothing on screen saying so.
      // Some requests that used to "succeed" now fail here. That is the point.
      const geo = await geocode(input.location);
      if (!geo) {
        // Provenance matters most at the moment a request cannot be served.
        return res.status(422).json({
          message:
            "We could not locate that place. Check the spelling, or try including the country - for example \"Madrid, Spain\".",
          code: "geocode_failed",
          field: "location",
          resolution: {
            locationInput: input.location,
            geocodeStatus: "failed" as const,
            lat: null,
            lon: null,
            irradianceSource: "not-reached" as const,
            irradiancePeriod: null,
            nasaHttpStatus: "not-called" as const,
            nasaKeysRequested: [],
            nasaKeysPresent: [],
            irradianceMonthly: [],
          },
        });
      }

      const lat = geo.lat;
      const lon = geo.lon;
      const countryFromGeo = geo.country;

      // Detect carbon intensity from location
      const carbonIntensity = detectCarbonIntensity(countryFromGeo + " " + input.location);

      // Fetch NASA POWER data (fall back to lat-based estimate)
      const nasaProbe = await fetchNasaPower(lat, lon);

      // H1.0 / H1.8. A data defect is fatal to the request: NASA answered and
      // the answer cannot carry a number, so no number is produced. Not a
      // fallback, not a shorter mean quietly relabelled - a typed error and
      // nothing else. Substituting here is the defect this block removes.
      const f = nasaProbe.failure;
      if (f && (f.kind === "fill-value" || f.kind === "partial-coverage")) {
        const detail =
          f.kind === "fill-value"
            ? `NASA POWER returned its ${NASA_FILL_VALUE} fill value for ${f.parameter} at ${f.keys.join(", ")}. No irradiance figure can be computed for this location.`
            : `NASA POWER covered ${f.monthsPresent} of ${f.monthsExpected} months for ${f.parameter} over ${f.yearsRequested} year(s)${f.missing.length ? ` (missing ${f.missing.join(", ")})` : ""}. A mean over fewer years than requested would misstate the period.`;

        return res.status(422).json({
          message: detail,
          code: f.kind === "fill-value" ? "nasa_fill_value" : "nasa_partial_coverage",
          field: "location",
          resolution: {
            locationInput: input.location,
            geocodeStatus: "resolved" as const,
            lat,
            lon,
            irradianceSource: "not-reached" as const,
            irradiancePeriod: null,
            nasaHttpStatus: nasaProbe.httpStatus,
            nasaKeysRequested: nasaProbe.keysRequested,
            nasaKeysPresent: nasaProbe.keysPresent,
            irradianceMonthly: [],
          },
        });
      }

      let nasaData = nasaProbe.data;
      let irradiancePeriod = nasaProbe.period;
      let irradianceSource: "nasa-live" | "fallback-lat" = "nasa-live";
      if (!nasaData) {
        // Transport failure only - NASA did not answer. Labelled, never silent.
        nasaData = fallbackIrradiance(lat);
        irradianceSource = "fallback-lat";
        irradiancePeriod = null;
      }

      const { irradiance: irrMonthly, temperature: tempMonthly } = nasaData;
      const avgIrradiance = parseFloat((irrMonthly.reduce((a, b) => a + b, 0) / 12).toFixed(2));

      const panelFactor = panelEfficiencyFactor(input.roofAngle, input.panelOrientation);
      const SYSTEM_EFFICIENCY = 0.78;

      // 8760-hour simulation
      const monthlyData = simulate8760(
        input.energyUsage,
        input.pvWattage,
        input.batteryCapacity,
        input.batteryEfficiency,
        panelFactor,
        irrMonthly,
        tempMonthly,
        SYSTEM_EFFICIENCY
      );

      // Totals from simulation
      const totalSavingsKwh = monthlyData.reduce((a, m) => a + m.savingsKwh, 0);
      const totalGridKwh = monthlyData.reduce((a, m) => a + m.gridImportKwh, 0);
      const totalGenKwh = monthlyData.reduce((a, m) => a + m.generationKwh, 0);
      const annualCo2Reduction = parseFloat((totalSavingsKwh * carbonIntensity).toFixed(1));
      const annualSavingsEur = parseFloat((totalSavingsKwh * input.electricityTariff).toFixed(2));

      // Enrich monthly CO2
      monthlyData.forEach((m) => {
        m.co2Kg = parseFloat((m.savingsKwh * carbonIntensity).toFixed(1));
      });

      // Energy breakdown percentages
      const solarDirect = Math.max(0, Math.min(input.energyUsage, totalGenKwh) - Math.max(0, totalGenKwh - input.batteryCapacity * 365 * 0.3));
      const solarPct = Math.round((totalSavingsKwh / input.energyUsage) * 100);
      const batteryPct = Math.max(0, solarPct - Math.round((Math.min(totalGenKwh, input.energyUsage) / input.energyUsage) * 100));
      const gridPct = Math.max(0, 100 - solarPct);

      // Recommendation
      let recommendation = "";
      if (solarPct >= 100) {
        recommendation = `Excellent! Your ${input.pvWattage}W system fully covers your usage and generates surplus energy worth €${(annualSavingsEur * 0.1).toFixed(0)} in potential grid export.`;
      } else if (solarPct >= 70) {
        recommendation = `Great result! Your system covers ${solarPct}% of your energy, saving €${annualSavingsEur.toFixed(0)}/year. A slightly larger battery could push you closer to 100%.`;
      } else {
        recommendation = `Your system offsets ${solarPct}% of your energy usage, saving €${annualSavingsEur.toFixed(0)}/year. Consider increasing PV capacity to ${Math.round(input.pvWattage * 1.5)}W for better coverage.`;
      }

      // ROI curve: auto-estimate installation cost if not provided
      // Solar panels ~€900/kWp + battery ~€500/kWh + inverter/install €1,200 fixed
      const estimatedCost = Math.round(
        (input.pvWattage / 1000) * 900 +
        input.batteryCapacity * 500 +
        1200
      );
      const installationCostEur = (input.installationCostEur != null && input.installationCostEur > 0)
        ? input.installationCostEur
        : estimatedCost;

      // 1.5% annual electricity price inflation
      const INFLATION = 0.015;
      const YEARS = 25;
      const roiCurve: { year: number; cumulativeSavings: number; netPosition: number }[] = [];
      let cumulative = 0;
      let paybackYears = YEARS; // default if never paid back within 25y
      for (let y = 0; y <= YEARS; y++) {
        roiCurve.push({
          year: y,
          cumulativeSavings: parseFloat(cumulative.toFixed(0)),
          netPosition: parseFloat((cumulative - installationCostEur).toFixed(0)),
        });
        // next year savings with inflation
        const yearSavings = annualSavingsEur * Math.pow(1 + INFLATION, y);
        if (cumulative < installationCostEur && cumulative + yearSavings >= installationCostEur) {
          const fraction = (installationCostEur - cumulative) / yearSavings;
          paybackYears = parseFloat((y + fraction).toFixed(1));
        }
        cumulative += yearSavings;
      }

      // Provenance record. Not debug logging - it stays in the response body so a
      // user-facing number can say where its inputs came from.
      const resolution = {
        locationInput: input.location,
        geocodeStatus: "resolved" as const,
        lat: parseFloat(lat.toFixed(4)),
        lon: parseFloat(lon.toFixed(4)),
        irradianceSource,
        irradiancePeriod,
        nasaHttpStatus: nasaProbe.httpStatus,
        nasaKeysRequested: nasaProbe.keysRequested,
        nasaKeysPresent: nasaProbe.keysPresent,
        irradianceMonthly: irrMonthly,
      };

      const result = {
        savingsKwh: Math.round(totalSavingsKwh),
        co2Reduction: Math.round(annualCo2Reduction),
        annualSavingsEur,
        carbonIntensity,
        avgIrradiance,
        irradianceSource,
        recommendation,
        breakdown: {
          solar: Math.max(0, solarPct - batteryPct),
          battery: batteryPct,
          grid: gridPct,
        },
        monthlyData,
        installationCostEur,
        paybackYears,
        roiCurve,
        resolution,
      };

      await storage.createCalculation({
        location: input.location,
        energyUsage: input.energyUsage,
        pvWattage: input.pvWattage,
        batteryCapacity: input.batteryCapacity,
        electricityTariff: input.electricityTariff,
        batteryEfficiency: input.batteryEfficiency,
        panelOrientation: input.panelOrientation,
        roofAngle: input.roofAngle,
        savingsKwh: result.savingsKwh,
        co2Reduction: result.co2Reduction,
        annualSavingsEur: result.annualSavingsEur,
        renewableMix: { solar: result.breakdown.solar + result.breakdown.battery, wind: 0 },
        monthlyData,
        installationCostEur: result.installationCostEur,
        paybackYears: result.paybackYears,
        lifetimeSavingsEur: roiCurve[roiCurve.length - 1].cumulativeSavings,
        sessionId,
      });

      return res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message, field: err.issues[0].path.join(".") });
      }
      console.error("Calculation error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.calculations.history.path, async (req, res) => {
    const sessionId = req.get("x-session-id");
    if (!sessionId) {
      return res.status(400).json({ message: "X-Session-Id header is required" });
    }

    const history = await storage.getHistory(sessionId);
    return res.json(history);
  });

  app.post(api.calculations.optimize.path, optimizeLimiter, async (req, res) => {
    try {
      const { energyPattern, location } = api.calculations.optimize.input.parse(req.body);
      const response = await getMistral().chat.completions.create({
        model: MISTRAL_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert energy consultant. Analyze the energy usage pattern and location to recommend optimal solar and battery sizing. Return JSON with exactly these keys: optimal_pv_watts (a number), optimal_battery_kwh (a number), explanation (a single plain string of prose). The explanation MUST be a string — never an object, never an array, never nested.",
          },
          {
            role: "user",
            content: `Location: ${location}. 24h Energy Pattern (kWh): ${JSON.stringify(energyPattern)}. Recommend optimal PV size (Watts) and Battery (kWh) for max ROI.`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const rawContent = response.choices[0].message.content || "{}";

      // Coerce + validate at the boundary; never echo the model payload straight
      // out. Zod detail goes to the logs, the client gets readable prose only.
      const result = parseOptimizePayload(rawContent);

      if (!result.ok) {
        console.error(
          "[optimize] malformed model payload — reason:",
          result.reason,
          "| raw:",
          rawContent,
          "| issues:",
          JSON.stringify(result.issues),
        );
        return res.status(502).json({
          message: OPTIMIZE_FAILURE_MESSAGE,
          code: "invalid_model_response",
        });
      }

      return res.json(result.data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0].message, field: err.issues[0].path.join(".") });
      }
      console.error("Optimization error:", err);
      return res.status(500).json({ message: "Failed to generate optimization" });
    }
  });

  return httpServer;
}
