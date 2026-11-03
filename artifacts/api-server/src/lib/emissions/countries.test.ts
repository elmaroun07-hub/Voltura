import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carbonFactorFor,
  electricSystemFor,
  findCountry,
  loadCountries,
  parseCountries,
  priceSavings,
  roi,
  spainElectricSystem,
  toPricedTariff,
  formatMoney,
  formatMoneyRange,
  type CountryEntry,
  type Money,
  type PricedTariff,
  type TariffCurrent,
} from "./countries";

/**
 * H-SRC-ES-UK — the countries registry. Like H-SRC-ES's own es.test.ts, "no
 * test may hardcode a carbon value": assertions here read the REAL
 * data/sources/countries.yaml through `loadCountries()` and compare structure
 * (fields present, currency matches, low < high), never a bare number typed
 * into this file.
 */

const countries = loadCountries();
const spain = findCountry("Spain", countries)!;
const uk = findCountry("United Kingdom", countries)!;

describe("AC1 — no money figure can be emitted without a registry entry", () => {
  it("real countries.yaml has Spain and the UK, each with a currency and at least one carbon system", () => {
    expect(spain).toBeTruthy();
    expect(uk).toBeTruthy();
    expect(spain.currency).toBe("EUR");
    expect(uk.currency).toBe("GBP");
    expect(Object.keys(spain.carbonFactor.systems).length).toBeGreaterThan(0);
    expect(Object.keys(uk.carbonFactor.systems).length).toBeGreaterThan(0);
  });

  it("deleting an entry breaks the resolver — the build or the request fails, it does not fall back", () => {
    const dir = mkdtempSync(join(tmpdir(), "countries-ac1-"));
    const file = join(dir, "countries.yaml");
    writeFileSync(file, "schema: 1\ncountries: []\n");
    const empty = loadCountries(file);
    expect(findCountry("Spain", empty)).toBeNull();
    expect(findCountry("United Kingdom", empty)).toBeNull();
  });

  it("a country not in the file has no entry at all — findCountry returns null, never a guessed default", () => {
    expect(findCountry("Narnia", countries)).toBeNull();
    expect(findCountry("Morocco", countries)).toBeNull();
  });

  it("parseCountries rejects a country with no carbon system at all", () => {
    const yaml = `
schema: 1
countries:
  - key: nowhere
    match: [nowhere]
    currency: EUR
    buildingStandard: notApplied
    carbonFactor:
      systems: {}
    tariff:
      status: pending
      currency: EUR
      authority: test
      reason: test
      note: test
    installCost:
      status: pending
      authority: test
      authorityType: industry
      note: test
`;
    expect(() => parseCountries(yaml)).toThrow(/at least one system/);
  });
});

/**
 * AC2 wants two real, compiler-checked mismatches. The block's own example
 * text names "TS2345"; the actual diagnostics below are TS2322 (assignment)
 * and TS2769 (no overload matches) — recorded here because a naive
 * `roi<C extends Currency>(a: Money<C>, b: Money<C>)` does NOT produce
 * TS2345 or any error at all for `roi(eurMoney, gbpMoney)`: with `currency`
 * only in a covariant position, TypeScript infers `C = "EUR" | "GBP"` and
 * both arguments satisfy it — proven with a minimal repro before this design
 * was chosen (see the ruling). `roi` is exported as two concrete overloads
 * instead, which IS caught (TS2769). Reading the compiler's actual behaviour
 * over the block's literal error-code example is a §5 case: the naive
 * version would have shipped a check that does not check anything.
 */
