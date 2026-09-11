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

const modelProseSchema = z
  .unknown()
  .transform((value) => normalizeText(value))
  .pipe(z.string().min(1, "could not be normalized to readable text"));

// H-OPT sizing record. Every field is computed server-side by lib/sizing.ts from
// NASA POWER irradiance and the household's metered annual usage; none of it
// comes from a model. It travels with the recommendation because an array size
// means nothing without the irradiance, the load and the four assumptions it
// was divided by.
const sizingSchema = z.object({
  pvKwp: z.number(),
  pvWatts: z.number(),
  batteryKwh: z.number(),
  annualUsageKwh: z.number(),
  dailyUsageKwh: z.number(),
  nightUsageKwh: z.number(),
  nightShare: z.number(),
  darkHours: z.number(),
  irradianceKwhM2Day: z.number(),
  coverageTarget: z.number(),
  performanceRatio: z.number(),
  roundTripEfficiency: z.number(),
  usableDepthOfDischarge: z.number(),
  daysPerYear: z.number(),
});

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
  irradiancePeriod: z
    .object({ start: z.number(), end: z.number() })
    .nullable(),
  nasaHttpStatus: z.union([
    z.number(),
    z.literal("not-called"),
    z.literal("request-failed"),
  ]),
  nasaKeysRequested: z.array(z.string()),
  nasaKeysPresent: z.array(z.string()),
  irradianceMonthly: z.array(z.number()),
});

export type Resolution = z.infer<typeof resolutionSchema>;

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

const optimizeResponseSchema = z.object({
  // Computed, never model-supplied. `llmNumberSchema` used to sit on these two
  // fields, tolerating "5000" from a model because a model was choosing the
  // size. It no longer is, so a string here would mean a model value reached
  // the field, and it fails.
  optimalPv: z.number(),
  optimalBattery: z.number(),
  explanation: modelProseSchema,
  sizing: sizingSchema,
  resolution: resolutionSchema,
});

export type OptimizeResponse = z.infer<typeof optimizeResponseSchema>;

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
        // 24 hourly weights describing WHEN the load happens. A shape, not a
        // magnitude: the server normalizes it to sum 1. The old prompt called
        // this "24h Energy Pattern (kWh)" and this client's fixed profile sums
        // to 102, so every recommendation was sized for a 102 kWh/day house.
        energyPattern: z
          .array(z.number().min(0, "an hourly weight cannot be negative"))
          .length(24, "energyPattern must carry one weight per hour of the day"),
        location: z.string(),
        // The magnitude, and it is REQUIRED. Bounds match energyUsage above so
        // the two routes cannot disagree about what a plausible household is.
        annualUsageKwh: z.number().min(100).max(100000),
      }),
      responses: {
        200: optimizeResponseSchema,
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
