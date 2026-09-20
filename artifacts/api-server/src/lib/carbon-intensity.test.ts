import { describe, expect, it } from "vitest";
import { lookupCarbonIntensity, CARBON_INTENSITY_BY_COUNTRY } from "./carbon-intensity";

/**
 * H1.5 — the substring match that resolved "Indianapolis" to India.
 *
 * `loc.includes(country)` over the whole concatenated string meant any country
 * name appearing as a SUBSTRING of any word won. India's grid is 0.708 and the
 * United States' is 0.386, so an Indianapolis calculation overstated its CO2
 * saving by roughly 1.8x — a wrong number on a card a user reads, produced by
 * a string operation.
 */
describe("H1.5 — whole-token country matching", () => {
  it("does not resolve Indianapolis to India", () => {
    const got = lookupCarbonIntensity("United States", "Indianapolis, Indiana");
    expect(got).toBe(CARBON_INTENSITY_BY_COUNTRY["united states"]);
    expect(got).not.toBe(CARBON_INTENSITY_BY_COUNTRY["india"]);
  });

  /**
   * The test above does NOT pin the token matcher, and mutation testing is how
   * that was found: reintroducing the substring defect left it green, because
   * "United States" is an exact table key and step 1 returns before the token
   * walk is ever reached. It pins the geocoded-country preference instead.
   *
   * This one forces the fallback path — no usable geocoded country, so the
   * lookup must scan the free text, which is exactly where the substring
   * defect lived. Under the old `loc.includes("india")` this returns 0.708.
   */
  it("does not resolve Indianapolis to India when geocoding gives no country", () => {
    expect(lookupCarbonIntensity("", "Indianapolis, Indiana")).toBeNull();
  });

  it("does not resolve Indianapolis to India when the geocoded country is unknown", () => {
    // A country the table does not carry: step 1 misses, step 2 must still
    // refuse to match "india" inside "Indianapolis" / "Indiana".
    expect(lookupCarbonIntensity("Bhutan", "Indianapolis, Indiana")).toBeNull();
  });

  it("still resolves India itself", () => {
    expect(lookupCarbonIntensity("India", "Mumbai, India")).toBe(0.708);
  });

  it("does not let the two-letter 'us' key match inside a word", () => {
    // "Houston" contains "us". So does "Australia". The old walk returned
    // whichever key iteration reached first, which is not a decision anyone made.
    expect(lookupCarbonIntensity("", "Houston")).toBeNull();
    expect(lookupCarbonIntensity("Australia", "Sydney")).toBe(0.656);
  });

  it("prefers the geocoded country over the free-text input", () => {
    // The user typed a country that is not where the geocoder landed. The
    // geocoded country is the better signal and wins.
    // H-SRC-ES: was "Spain" / 0.244 — Spain no longer resolves through this
    // bare table (see carbon-intensity.ts's header and ./emissions/es.ts), so
    // this mechanic is now pinned with Portugal instead. The behaviour under
    // test is the geocoded-country preference, not any particular country.
    expect(lookupCarbonIntensity("Portugal", "Porto, Portugal")).toBe(0.212);
    expect(lookupCarbonIntensity("Portugal", "somewhere near spain")).toBe(0.212);
  });

  it("matches multi-word keys only as consecutive tokens", () => {
    expect(lookupCarbonIntensity("South Korea", "Seoul")).toBe(0.436);
    // "korea south" is not "south korea"
    expect(lookupCarbonIntensity("", "korea")).toBeNull();
  });

  it("survives accents without splitting the word", () => {
    expect(lookupCarbonIntensity("Morocco", "Tétouan")).toBe(0.543);
    // H-SRC-ES: was "Spain" / 0.244 — see the note above.
    expect(lookupCarbonIntensity("Portugal", "Málaga, Almería")).toBe(0.212);
  });

  it("returns null rather than inventing a number for an unknown country", () => {
    // The caller (resolveCarbonSource, ./emissions/carbon-source.ts) turns
    // this into a typed "unknown_country" and a 400 — H-SRC-ES removed the
    // 0.4 substitution (D15). What matters here is that this function itself
    // does not hide the absence.
    expect(lookupCarbonIntensity("Bhutan", "Thimphu")).toBeNull();
    expect(lookupCarbonIntensity("", "")).toBeNull();
  });

  it("no longer resolves Spain — Spain is sourced through ./emissions/es.ts", () => {
    // H-SRC-ES: the bare 0.244 line was removed from CARBON_INTENSITY_BY_COUNTRY
    // so a Spanish figure cannot be emitted from this unsourced table by
    // accident. This is a negative test guarding against that key coming back.
    expect(lookupCarbonIntensity("Spain", "Toledo, Spain")).toBeNull();
    expect(CARBON_INTENSITY_BY_COUNTRY["spain"]).toBeUndefined();
  });
});
