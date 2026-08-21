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

// ── LLM payload tolerance ────────────────────────────────────────────────────
// NOTE: mirrored in artifacts/green-energy-calculator/src/lib/api.ts — keep in sync.
// `response_format: json_object` guarantees the model returns valid JSON, but NOT
// the shape of any value. In production `explanation` arrives as a plain string,
// an object of labelled parts, or an array of bullets, varying between calls.
// Normalize all three to readable text; return "" when nothing usable is present
// so the .pipe() below FAILS the parse rather than emitting an empty explanation.

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizeText(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || typeof value !== 'object' || depth > 2) return '';

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item, depth + 1))
      .filter(Boolean)
      .join(' ');
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => {
      const text = normalizeText(val, depth + 1);
      return text ? `${humanizeKey(key)}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

const llmTextSchema = z
  .unknown()
  .transform((value) => normalizeText(value))
  .pipe(z.string().min(1, 'could not be normalized to readable text'));

// Models also emit numbers as strings ("5000"). Accept both; reject anything that
// is not a finite number afterwards (null/{}/"" must fail, not silently become 0).
const llmNumberSchema = z
  .unknown()
  .transform((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? Number.NaN : Number(trimmed);
    }
    // Cast keeps the inferred output `number` for .pipe(); non-numbers still fail below.
    return value as number;
  })
  .pipe(z.number().refine(Number.isFinite, 'must be a finite number'));

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
          optimalPv: llmNumberSchema,
          optimalBattery: llmNumberSchema,
          explanation: llmTextSchema,
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
