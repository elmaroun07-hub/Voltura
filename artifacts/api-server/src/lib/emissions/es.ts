/**
 * Spain's carbon-intensity resolver — H-SRC-ES.
 *
 * Replaces the bare `spain: 0.244` line that used to live in
 * `../carbon-intensity.ts`. That line could not say who published 0.244, for
 * what year, or under which of three legitimate meanings of "Spain's carbon
 * intensity" — and this document's own `contracts/blocks/h1b.md:11` already
 * shows how a bare number like that goes stale silently: it records 0.283
 * for activity year 2024, one edition behind the 0.258 the same authority
 * later published for 2025.
 *
 * `basis` is why one country can have three defensibly different published
 * numbers at once — `supply_residual` (258 g/kWh), `generation` (107 g/kWh)
 * and `supply_attributed` (0 or 302 g/kWh depending on the Guarantee of
 * Origin) are not competing estimates of the same quantity, they are answers
 * to different questions. Using `generation` for a consumer's own saving
 * overstates it by 2.4x; treating any Guarantee of Origin as automatically
 * zero is wrong for the cogeneration one specifically (302 > 258). The type
 * parameter on `SourcedCarbonFactor` exists so a call site cannot get this
 * backwards without TypeScript refusing to compile it — see
 * `resolveEsConsumerCarbonFactor` and `applyConsumerCarbonFactor` below.
 */
import { requireCurrentEntry } from "./registry";

export type CarbonBasis = "supply_residual" | "generation" | "supply_attributed";

export interface SourcedCarbonFactor<B extends CarbonBasis = CarbonBasis> {
  status: "sourced";
  id: string;
  valueGPerKwh: number;
  basis: B;
  authority: string;
  documentId: string;
  editionDate: string;
  activityYear: number;
  nextEditionExpected: string | null;
  verifiedOn: string | null;
}

function toSourcedFactor<B extends CarbonBasis>(id: string, basis: B): SourcedCarbonFactor<B> {
  const entry = requireCurrentEntry(id);
  if (entry.basis !== basis) {
    // Guards against the registry and the resolver disagreeing about what an
    // id means — a mismatched YAML edit would otherwise silently relabel a
    // figure's basis. Belt-and-braces alongside the compile-time proof below.
    throw new Error(
      `emissions registry: entry "${id}" has basis "${entry.basis}", expected "${basis}"`,
    );
  }
  if (!entry.authority || !entry.documentId || !entry.editionDate || entry.activityYear === null) {
    throw new Error(
      `emissions registry: entry "${id}" is current but is missing required provenance ` +
        "(authority, document_id, edition_date or activity_year) — refusing to emit it",
    );
  }
  return {
    status: "sourced",
    id: entry.id,
    // entry.value is guaranteed non-null by requireCurrentEntry().
    valueGPerKwh: entry.value as number,
    basis,
    authority: entry.authority,
    documentId: entry.documentId,
    editionDate: entry.editionDate,
    activityYear: entry.activityYear,
    nextEditionExpected: entry.nextEditionExpected,
    verifiedOn: entry.verifiedOn,
  };
}

/**
 * The ONLY basis that may back a figure a Spanish consumer reads as "your"
 * CO2 saving — the no-Guarantee-of-Origin residual mix a consumer with an
 * unknown retailer actually draws. Its return type is locked to the literal
 * `"supply_residual"`: there is no parameter through which a caller could
 * pass `"generation"` instead, even by mistake.
 */
export function resolveEsConsumerCarbonFactor(): SourcedCarbonFactor<"supply_residual"> {
  return toSourcedFactor("es-carbon-supply-residual-2025", "supply_residual");
}

/**
 * National generation-mix average. Context and comparison ONLY — never a
 * consumer figure. 107 g/kWh against the 258 g/kWh consumer default is a
 * real, official, same-country same-year number; it is also 2.4x smaller,
 * which is exactly why it must never reach the same call site as
 * `resolveEsConsumerCarbonFactor`. Nothing in this codebase currently calls
 * this function outside its own test — it exists so the registry's
 * "generation" row is resolvable, and so AC4 has something concrete to
 * reject a call against.
 */
export function resolveEsGenerationMixFactor(): SourcedCarbonFactor<"generation"> {
  return toSourcedFactor("es-carbon-generation-2025", "generation");
}

/** A consumer on a redeemed renewable Guarantee of Origin. Genuinely 0 g/kWh. */
export function resolveEsRenewableAttributedFactor(): SourcedCarbonFactor<"supply_attributed"> {
  return toSourcedFactor("es-carbon-supply-attributed-renewable-2025", "supply_attributed");
}

/**
 * A consumer on a high-efficiency-cogeneration Guarantee of Origin — 302
 * g/kWh, NOT zero. "Has a GdO" and "zero carbon" are not the same claim;
 * this factor is what a wrong assumption there would get wrong.
 */
export function resolveEsCogenAttributedFactor(): SourcedCarbonFactor<"supply_attributed"> {
  return toSourcedFactor("es-carbon-supply-attributed-cogen-2025", "supply_attributed");
}

/**
 * The only function that may turn a consumer's kWh saving into a kg CO2
 * figure for Spain. The parameter type is
 * `SourcedCarbonFactor<"supply_residual">` — not `CarbonBasis`, not `string`
 * — so `applyConsumerCarbonFactor(resolveEsGenerationMixFactor(), kwh)` is a
 * TypeScript compile error, not a runtime check that a future edit could
 * accidentally loosen (AC4).
 */
export function applyConsumerCarbonFactor(
  factor: SourcedCarbonFactor<"supply_residual">,
  savingsKwh: number,
): number {
  return savingsKwh * (factor.valueGPerKwh / 1000);
}