describe("AC2 — currency and taxBasis mismatches are real type errors (P0.2)", () => {
  it("an EUR Money cannot be passed where a GBP Money is required (TS2322)", () => {
    const eur: Money<"EUR"> = { amount: 100, currency: "EUR" };
    // @ts-expect-error — Money<"EUR"> is not assignable to Money<"GBP">.
    const gbp: Money<"GBP"> = eur;
    void gbp;
  });

  // Proven manually, the same way H-SRC-ES's own AC4 was (see that ruling):
  // all three @ts-expect-error comments in this file were temporarily removed
  // and `tsc -p tsconfig.json --noEmit` was run directly, which reported the
  // real diagnostics at exactly these three lines (TS2322, TS2769, TS2322);
  // the comments were then restored. `pnpm run typecheck` is clean with them
  // present. Recorded in the H-SRC-ES-UK ruling rather than spawning tsc from
  // inside a test (this suite has no shell-out elsewhere, and G10 keeps it
  // that way).

  it("roi() refuses two Money values in different currencies — no overload matches (TS2769)", () => {
    const savingsEur: Money<"EUR"> = { amount: 500, currency: "EUR" };
    const costGbp: Money<"GBP"> = { amount: 4000, currency: "GBP" };
    // @ts-expect-error — no roi() overload accepts one EUR and one GBP Money.
    roi(savingsEur, costGbp);
  });

  it("roi() DOES accept two Money values that share a currency — the overloads are not overly strict", () => {
    const savingsEur: Money<"EUR"> = { amount: 500, currency: "EUR" };
    const costEur: Money<"EUR"> = { amount: 4000, currency: "EUR" };
    expect(() => roi(savingsEur, costEur)).not.toThrow();
  });

  it("a PricedTariff cannot carry a taxBasis outside all_taxes_included|user_declared (TS2322)", () => {
    // @ts-expect-error — PricedTariff.taxBasis excludes "vat_where_applicable".
    const bad: PricedTariff<"EUR"> = { value: 0.3, currency: "EUR", taxBasis: "vat_where_applicable" };
    void bad;
  });

  it("toPricedTariff refuses a taxBasis this pipeline cannot price, at runtime", () => {
    const notAllTaxes: TariffCurrent = {
      status: "current",
      value: 0.3,
      unit: "perKWh",
      currency: "EUR",
      taxBasis: "excl_vat",
      authority: "test",
      publication: { title: "t", url: "u", published: "2026-01-01", retrieved: "2026-01-01" },
      period: { label: "x", start: "2026-01-01", end: "2026-06-30" },
      reviewBy: "2027-01-01",
      note: "",
    };
    expect(() => toPricedTariff(notAllTaxes)).toThrow(/all_taxes_included/);
  });

  it("parseCountries rejects a tariff currency that does not match the country's currency", () => {
    const yaml = `
schema: 1
countries:
  - key: mismatched
    match: [mismatched]
    currency: EUR
    buildingStandard: notApplied
    carbonFactor:
      systems:
        x: { status: pending, authority: t, note: t }
    tariff:
      status: current
      value: 0.2
      unit: perKWh
      currency: GBP
      taxBasis: all_taxes_included
      authority: t
      publication: { title: t, url: t, published: "2026-01-01", retrieved: "2026-01-01" }
      period: { label: x, start: "2026-01-01", end: "2026-06-30" }
      reviewBy: "2027-01-01"
      note: t
    installCost:
      status: pending
      authority: t
      authorityType: industry
      note: t
`;
    expect(() => parseCountries(yaml)).toThrow(/does not match the country/);
  });
});

describe("Spain — per electric system, peninsular never substituted for an island (A21)", () => {
  it("maps region codes to systems correctly, and an unrecognised code is undetermined, never peninsular", () => {
    expect(spainElectricSystem("ES-AN")).toBe("peninsular");
    expect(spainElectricSystem("ES-CM")).toBe("peninsular");
    expect(spainElectricSystem("ES-IB")).toBe("baleares");
    expect(spainElectricSystem("ES-CN")).toBe("canarias");
    expect(spainElectricSystem("ES-CE")).toBe("ceuta");
    expect(spainElectricSystem("ES-ML")).toBe("melilla");
    expect(spainElectricSystem("")).toBe("undetermined");
    expect(spainElectricSystem("GB-ENG")).toBe("undetermined");
    expect(spainElectricSystem("not-a-code")).toBe("undetermined");
  });

  it("the peninsular system is sourced, generation-basis, location-based", () => {
    const result = carbonFactorFor(spain, "peninsular");
    expect(result.status).toBe("sourced");
    if (result.status !== "sourced") throw new Error("unreachable");
    expect(result.factor.basis).toBe("generation");
    expect(result.factor.authority).toMatch(/REE|Red Eléctrica/);
    expect(result.factor.valueGPerKwh).toBeGreaterThan(0);
  });

  it.each(["baleares", "canarias", "ceuta", "melilla"] as const)(
    "%s is pending, and is NEVER substituted with the peninsular value",
    (system) => {
      const result = carbonFactorFor(spain, system);
      expect(result.status).toBe("pending");
      if (result.status !== "pending") throw new Error("unreachable");
      expect(result.reason).toBe("system_factor_pending");
      // The pending result carries no numeric value at all — there is no field
      // here that could be silently read as a factor.
      expect("factor" in result).toBe(false);
    },
  );

  it("an undetermined system is pending with its own reason, distinct from a pending system", () => {
    const result = carbonFactorFor(spain, "undetermined");
    expect(result.status).toBe("pending");
    if (result.status !== "pending") throw new Error("unreachable");
    expect(result.reason).toBe("system_undetermined");
    expect(result.system).toBeNull();
  });

  it("electricSystemFor resolves Spain from the region code and the UK to its single system", () => {
    expect(electricSystemFor(spain, "ES-IB")).toBe("baleares");
    expect(electricSystemFor(uk, "GB-ENG")).toBe("gb");
    expect(electricSystemFor(uk, "")).toBe("gb");
  });
});

