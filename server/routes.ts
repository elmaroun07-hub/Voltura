import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerChatRoutes } from "./replit_integrations/chat";
import OpenAI from "openai";
import PDFDocument from "pdfkit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register AI Chat Routes
  registerChatRoutes(app);

  app.get("/api/calculate/:id/pdf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getHistory();
      const calc = history.find(c => c.id === id);
      
      if (!calc) {
        return res.status(404).json({ message: "Calculation not found" });
      }

      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=energy-report-${id}.pdf`);
      doc.pipe(res);

      doc.fontSize(25).text("Green Energy Savings Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(16).text(`Location: ${calc.location}`);
      doc.text(`Date: ${calc.createdAt?.toLocaleDateString()}`);
      doc.moveDown();
      
      doc.fontSize(18).text("Input Data:");
      doc.fontSize(14).text(`Annual Energy Usage: ${calc.energyUsage} kWh`);
      doc.text(`PV System Size: ${calc.pvWattage} Watts`);
      doc.text(`Battery Capacity: ${calc.batteryCapacity} kWh`);
      doc.moveDown();

      doc.fontSize(18).text("Calculation Results:");
      doc.fontSize(14).text(`Annual Energy Savings: ${calc.savingsKwh} kWh`);
      doc.text(`CO2 Emissions Reduced: ${calc.co2Reduction} kg`);
      doc.text(`Computation Carbon Footprint: ${calc.carbonFootprint} mg CO2`);
      doc.moveDown();

      doc.fontSize(12).text("This report was generated using the Green Energy Optimizer AI-powered sustainability tool.", { oblique: true });
      
      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.post(api.calculations.create.path, async (req, res) => {
    try {
      const startTime = Date.now();
      const input = api.calculations.create.input.parse(req.body);
      
      // Simple Solar Physics Model - Vectorized approach
      // Using an array-based calculation for annual generation to optimize loop-like logic
      const PEAK_SUN_HOURS = 4.5;
      const SYSTEM_EFFICIENCY = 0.75;
      const DAYS_IN_YEAR = 365;
      const CO2_FACTOR = 0.4; // kg per kWh
      
      const generationArray = new Float64Array(DAYS_IN_YEAR).fill((input.pvWattage / 1000) * PEAK_SUN_HOURS * SYSTEM_EFFICIENCY);
      const annualGenerationKwh = generationArray.reduce((acc, val) => acc + val, 0);
      
      const usableEnergyKwh = Math.min(annualGenerationKwh, input.energyUsage);
      const co2Reduction = Math.round(usableEnergyKwh * CO2_FACTOR);
      
      const dailyConsumption = input.energyUsage / 365;
      const dayUsageArray = new Float64Array(DAYS_IN_YEAR).fill(dailyConsumption * 0.4);
      const batteryUtilizedArray = generationArray.map((gen, i) => Math.min(Math.max(0, gen - dayUsageArray[i]), input.batteryCapacity));
      const additionalSavedKwh = batteryUtilizedArray.reduce((acc, val) => acc + val, 0);
      
      const totalSavedKwh = Math.min(input.energyUsage, usableEnergyKwh + additionalSavedKwh);
      const solarPercentage = Math.round((totalSavedKwh / input.energyUsage) * 100);
      
      // Carbon tracking for the computation (simulated CodeCarbon)
      const durationMs = Date.now() - startTime;
      const cpuPowerWatts = 50; // Average server CPU power
      const carbonIntensity = 0.4; // g CO2/kWh
      const carbonMg = Math.round((durationMs / 1000 / 3600) * cpuPowerWatts * carbonIntensity * 1000);

      const result = {
        savingsKwh: Math.round(totalSavedKwh),
        co2Reduction: Math.round(co2Reduction),
        carbonFootprint: carbonMg,
        recommendation: solarPercentage > 100 
          ? "Your system produces more energy than you need! Consider selling back to the grid."
          : `You can offset ${solarPercentage}% of your energy usage.`,
        breakdown: {
          solar: solarPercentage,
          grid: 100 - solarPercentage,
          battery: Math.round((additionalSavedKwh / input.energyUsage) * 100)
        }
      };

      // Store calculation
      await storage.createCalculation({
        ...input,
        savingsKwh: result.savingsKwh,
        co2Reduction: result.co2Reduction,
        carbonFootprint: result.carbonFootprint,
        renewableMix: { solar: result.breakdown.solar, wind: 0 }
      });

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.calculations.history.path, async (req, res) => {
    const history = await storage.getHistory();
    res.json(history);
  });

  app.post(api.calculations.optimize.path, async (req, res) => {
    try {
      const { energyPattern, location } = req.body;
      
      // Use AI to optimize
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: "You are an expert energy consultant. Analyze the energy usage pattern and location to recommend optimal solar and battery sizing. Return JSON."
          },
          {
            role: "user",
            content: `Location: ${location}. 24h Energy Pattern (kWh): ${JSON.stringify(energyPattern)}. Recommend optimal PV size (Watts) and Battery (kWh) for max ROI.`
          }
        ],
        response_format: { type: "json_object" }
      });

      const recommendation = JSON.parse(response.choices[0].message.content || "{}");
      
      // Fallback if AI fails to return structure
      const optimalPv = recommendation.optimal_pv_watts || 5000;
      const optimalBattery = recommendation.optimal_battery_kwh || 10;
      
      res.json({
        optimalPv,
        optimalBattery,
        roiYears: 7.5, // Simplified estimate
        explanation: recommendation.explanation || "Based on your high evening usage, a battery is recommended."
      });
    } catch (err) {
      console.error("Optimization error:", err);
      res.status(500).json({ message: "Failed to generate optimization" });
    }
  });

  return httpServer;
}
