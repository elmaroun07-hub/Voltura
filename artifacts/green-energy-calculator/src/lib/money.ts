import type { CalculationResponse } from "@/lib/api";
import { INTL_LOCALE, type Locale } from "@workspace/i18n";

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
 *
 * H2b: the reader's language decides the punctuation and where the symbol
 * goes (1.050 € in Spanish, €1,050 in English); the currency still comes from
 * the server. No default locale either: the caller passes the one in use.
 */
export function formatMoney(locale: Locale, amount: number, currency: Currency, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Compact axis ticks in the figure's own currency. */
export function formatMoneyCompact(locale: Locale, amount: number, currency: Currency): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A range renders as a range. There is no midpoint here or anywhere. */
export function formatMoneyRange(locale: Locale, low: number, high: number, currency: Currency): string {
  return `${formatMoney(locale, low, currency)}–${formatMoney(locale, high, currency)}`;
}
