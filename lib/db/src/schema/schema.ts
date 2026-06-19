import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export * from "./models/chat";

export const CARBON_INTENSITY_BY_COUNTRY: Record<string, number> = {
  australia: 0.656,
  austria: 0.158,
  belgium: 0.167,
  brazil: 0.074,
  canada: 0.150,
  china: 0.555,
  denmark: 0.165,
  finland: 0.085,
  france: 0.083,
  germany: 0.401,
  greece: 0.393,
  india: 0.708,
  ireland: 0.295,
  italy: 0.351,
  japan: 0.471,
  mexico: 0.436,
  morocco: 0.543,
  maroc: 0.543,
  netherlands: 0.283,
  norway: 0.026,
  poland: 0.773,
  portugal: 0.212,
  romania: 0.263,
  "south korea": 0.436,
  spain: 0.244,
  sweden: 0.045,
  switzerland: 0.047,
  turkey: 0.481,
  "united kingdom": 0.248,
  uk: 0.248,
  "united states": 0.386,
  usa: 0.386,
  us: 0.386,
};

export type MonthlyEntry = {
  month: number;
  name: string;
  generationKwh: number;
  consumptionKwh: number;
  savingsKwh: number;
  gridImportKwh: number;
  co2Kg: number;
};

export const calculations = pgTable("calculations", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  energyUsage: integer("energy_usage").notNull(),
  pvWattage: integer("pv_wattage").notNull(),
  batteryCapacity: integer("battery_capacity").notNull(),
  electricityTariff: real("electricity_tariff").default(0.25).notNull(),
  batteryEfficiency: real("battery_efficiency").default(0.9).notNull(),
  panelOrientation: text("panel_orientation").default("south").notNull(),
  roofAngle: integer("roof_angle").default(30).notNull(),
  savingsKwh: integer("savings_kwh").notNull(),
  co2Reduction: integer("co2_reduction").notNull(),
  annualSavingsEur: real("annual_savings_eur").default(0),
  carbonFootprint: integer("carbon_footprint").default(0),
  renewableMix: jsonb("renewable_mix").$type<{ solar: number; wind: number }>(),
  monthlyData: jsonb("monthly_data").$type<MonthlyEntry[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCalculationSchema = createInsertSchema(calculations).omit({
  id: true,
  createdAt: true,
  savingsKwh: true,
  co2Reduction: true,
  renewableMix: true,
  annualSavingsEur: true,
  monthlyData: true,
  carbonFootprint: true,
});

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

export type Calculation = typeof calculations.$inferSelect;
export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type CalculationInput = z.infer<typeof calculationInputSchema>;
