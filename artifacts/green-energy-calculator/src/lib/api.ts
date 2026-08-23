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

// ── LLM payload tolerance ────────────────────────────────────────────────────
// NOTE: mirrored in artifacts/api-server/src/shared-routes.ts — keep in sync.
// `response_format: json_object` guarantees the model returns valid JSON, but NOT
// the shape of any value. In production `explanation` arrives as a plain string,
// an object of labelled parts, or an array of bullets, varying between calls.
// Normalize all three to readable text; return "" when nothing usable is present
// so the .pipe() below FAILS the parse rather than emitting an empty explanation.

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function normalizeText(value: unknown, depth = 0): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || typeof value !== "object" || depth > 2) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item, depth + 1))
      .filter(Boolean)
      .join(" ");
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => {
      const text = normalizeText(val, depth + 1);
      return text ? `${humanizeKey(key)}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const llmTextSchema = z
  .unknown()
  .transform((value) => normalizeText(value))
  .pipe(z.string().min(1, "could not be normalized to readable text"));

// Models also emit numbers as strings ("5000"). Accept both; reject anything that
// is not a finite number afterwards (null/{}/"" must fail, not silently become 0).
const llmNumberSchema = z
  .unknown()
  .transform((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? Number.NaN : Number(trimmed);
    }
    // Cast keeps the inferred output `number` for .pipe(); non-numbers still fail below.
    return value as number;
  })
  .pipe(z.number().refine(Number.isFinite, "must be a finite number"));

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

// Mirrors resolutionSchema in artifacts/api-server/src/shared-routes.ts.
const resolutionSchema = z.object({
  locationInput: z.string(),
  geocodeStatus: z.enum(["resolved", "failed"]),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  irradianceSource: z.enum(["nasa-live", "fallback-lat", "not-reached"]),
  irradianceYear: z.number().nullable(),
  nasaHttpStatus: z.union([
    z.number(),
    z.literal("not-called"),
    z.literal("request-failed"),
  ]),
  nasaKeysRequested: z.array(z.string()),
  nasaKeysPresent: z.array(z.string()),
  irradianceMonthly: z.array(z.number()),
});

const calculationResponseSchema = z.object({
  savingsKwh: z.number(),
  co2Reduction: z.number(),
  annualSavingsEur: z.number(),
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
  resolution: resolutionSchema,
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
