import { db } from "./db";
import { calculations, type InsertCalculation, type Calculation } from "@workspace/db";
import { chatStorage } from "./replit_integrations/chat/storage";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  createCalculation(calc: InsertCalculation & {
    savingsKwh: number;
    co2Reduction: number;
    annualSavingsEur?: number;
    renewableMix?: { solar: number; wind: number };
    monthlyData?: any[];
    sessionId: string;
  }): Promise<Calculation>;
  getHistory(sessionId: string): Promise<Calculation[]>;
  // Deliberately NOT session-scoped. Its only caller is the PDF route, which is
  // reached by window.open and therefore cannot carry an X-Session-Id header at
  // all. Step 4 does not list that route; leaving its reachability exactly as it
  // was rather than silently breaking the download button.
  getCalculationById(id: number): Promise<Calculation | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createCalculation(calc: any): Promise<Calculation> {
    const [result] = await db.insert(calculations).values(calc).returning();
    return result;
  }

  // sessionId is required, not optional: an unfiltered getHistory() is what the
  // exposure was. There is no overload that returns every row.
  async getCalculationById(id: number): Promise<Calculation | undefined> {
    const [row] = await db.select().from(calculations).where(eq(calculations.id, id));
    return row;
  }

  async getHistory(sessionId: string): Promise<Calculation[]> {
    return db
      .select()
      .from(calculations)
      .where(eq(calculations.sessionId, sessionId))
      .orderBy(desc(calculations.createdAt));
  }
}

export const storage = new DatabaseStorage();
export { chatStorage };
