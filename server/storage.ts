import { db } from "./db";
import { calculations, type InsertCalculation, type Calculation } from "@shared/schema";
import { chatStorage } from "./replit_integrations/chat/storage";

export interface IStorage {
  createCalculation(calc: InsertCalculation): Promise<Calculation>;
  getHistory(): Promise<Calculation[]>;
}

export class DatabaseStorage implements IStorage {
  async createCalculation(calc: InsertCalculation): Promise<Calculation> {
    const [result] = await db.insert(calculations).values(calc).returning();
    return result;
  }

  async getHistory(): Promise<Calculation[]> {
    return db.select().from(calculations).orderBy(calculations.createdAt);
  }
}

export const storage = new DatabaseStorage();
export { chatStorage };
