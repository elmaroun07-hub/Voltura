import { describe, expect, it } from "vitest";
import { lookupCarbonIntensity, CARBON_INTENSITY_BY_COUNTRY, COUNTRY_KEY_BY_ISO } from "./carbon-intensity";
import { loadCountries } from "./emissions/countries";

/**
 * H1.5 — the substring match that resolved "Indianapolis" to India.
 *
 * `loc.includes(country)` over the whole concatenated string meant any country
 * name appearing as a SUBSTRING of any word won. India's grid is 0.708 and the
 * United States' is 0.386, so an Indianapolis calculation overstated its CO2
 * saving by roughly 1.8x — a wrong number on a card a user reads, produced by
 * a string operation.
 *
 * D16 (H-ASST-D16-N3) removed what H1.5 left: the whole-token walk over the
 * free text, which still handed a country outside the table the factor of any
 * table country the text named. The lookup now takes the geocoder's ISO code
 * and no text at all, so these cases are pinned on codes; the end-to-end
 * strings are in routes/d16-country.test.ts.
 */
describe("H1.5 / D16 — the country is an ISO code, never text", () => {
  it("Indianapolis is the United States: the code decides, not the place name", () => {
    expect(lookupCarbonIntensity("us")).toBe(CARBON_INTENSITY_BY_COUNTRY["united states"]);
    expect(lookupCarbonIntensity("us")).not.toBe(CARBON_INTENSITY_BY_COUNTRY["india"]);
  });

  it("still resolves India itself", () => {
    expect(lookupCarbonIntensity("in")).toBe(0.708);
  });

  it("is case- and whitespace-insensitive on the code", () => {
    expect(lookupCarbonIntensity(" AU ")).toBe(0.656);
    expect(lookupCarbonIntensity("pt")).toBe(0.212);
    expect(lookupCarbonIntensity("kr")).toBe(0.436);
    expect(lookupCarbonIntensity("ma")).toBe(0.543);
  });

  it("the table's name aliases are not codes, and names are not codes", () => {
    for (const notACode of ["usa", "maroc", "united states", "india", "Indianapolis, Indiana"]) {
      expect(lookupCarbonIntensity(notACode)).toBeNull();
    }
  });

  it("returns null rather than inventing a number for an unknown or missing code", () => {
    // The caller (resolveCarbonSource, ./emissions/carbon-source.ts) turns
    // this into a typed "unknown_country" and a 400 — H-SRC-ES removed the
    // 0.4 substitution (D15). What matters here is that this function itself
    // does not hide the absence.
    expect(lookupCarbonIntensity("bt")).toBeNull();
    expect(lookupCarbonIntensity("sg")).toBeNull();
    expect(lookupCarbonIntensity("eg")).toBeNull();
    expect(lookupCarbonIntensity("")).toBeNull();
  });

  it("no longer resolves Spain or the UK — both are sourced through the registry", () => {
    expect(lookupCarbonIntensity("es")).toBeNull();
    expect(lookupCarbonIntensity("gb")).toBeNull();
    expect(CARBON_INTENSITY_BY_COUNTRY["spain"]).toBeUndefined();
  });

  it("no table country lost its figure: every country key has a code, and every code names a known country", () => {
    const aliases = new Set(["maroc", "usa", "us"]);
    const keyed = new Set(Object.values(COUNTRY_KEY_BY_ISO));
    expect(Object.keys(CARBON_INTENSITY_BY_COUNTRY).filter((k) => !aliases.has(k) && !keyed.has(k))).toEqual([]);
    const registry = loadCountries().map((c) => c.key);
    for (const key of registry) expect(keyed.has(key), key).toBe(true);
    expect([...keyed].filter((k) => !(k in CARBON_INTENSITY_BY_COUNTRY) && !registry.includes(k))).toEqual([]);
  });
});
