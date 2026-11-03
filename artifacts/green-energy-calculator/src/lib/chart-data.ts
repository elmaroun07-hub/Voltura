import type { MonthlyEntry } from "./api";

export interface MonthlyBar {
  name: string;
  generation: number;
  savings: number;
  gridImport: number;
  /** Present only when the API recorded the flows (H-D8D52); never filled with 0. */
  surplus?: number;
}

/**
 * The monthly chart's rows. The four flows arrived with H-D8D52 and are
 * optional here so a page deployed ahead of its API still renders (#7). The
 * surplus series exists only when every month carries it: a missing figure is
 * not drawn, and is never drawn as 0.
 */
export function monthlyBars(
  monthly: readonly MonthlyEntry[],
  monthName: (m: number) => string,
): { data: MonthlyBar[]; hasSurplus: boolean } {
  const hasSurplus = monthly.length > 0 && monthly.every((m) => typeof m.surplusKwh === "number");
  const barData = monthly.map((m): MonthlyBar => ({
    name: monthName(m.month),
    generation: m.generationKwh,
    savings: m.savingsKwh,
    gridImport: m.gridImportKwh,
    surplus: hasSurplus ? m.surplusKwh : undefined,
  }));
  return { data: barData, hasSurplus };
}
