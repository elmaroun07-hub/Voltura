/**
 * The single entry point routes.ts uses to find out what carbon figure a
 * location resolves to — H-SRC-ES.
 *
 * Combines the sourced Spain resolver (`./es.ts`) with the pre-existing
 * legacy country table (`../carbon-intensity.ts`, unsourced, out of this
 * block's scope fence — a second country is explicitly OUT) and replaces
 * the old `detectCarbonIntensity()` in routes.ts, which used to fall back to
 * a fabricated `0.4` for any country the table did not carry (D15).
 *
 * `CarbonSourceNote` is a closed set of four honest states. There is no
 * fifth state where the code emits a number without saying which of these
 * four it is — that is what makes "no silent defaults" true here rather than
 * merely intended.
 */
import { lookupCarbonIntensity } from "../carbon-intensity";
import { resolveEsConsumerCarbonFactor, type SourcedCarbonFactor } from "./es";

export type CarbonSourceNote =
  // Spain, resolved through the registry. Full provenance travels with it.
  | { status: "sourced"; country: "spain"; factor: SourcedCarbonFactor<"supply_residual"> }
  // A country the legacy table still carries a bare, unsourced figure for.
  // Pre-existing behaviour, unchanged by this block — see carbon-intensity.ts.
  // Honest about NOT having a registry entry, rather than silent about it.
  | { status: "unsourced_legacy"; country: string; valueKgPerKwh: number }
  // Neither the registry nor the legacy table has anything for this
  // location. Used to silently become 0.4 (D15). Now the caller's job is to
  // reject the request — see carbonIntensityKgPerKwh below.
  | { status: "unknown_country"; attempted: string }
  // Geocoding itself failed, so there is no country to resolve a carbon
  // figure for at all.
  | { status: "not_reached" };

export function resolveCarbonSource(
  geocodedCountry: string,
  locationInput: string,
): CarbonSourceNote {
  const country = geocodedCountry.trim().toLowerCase();

  if (country === "spain") {
    return { status: "sourced", country: "spain", factor: resolveEsConsumerCarbonFactor() };
  }

  const legacy = lookupCarbonIntensity(geocodedCountry, locationInput);
  if (legacy !== null) {
    return {
      status: "unsourced_legacy",
      country: geocodedCountry || locationInput,
      valueKgPerKwh: legacy,
    };
  }

  return { status: "unknown_country", attempted: geocodedCountry || locationInput };
}

/**
 * The kg CO2 / kWh figure to multiply a savings figure by. Throws for
 * `unknown_country` and `not_reached` — callers MUST check `status` and
 * reject the request themselves before reaching arithmetic (D15: the old
 * code's mistake was doing the substitution silently, inside the lookup,
 * where the caller never had to decide anything). This function refuses to
 * make that decision for the caller a second time.
 */
export function carbonIntensityKgPerKwh(source: CarbonSourceNote): number {
  switch (source.status) {
    case "sourced":
      return source.factor.valueGPerKwh / 1000;
    case "unsourced_legacy":
      return source.valueKgPerKwh;
    case "unknown_country":
    case "not_reached":
      throw new Error(
        `carbonIntensityKgPerKwh: called with status "${source.status}" — the caller must ` +
          "reject the request before reaching arithmetic, not call this function",
      );
  }
}