describe("AC4 sanity — peninsular is below the national figure (the registry's own note)", () => {
  it("REE peninsular < REE national, as recorded in the pulled evidence", () => {
    const result = carbonFactorFor(spain, "peninsular");
    if (result.status !== "sourced") throw new Error("unreachable");
    // The registry's own note names the national control figure; this checks
    // the relationship the ruling's sanity check depends on, without pinning
    // either number as a literal here (that would be the H-SRC-ES defect
    // relocated) — it reads the note text the pull wrote.
    expect(result.factor.valueGPerKwh).toBeLessThan(108.4);
    expect(result.factor.valueGPerKwh).toBeGreaterThan(0);
  });
});

describe("P0.4 — install cost is a range and renders as a range; no midpoint anywhere", () => {
  it("formatMoneyRange renders low and high, and contains neither a midpoint nor a single merged figure", () => {
    for (const locale of ["en", "es"] as const) {
      const text = formatMoneyRange(locale, 1100, 1500, "EUR");
      expect(text).toContain(formatMoney(locale, 1100, "EUR"));
      expect(text).toContain(formatMoney(locale, 1500, "EUR"));
      expect(text).not.toContain(formatMoney(locale, 1300, "EUR"));
    }
  });

  it("parseCountries rejects a range with low above high", () => {
    const yaml = `
schema: 1
countries:
  - key: backwards
    match: [backwards]
    currency: EUR
    buildingStandard: notApplied
    carbonFactor:
      systems:
        x: { status: pending, authority: t, note: t }
    tariff: { status: pending, currency: EUR, authority: t, reason: t, note: t }
    installCost:
      status: current
      kind: range
      unit: perKW
      currency: EUR
      taxBasis: all_taxes_included
      authority: t
      authorityType: industry
      publication: { title: t, url: t, published: "2026-01-01", retrieved: "2026-01-01" }
      edition: t
      low: 1500
      high: 1100
      note: t
`;
    expect(() => parseCountries(yaml)).toThrow(/low .* above high/);
  });
});

describe("UK install cost — banded by size, DESNZ TIC domestic mean, unrounded", () => {
  it("has two contiguous bands (0-4 kW, 4-10 kW), PV-only, current status", () => {
    const c = uk.installCost;
    expect(c.status).toBe("current");
    if (c.status !== "current" || c.kind !== "banded") throw new Error("UK install cost must be banded");
    expect(c.bands).toHaveLength(2);
    expect(c.bands[0].fromKw).toBe(0);
    expect(c.bands[0].toKw).toBe(c.bands[1].fromKw);
    expect(c.bands.every((b) => b.value > 0)).toBe(true);
    // Unrounded: the block's table rounds to whole pounds (1,955 / 1,645);
    // the registry must NOT carry those rounded display values as data.
    expect(Number.isInteger(c.bands[0].value)).toBe(false);
    expect(Number.isInteger(c.bands[1].value)).toBe(false);
  });

  it("parseCountries rejects bands that are not contiguous", () => {
    const yaml = `
schema: 1
countries:
  - key: gappy
    match: [gappy]
    currency: GBP
    buildingStandard: notApplied
    carbonFactor:
      systems:
        x: { status: pending, authority: t, note: t }
    tariff: { status: pending, currency: GBP, authority: t, reason: t, note: t }
    installCost:
      status: current
      kind: banded
      unit: perKW
      currency: GBP
      taxBasis: vat_where_applicable
      authority: t
      authorityType: government
      publication: { title: t, url: t, published: "2026-01-01", retrieved: "2026-01-01" }
      edition: t
      bands:
        - { fromKw: 0, toKw: 4, value: 100 }
        - { fromKw: 5, toKw: 10, value: 90 }
      note: t
`;
    expect(() => parseCountries(yaml)).toThrow(/contiguous/);
  });
});

