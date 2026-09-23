/**
 * Resolves the money block of a calculation — H-SRC-ES-UK.
 *
 * Replaces the flat `annualSavingsEur / installationCostEur / paybackYears /
 * roiCurve` fields, which hard-coded a currency, defaulted the tariff to
 * 0.25 for every country on Earth, and back-filled a 9,800 install cost in euros
 * from constants with no source.
 *
 * Every part of the block is one of: USED (with its source named), or
 * PENDING (with a typed reason). Nothing is substituted. In particular:
 *   - a country outside the registry has NO money figure (P0.8) — Tétouan is
 *     never billed at a Spanish rate;
 *   - a registry tariff past its `reviewBy` is stale and is never used;
 *   - a user-typed tariff always wins (P0.7) for a registry country;
 *   - the registry's install cost is PV-only, so it is refused whenever a
 *     battery is specified rather than quietly understating the cost;
 *   - an install-cost RANGE stays a range end to end (P0.4).
 */
import {
  formatMoney,
  formatMoneyRange,
  priceSavings,
  roi,
  toPricedTariff,
  type CountryEntry,
  type Currency,
  type Money,
  type RoiCurvePoint,
  type TaxBasis,
} from "./countries";

export type TariffPendingReason = "country_not_in_registry" | "registry_tariff_pending" | "registry_tariff_stale";
export type InstallCostPendingReason =
  | "country_not_in_registry"
  | "registry_cost_pending"
  | "battery_not_in_registry_cost"
  | "size_outside_registry_bands";

export type TariffUsed =
  | { status: "used"; source: "user"; value: number; label: string }
  | {
      status: "used";
      source: "registry";
      value: number;
      /** e.g. "Eurostat 2025-S2" — the text the Tariff Used card shows for a registry value. */
      label: string;
      taxBasis: TaxBasis;
      authority: string;
      period: { label: string; start: string; end: string };
      reviewBy: string;
      publicationUrl: string;
    }
  | { status: "pending"; reason: TariffPendingReason; detail: string };

export type InstallCostUsed =
  | { status: "used"; source: "user"; amount: number }
  | {
      status: "used";
      source: "registry_band";
      amount: number;
      perKw: number;
      kwp: number;
      band: { fromKw: number; toKw: number };
      taxBasis: TaxBasis;
      authority: string;
      edition: string;
      label: string;
    }
  | {
      status: "used";
      source: "registry_range";
      low: number;
      high: number;
      perKwLow: number;
      perKwHigh: number;
      kwp: number;
      taxBasis: TaxBasis;
      authority: string;
      edition: string;
      label: string;
    }
  | { status: "pending"; reason: InstallCostPendingReason; detail: string };

export type RoiUsed =
  | { status: "computed"; paybackYears: number; curve: RoiCurvePoint[]; lifetimeSavings: number }
  | { status: "pending"; detail: string };

export interface MoneyBlock {
  /** Null only when the country is outside the registry: no currency is known, so none is guessed. */
  currency: Currency | null;
  tariff: TariffUsed;
  annualSavings: number | null;
  installCost: InstallCostUsed;
  roi: RoiUsed;
}

export interface MoneyInput {
  country: CountryEntry | null;
  userTariff: number | null;
  userInstallCost: number | null;
  savingsKwh: number;
  pvKw: number;
  batteryKwh: number;
  now: Date;
}

const NOT_IN_REGISTRY = "this country has no sourced tariff or install cost yet, so no money figure is produced";

function resolveTariff(input: MoneyInput): { tariff: TariffUsed; priced: ReturnType<typeof toPricedTariff> | null } {
  const { country, userTariff, now } = input;
  if (!country) {
    return { tariff: { status: "pending", reason: "country_not_in_registry", detail: NOT_IN_REGISTRY }, priced: null };
  }
  if (userTariff !== null) {
    return {
      tariff: { status: "used", source: "user", value: userTariff, label: "your tariff" },
      priced: { value: userTariff, currency: country.currency, taxBasis: "user_declared" },
    };
  }
  const t = country.tariff;
  if (t.status === "pending") {
    return { tariff: { status: "pending", reason: "registry_tariff_pending", detail: t.reason }, priced: null };
  }
  if (now.getTime() > Date.parse(`${t.reviewBy}T23:59:59Z`)) {
    return {
      tariff: {
        status: "pending",
        reason: "registry_tariff_stale",
        detail: `the ${t.authority} ${t.period.label} tariff was due for re-pull by ${t.reviewBy} and has not been refreshed, so it is not used`,
      },
      priced: null,
    };
  }
  return {
    tariff: {
      status: "used",
      source: "registry",
      value: t.value,
      label: `${t.authority} ${t.period.label}`,
      taxBasis: t.taxBasis,
      authority: t.authority,
      period: t.period,
      reviewBy: t.reviewBy,
      publicationUrl: t.publication.url,
    },
    priced: toPricedTariff(t),
  };
}

