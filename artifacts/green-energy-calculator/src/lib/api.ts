import { z } from "zod";

export const calculationInputSchema = z.object({
  location: z.string().min(2, "Please enter a valid location"),
  energyUsage: z.number().min(100).max(100000),
  pvWattage: z.number().min(100).max(100000),
  batteryCapacity: z.number().min(0).max(200),
  electricityTariff: z.number().min(0.01).max(5).default(0.25),
  batteryEfficiency: z.number().min(0.5).max(1.0).default(0.9),
  panelOrientation: z.enum(["north", "south", "east", "west"]).default("south"),
  roofAngle: z.number().min(0).max(90).default(30),
  installationCostEur: z.number().min(0).max(200000).optional().nullable(),
});

export type CalculationInput = z.infer<typeof calculationInputSchema>;

const monthlyEntrySchema = z.object({
  month: z.number(),
  name: z.string(),
  generationKwh: z.number(),
  consumptionKwh: z.number(),
  savingsKwh: z.number(),
  gridImportKwh: z.number(),
  co2Kg: z.number(),
});

export type MonthlyEntry = z.infer<typeof monthlyEntrySchema>;

const calculationResponseSchema = z.object({
  savingsKwh: z.number(),
  co2Reduction: z.number(),
  annualSavingsEur: z.number(),
  carbonFootprint: z.number(),
  carbonIntensity: z.number(),
  avgIrradiance: z.number(),
  irradianceSource: z.string(),
  recommendation: z.string(),
  breakdown: z.object({
    solar: z.number(),
    grid: z.number(),
    battery: z.number(),
  }),
  monthlyData: z.array(monthlyEntrySchema),
  installationCostEur: z.number(),
  paybackYears: z.number(),
  roiCurve: z.array(z.object({
    year: z.number(),
    cumulativeSavings: z.number(),
    netPosition: z.number(),
  })),
});

export type CalculationResponse = z.infer<typeof calculationResponseSchema>;

export const api = {
  calculations: {
    create: {
      method: "POST" as const,
      path: "/api/calculate",
      input: calculationInputSchema,
      responses: {
        200: calculationResponseSchema,
      },
    },
    history: {
      method: "GET" as const,
      path: "/api/history",
      responses: {
        200: z.array(z.any()),
      },
    },
    optimize: {
      method: "POST" as const,
      path: "/api/optimize",
      input: z.object({
        energyPattern: z.array(z.number()),
        location: z.string(),
      }),
      responses: {
        200: z.object({
          optimalPv: z.number(),
          optimalBattery: z.number(),
          roiYears: z.number(),
          explanation: z.string(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
