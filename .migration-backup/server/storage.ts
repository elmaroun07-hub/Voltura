import { db } from "./db";
import { calculations, type InsertCalculation, type Calculation } from "@shared/schema";
import { chatStorage } from "./replit_integrations/chat/storage";
import { desc } from "drizzle-orm";

export interface IStorage {
  createCalculation(calc: InsertCalculation & {
    savingsKwh: number;
    co2Reduction: number;
    annualSavingsEur?: number;
    carbonFootprint?: number;
    renewableMix?: { solar: number; wind: number };
    monthlyData?: any[];
  }): Promise<Calculation>;
  getHistory(): Promise<Calculation[]>;
}

export class DatabaseStorage implements IStorage {
  async createCalculation(calc: any): Promise<Calculation> {
    const [result] = await db.insert(calculations).values(calc).returning();
    return result;
  }

  async getHistory(): Promise<Calculation[]> {
    return db.select().from(calculations).orderBy(desc(calculations.createdAt));
  }
}

export const storage = new DatabaseStorage();
export { chatStorage };