function resolveInstallCost(input: MoneyInput): InstallCostUsed {
  const { country, userInstallCost, pvKw, batteryKwh } = input;
  if (!country) return { status: "pending", reason: "country_not_in_registry", detail: NOT_IN_REGISTRY };
  if (userInstallCost !== null) return { status: "used", source: "user", amount: userInstallCost };
  const c = country.installCost;
  if (c.status === "pending") {
    return { status: "pending", reason: "registry_cost_pending", detail: c.note };
  }
  if (batteryKwh > 0) {
    return {
      status: "pending",
      reason: "battery_not_in_registry_cost",
      detail: `the ${c.authority} cost covers PV only and excludes battery storage; it is not applied to a system with a battery`,
    };
  }
  const label = `${c.authority}, ${c.edition}`;
  if (c.kind === "range") {
    return {
      status: "used",
      source: "registry_range",
      low: Math.round(c.low * pvKw),
      high: Math.round(c.high * pvKw),
      perKwLow: c.low,
      perKwHigh: c.high,
      kwp: pvKw,
      taxBasis: c.taxBasis,
      authority: c.authority,
      edition: c.edition,
      label,
    };
  }
  // Banded: [fromKw, toKw] — a system of exactly 4 kW is in the 0–4 band.
  const band = c.bands.find((b) => pvKw > b.fromKw && pvKw <= b.toKw);
  if (!band) {
    return {
      status: "pending",
      reason: "size_outside_registry_bands",
      detail: `a ${pvKw} kW system is outside the bands ${c.authority} publishes (${c.bands.map((b) => `${b.fromKw}–${b.toKw} kW`).join(", ")})`,
    };
  }
  return {
    status: "used",
    source: "registry_band",
    amount: Math.round(band.value * pvKw),
    perKw: band.value,
    kwp: pvKw,
    band: { fromKw: band.fromKw, toKw: band.toKw },
    taxBasis: c.taxBasis,
    authority: c.authority,
    edition: c.edition,
    label,
  };
}

export function resolveMoney(input: MoneyInput): MoneyBlock {
  const currency = input.country ? input.country.currency : null;
  const { tariff, priced } = resolveTariff(input);
  const installCost = resolveInstallCost(input);

  if (!priced || currency === null) {
    return {
      currency,
      tariff,
      annualSavings: null,
      installCost,
      roi: { status: "pending", detail: "there is no tariff to price the saving with" },
    };
  }

  const annual: Money<Currency> = priceSavings(input.savingsKwh, priced);

  let roiBlock: RoiUsed;
  if (installCost.status === "used" && installCost.source !== "registry_range") {
    // roi() is exported as two concrete overloads (see countries.ts) so a
    // mismatched pair is a compile error — real evidence for AC2. That means
    // it cannot accept `Money<Currency>` at a call site where the concrete
    // currency is only known at runtime; `annual` and `cost` were BOTH just
    // built from this same `currency` local a few lines above, so the branch
    // below is a narrowing of an invariant already established, not a new
    // assumption.
    const r =
      currency === "EUR"
        ? roi({ amount: annual.amount, currency }, { amount: installCost.amount, currency })
        : roi({ amount: annual.amount, currency }, { amount: installCost.amount, currency });
    roiBlock = { status: "computed", paybackYears: r.paybackYears, curve: r.curve, lifetimeSavings: r.lifetimeSavings };
  } else if (installCost.status === "used") {
    roiBlock = { status: "pending", detail: "the install cost is a range, and a payback is not computed from a range" };
  } else {
    roiBlock = { status: "pending", detail: installCost.detail };
  }

  return { currency, tariff, annualSavings: annual.amount, installCost, roi: roiBlock };
}

/** One-sentence saving line for the recommendation text; never a literal symbol. */
export function describeSaving(block: MoneyBlock): string {
  if (block.annualSavings === null || block.currency === null) {
    return "the saving is not priced (no sourced tariff for this location)";
  }
  return `saving ${formatMoney(block.annualSavings, block.currency)}/year`;
}

export function describeInstallCost(block: MoneyBlock): string | null {
  const c = block.installCost;
  if (c.status !== "used" || block.currency === null) return null;
  return c.source === "registry_range" ? formatMoneyRange(c.low, c.high, block.currency) : formatMoney(c.amount, block.currency);
}
