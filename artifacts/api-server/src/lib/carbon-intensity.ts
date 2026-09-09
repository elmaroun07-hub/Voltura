/**
 * Grid carbon intensity by country, kg CO2 per kWh.
 *
 * H1.9 — moved here from `lib/db/src/schema/schema.ts`. Emissions constants do
 * not belong in a schema package: that package describes tables, and a value
 * that changes with a country's generation mix is data, not structure. Moving
 * it is NOT the same as fixing it — the figures carry no source and no date,
 * which is a P1 violation and is H1b's work (`lib/emissions`). This module is
 * a holding position, deliberately placed in the only package that consumes
 * it rather than in a new `lib/*` that would preempt H1b's design.
 */
export const CARBON_INTENSITY_BY_COUNTRY: Record<string, number> = {
  australia: 0.656,
  austria: 0.158,
  belgium: 0.167,
  brazil: 0.074,
  canada: 0.150,
  china: 0.555,
  denmark: 0.165,
  finland: 0.085,
  france: 0.083,
  germany: 0.401,
  greece: 0.393,
  india: 0.708,
  ireland: 0.295,
  italy: 0.351,
  japan: 0.471,
  mexico: 0.436,
  morocco: 0.543,
  maroc: 0.543,
  netherlands: 0.283,
  norway: 0.026,
  poland: 0.773,
  portugal: 0.212,
  romania: 0.263,
  "south korea": 0.436,
  spain: 0.244,
  sweden: 0.045,
  switzerland: 0.047,
  turkey: 0.481,
  "united kingdom": 0.248,
  uk: 0.248,
  "united states": 0.386,
  usa: 0.386,
  us: 0.386,
};

/** Split a location string into lowercase word tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Unicode-aware: "Málaga" and "Tétouan" must not split on their accents.
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Look up a country's grid intensity.
 *
 * H1.5 — the previous implementation was `loc.includes(country)` over the whole
 * concatenated string, which is a SUBSTRING match:
 *
 *   "Indianapolis, Indiana, United States"  ->  contains "india"  ->  0.708
 *
 * India's grid is 0.708 and the United States' is 0.386, so an Indianapolis
 * calculation reported roughly 1.8x its real CO2 saving. The keys make this
 * worse than it looks: `us` is a two-letter key, so any word containing "us"
 * was a candidate, and iteration order was the only thing deciding which
 * wrong answer you got.
 *
 * Now: whole-token matching only, and the GEOCODED COUNTRY is consulted first.
 * Nominatim is asked with `accept-language=en` and returns the country as its
 * own field, so it is a far better signal than anything scraped out of the
 * user's free text. The free text is the fallback, and even there a key only
 * matches if every one of its words appears as a whole token in sequence.
 *
 * Returns null when nothing matches. The caller decides what an unknown
 * country means — this function does not invent a number.
 */
export function lookupCarbonIntensity(
  geocodedCountry: string,
  locationInput: string,
): number | null {
  // 1. Exact match on the geocoded country. "United States" -> "united states".
  const country = geocodedCountry.trim().toLowerCase();
  if (country && country in CARBON_INTENSITY_BY_COUNTRY) {
    return CARBON_INTENSITY_BY_COUNTRY[country];
  }

  // 2. Whole-token match over the geocoded country plus the user's text.
  //    Multi-word keys ("south korea") must appear as consecutive tokens.
  const tokens = tokenize(`${geocodedCountry} ${locationInput}`);
  for (const [key, intensity] of Object.entries(CARBON_INTENSITY_BY_COUNTRY)) {
    const keyTokens = key.split(" ");
    for (let i = 0; i + keyTokens.length <= tokens.length; i++) {
      let hit = true;
      for (let j = 0; j < keyTokens.length; j++) {
        if (tokens[i + j] !== keyTokens[j]) { hit = false; break; }
      }
      if (hit) return intensity;
    }
  }

  return null;
}
