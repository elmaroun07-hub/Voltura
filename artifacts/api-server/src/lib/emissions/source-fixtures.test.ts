import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * H-SRC-ES-UK — pins every raw source pulled for this block, the same
 * pattern as `nasa-fillvalue-fixture.test.ts`: a fixture that can be reshaped
 * silently is not evidence. Every hash below was computed from the file as
 * pulled on this machine on 21 Sept 2026 (see the ruling's Sources section)
 * and is checked here so an edited byte fails loudly, in CI, forever.
 *
 * G10 holds: every path here is a local file under contracts/fixtures/. No
 * network call, no re-pull, nothing to leak.
 */

const FIXTURES_DIR = new URL("../../../../../contracts/fixtures/", import.meta.url);

function sha256(relativePath: string): string {
  const bytes = readFileSync(new URL(relativePath, FIXTURES_DIR));
  return createHash("sha256").update(bytes).digest("hex");
}

const PINNED: Record<string, string> = {
  "eurostat-nrg_pc_204-ES-UK-2025S2.raw": "4def6a5a4e052bc35d8dfce77979b2371b667b9ed48fe2d82a65ec96da29d2e2",
  "eurostat-nrg_pc_204-UK-alltime-probe.raw": "320eb3e5fb675592dbeb1c427dd5b54d4d6e6078ba3e22812992c65114390030",
  "ree-emissions-peninsular-2025.raw": "c33daabe8ac32556ce928db5efdf19e4ab5701affaa8145b07cfb24fbc6606af",
  "ree-emissions-nacional-control-2025.raw": "f7fdf53c9ae93176648a77aefdd0d3fadebde22095b72b9d00ffdcef105b1959",
  "desnz-ghg-2026-publication-page.html": "5f289a1f34fba90b34da2e2954493d5b2943c1bd86f8270ff22adb3cba3eceb2",
  "desnz-ghg-conversion-factors-2026-full-set.xlsx": "b5c4f2f86cdc74707337b2fb013b44ded189a1b528f5e29ea99856ba65ae0205",
  "desnz-solar-costs-2025-26-tic.xlsx": "1ce7ec3a9671fac704d313f07ee127de1fd0776e312ded7257d219131a45a1ca",
  "desnz-solar-costs-2025-26-dnc.xlsx": "a5932c65beedb36867b7f106f3dbc3374f239ca028e576a0b096377020cde680",
  "secondary-tuenergiaverde-placas-solares-precio-2026.html": "66f4922988810d2a389c33b6fd6a9ad5b8acfd244eb408bbb2c9e3e01ecdd0f0",
  "h-src-es-uk-geo-nasa.fixtures.json": "8752ecd91e43991bba1706ca75ccd856d07f2572bb564693b5e8824779794d9f",
  "prod-9034c99-calculate-fuengirola-before.json": "1f071a2e68b54f4fc7a22348663dddbdb45f4ebce5d7965dd441321ae708de96",
  "prod-9034c99-calculate-london-before.json": "51eecc44659cfd2d0f24e63226dc6559cc102116f2ddb75f4fd914a82c431237",
  "prod-9034c99-calculate-tetouan-before.json": "9a6e39552008bc7029b61eca824d4af550dda06a7cdf1fd5f76c90c7c3cf42e4",
};

describe("H-SRC-ES-UK source fixtures — sha256-pinned, unedited bytes", () => {
  it.each(Object.entries(PINNED))("%s matches its pinned hash", (file, expectedHash) => {
    expect(sha256(file)).toBe(expectedHash);
  });

  it("the Eurostat pull's Spain value (0.2669) is exactly what AC4's euro figure must use", () => {
    const raw = JSON.parse(readFileSync(new URL("eurostat-nrg_pc_204-ES-UK-2025S2.raw", FIXTURES_DIR), "utf8"));
    expect(raw.dimension.geo.category.index).toEqual({ ES: 0, UK: 1 });
    expect(raw.value["0"]).toBe(0.2669);
    // Only ES is present — the whole reason the UK tariff is pending.
    expect(Object.keys(raw.value)).toEqual(["0"]);
  });

  it("the REE peninsular pull's unrounded factor is exactly what AC4's CO2 figure must use", () => {
    const raw = JSON.parse(readFileSync(new URL("ree-emissions-peninsular-2025.raw", FIXTURES_DIR), "utf8"));
    const factorRow = raw.included.find((row: { id: string }) => row.id === "MWh");
    expect(factorRow.attributes.values[0].value).toBe(0.08613556944796785);
  });

  it("the peninsular factor is below the national control pull's factor (the sanity check the block requires)", () => {
    const peninsular = JSON.parse(readFileSync(new URL("ree-emissions-peninsular-2025.raw", FIXTURES_DIR), "utf8"));
    const national = JSON.parse(readFileSync(new URL("ree-emissions-nacional-control-2025.raw", FIXTURES_DIR), "utf8"));
    const factor = (doc: any) => doc.included.find((r: { id: string }) => r.id === "MWh").attributes.values[0].value;
    const total = (doc: any) => doc.included.find((r: { id: string }) => r.id === "tCO2 eq.").attributes.values[0].value;
    expect(factor(peninsular)).toBeLessThan(factor(national));
    // The block's own sanity figure: national reads 0.11 to two decimals
    // (29,526,035.9 t).
    expect(total(national)).toBeCloseTo(29_526_035.9, 0);
  });
});
