import { z } from 'zod/v4';
import { calculationInputSchema, calculations } from '@workspace/db';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

const monthlyEntrySchema = z.object({
  month: z.number(),
  name: z.string(),
  generationKwh: z.number(),
  consumptionKwh: z.number(),
  savingsKwh: z.number(),
  gridImportKwh: z.number(),
  co2Kg: z.number(),
});

export const api = {
  calculations: {
    create: {
      method: 'POST' as const,
      path: '/api/calculate',
      input: calculationInputSchema,
      responses: {
        200: z.object({
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
        }),
        400: errorSchemas.validation,
      },
    },
    history: {
      method: 'GET' as const,
      path: '/api/history',
      responses: {
        200: z.array(z.custom<typeof calculations.$inferSelect>()),
      },
    },
    optimize: {
      method: 'POST' as const,
      path: '/api/optimize',
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

export type CalculationResponse = z.infer<typeof api.calculations.create.responses[200]>;
export type HistoryResponse = z.infer<typeof api.calculations.history.responses[200]>;
export type CalculationInput = z.infer<typeof calculationInputSchema>;
