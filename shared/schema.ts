import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export chat models from integration
export * from "./models/chat";

export const calculations = pgTable("calculations", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  energyUsage: integer("energy_usage").notNull(), // Annual kWh
  pvWattage: integer("pv_wattage").notNull(), // Watts
  batteryCapacity: integer("battery_capacity").notNull(), // kWh
  savingsKwh: integer("savings_kwh").notNull(),
  co2Reduction: integer("co2_reduction").notNull(), // kg CO2
  carbonFootprint: integer("carbon_footprint").default(0), // mg CO2 for calculation run
  renewableMix: jsonb("renewable_mix").$type<{solar: number, wind: number}>(), // % mix
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCalculationSchema = createInsertSchema(calculations).omit({ 
  id: true, 
  createdAt: true,
  savingsKwh: true,
  co2Reduction: true,
  renewableMix: true 
});

export const calculationInputSchema = insertCalculationSchema.extend({
  panelOrientation: z.enum(['north', 'south', 'east', 'west']).default('south'),
  roofAngle: z.number().min(0).max(90).default(30),
});

export type Calculation = typeof calculations.$inferSelect;
export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type CalculationInput = z.infer<typeof calculationInputSchema>;
