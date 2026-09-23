import type { CalculationResponse } from "@/lib/api";

export type Currency = "EUR" | "GBP";
export type Money = CalculationResponse["money"];

/**
 * The one place an amount becomes text. H-SRC-ES-UK, P0.6.
 *
 * The symbol comes from the currency the SERVER computed the figure in, via
 * Intl - there is no literal currency symbol anywhere in the render path, and
 * no default currency: a caller that does not have one cannot format an amount.
 * (The old render path printed a hard-coded euro sign on every figure,
 * whatever country it was for.)
 */
export function formatMoney(amount: number, currency: Currency, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Compact axis ticks in the figure's own currency. */
export function formatMoneyCompact(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A range renders as a range. There is no midpoint here or anywhere. */
export function formatMoneyRange(low: number, high: number, currency: Currency): string {
  return `${formatMoney(low, currency)}–${formatMoney(high, currency)}`;
}

/** Text for a money slot that has no figure: says so, and says why in words. */
export const PENDING_LABEL = "pending";
