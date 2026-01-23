import { z } from 'zod';
import { calculationInputSchema, calculations } from './schema';

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
          recommendation: z.string(),
          breakdown: z.object({
            solar: z.number(),
            grid: z.number(),
            battery: z.number()
          })
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
        energyPattern: z.array(z.number()), // 24h usage pattern
        location: z.string()
      }),
      responses: {
        200: z.object({
          optimalPv: z.number(),
          optimalBattery: z.number(),
          roiYears: z.number(),
          explanation: z.string()
        })
      }
    }
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
