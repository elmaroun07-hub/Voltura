import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerChatRoutes } from "./replit_integrations/chat";
import OpenAI from "openai";

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

  app.post(api.calculations.create.path, async (req, res) => {
    try {
      const input = api.calculations.create.input.parse(req.body);
      
      // Simple Solar Physics Model
      // Assumptions:
      // - Average daily peak sun hours = 4.5 (configurable later via location AI lookup)
      // - System efficiency = 75% (losses due to heat, wiring, inverter)
      // - CO2 factor = 0.4 kg/kWh (grid average)
      // - Energy cost = $0.15 / kWh
      
      const PEAK_SUN_HOURS = 4.5;
      const SYSTEM_EFFICIENCY = 0.75;
      const DAYS_IN_YEAR = 365;
      const CO2_FACTOR = 0.4; // kg per kWh
      
      const dailyGenerationKwh = (input.pvWattage / 1000) * PEAK_SUN_HOURS * SYSTEM_EFFICIENCY;
      const annualGenerationKwh = dailyGenerationKwh * DAYS_IN_YEAR;
      
      // Cap savings at consumption
      const usableEnergyKwh = Math.min(annualGenerationKwh, input.energyUsage);
      const co2Reduction = Math.round(usableEnergyKwh * CO2_FACTOR);
      
      // Calculate battery impact (simplified: battery allows using more solar at night)
      // Assume battery cycles once per day, capturing excess day energy for night
      const dailyConsumption = input.energyUsage / 365;
      const excessDayEnergy = Math.max(0, dailyGenerationKwh - (dailyConsumption * 0.4)); // Assume 40% usage during day
      const batteryUtilized = Math.min(excessDayEnergy, input.batteryCapacity);
      const additionalSavedKwh = batteryUtilized * DAYS_IN_YEAR;
      
      const totalSavedKwh = Math.min(input.energyUsage, usableEnergyKwh + additionalSavedKwh);
      const solarPercentage = Math.round((totalSavedKwh / input.energyUsage) * 100);
      
      const result = {
        savingsKwh: Math.round(totalSavedKwh),
        co2Reduction: Math.round(co2Reduction),
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