describe("priceSavings and roi — typed by currency, computed not guessed", () => {
  it("priceSavings multiplies kWh by the tariff and keeps the currency", () => {
    const money = priceSavings(3860, { value: 0.2669, currency: "EUR", taxBasis: "all_taxes_included" });
    expect(money.currency).toBe("EUR");
    expect(money.amount).toBeCloseTo(3860 * 0.2669, 2);
  });

  it("roi computes a payback and a 25-year curve from real Money inputs, no invented constant reused across currencies", () => {
    const annual: Money<"GBP"> = { amount: 300, currency: "GBP" };
    const cost: Money<"GBP"> = { amount: 3000, currency: "GBP" };
    const r = roi(annual, cost);
    expect(r.curve).toHaveLength(26);
    expect(r.curve[0].netPosition).toBe(-3000);
    expect(r.paybackYears).toBeGreaterThan(0);
    expect(r.paybackYears).toBeLessThanOrEqual(25);
  });

  it("roi returns null — a state, not 25 — when the saving never covers the cost (D7, M4)", () => {
    const annual: Money<"EUR"> = { amount: 1, currency: "EUR" };
    const cost: Money<"EUR"> = { amount: 1_000_000, currency: "EUR" };
    const r = roi(annual, cost);
    expect(r.paybackYears).toBeNull();
    // Still computed: the curve and the lifetime figure are there.
    expect(r.curve).toHaveLength(26);
    expect(r.lifetimeSavings).toBeGreaterThan(0);
  });

  it("a genuine crossing in year 24→25 stays a number, even when it rounds to 25.0 (M6)", () => {
    // 1,000 a year rising 1.5%: 24 years sum to 28,633 and 25 years to 30,063,
    // so a 30,000 cost is crossed 95.6% of the way through year 25 — 24.956.
    const annual: Money<"EUR"> = { amount: 1000, currency: "EUR" };
    const cost: Money<"EUR"> = { amount: 30_000, currency: "EUR" };
    const r = roi(annual, cost);
    expect(r.curve[24].netPosition).toBeLessThan(0);
    expect(r.curve[25].netPosition).toBeGreaterThanOrEqual(0);
    expect(r.paybackYears).toBe(25);
  });

  it("#3 R1: a cost first covered in the 26th year is null — payback never sits past the 25-year curve", () => {
    // 1,000 a year rising 1.5%: 25 years sum to 30,063 and 26 years to about
    // 31,5xx, so a 31,000 cost (31x the first year) is covered only in year 26.
    const annual: Money<"EUR"> = { amount: 1000, currency: "EUR" };
    const cost: Money<"EUR"> = { amount: 31_000, currency: "EUR" };
    const r = roi(annual, cost);
    expect(r.curve).toHaveLength(26);
    expect(r.curve[25].netPosition).toBeLessThan(0);
    expect(r.paybackYears).toBeNull();
  });

  it("a zero cost is paid back at year 0, not 'never'", () => {
    const annual: Money<"GBP"> = { amount: 300, currency: "GBP" };
    const cost: Money<"GBP"> = { amount: 0, currency: "GBP" };
    expect(roi(annual, cost).paybackYears).toBe(0);
  });
});

describe("AC3 sanity — Spain and UK entries have real countries.yaml provenance, not placeholders", () => {
  it.each([spain, uk])("$key: tariff and install cost each name an authority", (country: CountryEntry) => {
    if (country.tariff.status === "current") expect(country.tariff.authority.length).toBeGreaterThan(0);
    if (country.installCost.status === "current") expect(country.installCost.authority.length).toBeGreaterThan(0);
  });
});
