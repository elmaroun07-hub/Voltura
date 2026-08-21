import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { api } from "../shared-routes";
import { z } from "zod/v4";
import { registerChatRoutes } from "../replit_integrations/chat";
import OpenAI from "openai";
import PDFDocument from "pdfkit";
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

// Fetch monthly irradiance + temperature from NASA POWER API
async function fetchNasaPower(lat: number, lon: number): Promise<{ irradiance: number[]; temperature: number[] } | null> {
  try {
    const url =
      `https://power.larc.nasa.gov/api/temporal/monthly/point` +
      `?parameters=ALLSKY_SFC_SW_DWN,T2M&community=RE` +
      `&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}` +
      `&start=2022&end=2022&format=JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data: any = await res.json();
    const param = data?.properties?.parameter;
    if (!param) return null;
    const irr = param["ALLSKY_SFC_SW_DWN"];
    const temp = param["T2M"];
    if (!irr || !temp) return null;
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const irrArr = months.map((m) => Number(irr[`2022${m}`]) || 4.0);
    const tempArr = months.map((m) => Number(temp[`2022${m}`]) || 15.0);
    return { irradiance: irrArr, temperature: tempArr };
  } catch {
    return null;
  }
}

// Fallback irradiance by latitude
function fallbackIrradiance(lat: number): { irradiance: number[]; temperature: number[] } {
  const absLat = Math.abs(lat || 45);
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerChatRoutes(app);

  // Enhanced PDF report
  app.get("/api/calculate/:id/pdf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getHistory();
      const calc = history.find((c) => c.id === id);
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
        .text("Generated by Green Energy Savings Calculator · Powered by NASA POWER irradiance data", 50, y + 10, { align: "center" });

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Main calculation endpoint
  app.post(api.calculations.create.path, async (req, res) => {
    try {
      const input = api.calculations.create.input.parse(req.body);

      // Geocode location
      const geo = await geocode(input.location);
      const lat = geo?.lat ?? 45;
      const lon = geo?.lon ?? 10;
      const countryFromGeo = geo?.country ?? input.location;

      // Detect carbon intensity from location
      const carbonIntensity = detectCarbonIntensity(countryFromGeo + " " + input.location);

      // Fetch NASA POWER data (fall back to lat-based estimate)
      let nasaData = await fetchNasaPower(lat, lon);
      let irradianceSource = "NASA POWER API";
      if (!nasaData) {
        nasaData = fallbackIrradiance(lat);
        irradianceSource = "Estimated (lat-based)";
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
    const history = await storage.getHistory();
    res.json(history);
  });

  app.post(api.calculations.optimize.path, async (req, res) => {
    try {
      const { energyPattern, location } = req.body;
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
      console.error("Optimization error:", err);
      return res.status(500).json({ message: "Failed to generate optimization" });
    }
  });

  return httpServer;
}
