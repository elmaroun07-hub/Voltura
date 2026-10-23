import { z } from "zod";

export const calculationInputSchema = z.object({
  // No message here: the form maps zod's issue codes to the catalog (H2b), and
  // a message written on the schema would override that in English.
  // H-D17: max mirrors the server's cap; too_big maps to validation.max.
  location: z.string().min(2).max(200),
  energyUsage: z.number().min(100).max(100000),
  pvWattage: z.number().min(100).max(100000),
  batteryCapacity: z.number().min(0).max(200),
  // Optional, no default: the server resolves it from the country registry or the
  // money figure is pending. Mirrors calculationInputSchema in lib/db.
  electricityTariff: z.number().min(0.01).max(5).optional().nullable(),
  batteryEfficiency: z.number().min(0.5).max(1.0).default(0.9),
  panelOrientation: z.enum(["north", "south", "east", "west"]).default("south"),
  roofAngle: z.number().min(0).max(90).default(30),
  installationCost: z.number().min(0).max(200000).optional().nullable(),
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
  // A failed pipe is logged (useOptimize's safeParse), never shown; no prose here.
  .pipe(z.string().min(1));

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

// Mirrors monthlyEntrySchema in artifacts/api-server/src/shared-routes.ts. Nothing
// compares the two automatically: change both.
const monthlyEntrySchema = z.object({
  month: z.number(),
  name: z.string(),
  generationKwh: z.number(),
  consumptionKwh: z.number(),
  savingsKwh: z.number(),
  gridImportKwh: z.number(),
  co2Kg: z.number(),
  // The flows the engine records (H-D8D52), each rounded to 0.1 kWh.
  pvDirectKwh: z.number(),
  batteryChargeKwh: z.number(),
  batteryDischargeKwh: z.number(),
  surplusKwh: z.number(),
});

export type MonthlyEntry = z.infer<typeof monthlyEntrySchema>;

// Mirrors sourcedCarbonFactorSchema in
// artifacts/api-server/src/shared-routes.ts.
const sourcedCarbonFactorSchema = z.object({
  status: z.literal("sourced"),
  system: z.string(),
  valueGPerKwh: z.number(),
  basis: z.literal("generation"),
  authority: z.string(),
  publication: z.object({
    title: z.string(),
    url: z.string(),
    published: z.string(),
    retrieved: z.string(),
  }),
  activityYear: z.number(),
});

// Mirrors carbonSourceSchema in artifacts/api-server/src/shared-routes.ts.
const carbonSourceSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("sourced"),
    country: z.string(),
    factor: sourcedCarbonFactorSchema,
  }),
  z.object({
    status: z.literal("pending"),
    country: z.string(),
    system: z.string().nullable(),
    reason: z.enum(["system_factor_pending", "system_undetermined"]),
    detail: z.string(),
  }),
  z.object({
    status: z.literal("unsourced_legacy"),
    country: z.string(),
    valueKgPerKwh: z.number(),
  }),
  z.object({
    status: z.literal("unknown_country"),
    attempted: z.string(),
  }),
  z.object({
    status: z.literal("not_reached"),
  }),
]);

export type CarbonSource = z.infer<typeof carbonSourceSchema>;

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
  carbonSource: carbonSourceSchema,
});

export type Resolution = z.infer<typeof resolutionSchema>;

// Mirrors the money block in artifacts/api-server/src/shared-routes.ts.
// H-SRC-ES-UK. The money block: every part USED with its source named, or
// PENDING with a typed reason. Mirrors MoneyBlock in ../lib/emissions/money.ts.
const currencySchema = z.enum(["EUR", "GBP"]);
const taxBasisSchema = z.enum(["all_taxes_included", "vat_where_applicable", "excl_vat"]);

const tariffUsedSchema = z.union([
  z.object({ status: z.literal("used"), source: z.literal("user"), value: z.number(), label: z.string() }),
  z.object({
    status: z.literal("used"),
    source: z.literal("registry"),
    value: z.number(),
    label: z.string(),
    taxBasis: taxBasisSchema,
    authority: z.string(),
    period: z.object({ label: z.string(), start: z.string(), end: z.string() }),
    reviewBy: z.string(),
    publicationUrl: z.string(),
  }),
  z.object({
    status: z.literal("pending"),
    reason: z.enum(["country_not_in_registry", "registry_tariff_pending", "registry_tariff_stale"]),
    detail: z.string(),
  }),
]);

const installCostUsedSchema = z.union([
  z.object({ status: z.literal("used"), source: z.literal("user"), amount: z.number() }),
  z.object({
    status: z.literal("used"),
    source: z.literal("registry_band"),
    amount: z.number(),
    perKw: z.number(),
    kwp: z.number(),
    band: z.object({ fromKw: z.number(), toKw: z.number() }),
    taxBasis: taxBasisSchema,
    authority: z.string(),
    edition: z.string(),
    label: z.string(),
  }),
  z.object({
    status: z.literal("used"),
    source: z.literal("registry_range"),
    low: z.number(),
    high: z.number(),
    perKwLow: z.number(),
    perKwHigh: z.number(),
    kwp: z.number(),
    taxBasis: taxBasisSchema,
    authority: z.string(),
    edition: z.string(),
    label: z.string(),
  }),
  z.object({
    status: z.literal("pending"),
    reason: z.enum([
      "country_not_in_registry",
      "registry_cost_pending",
      "battery_not_in_registry_cost",
      "size_outside_registry_bands",
    ]),
    detail: z.string(),
  }),
]);

const roiUsedSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("computed"),
    // null = never paid back within the horizon: a state, never a number (D7).
    paybackYears: z.number().nullable(),
    curve: z.array(z.object({ year: z.number(), cumulativeSavings: z.number(), netPosition: z.number() })),
    lifetimeSavings: z.number(),
  }),
  z.object({ status: z.literal("pending"), detail: z.string() }),
]);

const moneyBlockSchema = z.object({
  // Null only for a country outside the registry: no currency is known, so none is guessed.
  currency: currencySchema.nullable(),
  tariff: tariffUsedSchema,
  annualSavings: z.number().nullable(),
  installCost: installCostUsedSchema,
  roi: roiUsedSchema,
});

const calculationResponseSchema = z.object({
  // Mirrors the create-200 id in artifacts/api-server/src/shared-routes.ts.
  // Zod strips keys a schema does not name: without this line the server's id
  // reaches the page as undefined and the PDF button silently never renders.
  id: z.number().int().positive(),
  savingsKwh: z.number(),
  co2Reduction: z.number(),
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
  money: moneyBlockSchema,
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
      // `as const` on every path: sessionFetch only accepts an "/api/..." literal type.
      path: "/api/calculate" as const,
      input: calculationInputSchema,
      responses: {
        200: calculationResponseSchema,
      },
    },
    history: {
      method: "GET" as const,
      path: "/api/history" as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    optimize: {
      method: "POST" as const,
      path: "/api/optimize" as const,
      input: z.object({
        // 24 hourly weights describing WHEN the load happens. A shape, not a
        // magnitude: the server normalizes it to sum 1. The old prompt called
        // this "24h Energy Pattern (kWh)" and this client's fixed profile sums
        // to 102, so every recommendation was sized for a 102 kWh/day house.
        energyPattern: z
          // One non-negative weight per hour of the day.
          .array(z.number().min(0))
          .length(24),
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
