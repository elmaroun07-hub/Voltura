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
    expect(lookupCarbonIntensity("Spain", "Toledo, Spain")).toBe(0.244);
    expect(lookupCarbonIntensity("Spain", "somewhere near france")).toBe(0.244);
  });

  it("matches multi-word keys only as consecutive tokens", () => {
    expect(lookupCarbonIntensity("South Korea", "Seoul")).toBe(0.436);
    // "korea south" is not "south korea"
    expect(lookupCarbonIntensity("", "korea")).toBeNull();
  });

  it("survives accents without splitting the word", () => {
    expect(lookupCarbonIntensity("Spain", "Málaga, Almería")).toBe(0.244);
    expect(lookupCarbonIntensity("Morocco", "Tétouan")).toBe(0.543);
  });

  it("returns null rather than inventing a number for an unknown country", () => {
    // The caller substitutes 0.4 and that substitution is H1b's to remove.
    // What matters here is that this function does not hide it.
    expect(lookupCarbonIntensity("Bhutan", "Thimphu")).toBeNull();
    expect(lookupCarbonIntensity("", "")).toBeNull();
  });
});
