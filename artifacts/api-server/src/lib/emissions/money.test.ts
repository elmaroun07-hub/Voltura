import { describe, expect, it } from "vitest";
import { findCountry, loadCountries } from "./countries";
import { describeInstallCost, describeSaving, resolveMoney } from "./money";

/**
 * H-SRC-ES-UK — the money pipeline. Reads the REAL data/sources/countries.yaml
 * (no hardcoded carbon or money value in this file), and everything else is a
 * synthetic MoneyInput so each pending/used branch is reachable and provable.
 */

const countries = loadCountries();
const spain = findCountry("Spain", countries)!;
const uk = findCountry("United Kingdom", countries)!;

const NOW = new Date("2026-09-22T00:00:00Z");

describe("AC4 — Fuengirola-shaped Spain calculation: exact expected values", () => {
  it("3,860 kWh saved prices to 3,860 × the registry Eurostat ES value, in EUR", () => {
    const money = resolveMoney({
      country: spain,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 3860,
      pvKw: 4,
      batteryKwh: 10,
      now: NOW,
    });
    expect(money.currency).toBe("EUR");
    expect(money.tariff.status).toBe("used");
    if (money.tariff.status !== "used") throw new Error("unreachable");
    // Read from the registry, not typed in here — the tariff.value the
    // resolver actually used is what AC4's € figure is computed from.
    expect(money.annualSavings).toBeCloseTo(3860 * money.tariff.value, 2);
  });

  it("a battery-equipped Spanish system has no registry install cost (Spain is pending), regardless of battery", () => {
    const money = resolveMoney({
      country: spain,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 3860,
      pvKw: 4,
      batteryKwh: 10,
      now: NOW,
    });
    expect(money.installCost.status).toBe("pending");
    if (money.installCost.status !== "pending") throw new Error("unreachable");
    expect(money.installCost.reason).toBe("registry_cost_pending");
    expect(money.roi.status).toBe("pending");
  });
});

describe("P0.7 — a user-typed tariff always wins for a registry country", () => {
  it("overrides the registry tariff and labels itself 'your tariff'", () => {
    const money = resolveMoney({
      country: spain,
      userTariff: 0.31,
      userInstallCost: null,
      savingsKwh: 1000,
      pvKw: 4,
      batteryKwh: 0,
      now: NOW,
    });
    expect(money.tariff).toMatchObject({ status: "used", source: "user", value: 0.31, label: "your tariff" });
    expect(money.annualSavings).toBeCloseTo(310, 2);
  });
});

describe("P0.8 — a country outside the registry has NO money figure at all", () => {
  it("Tétouan-shaped input (country: null) renders every money field pending, never €0.250", () => {
    const money = resolveMoney({
      country: null,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 3883,
      pvKw: 4,
      batteryKwh: 10,
      now: NOW,
    });
    expect(money.currency).toBeNull();
    expect(money.tariff.status).toBe("pending");
    if (money.tariff.status !== "pending") throw new Error("unreachable");
    expect(money.tariff.reason).toBe("country_not_in_registry");
    expect(money.annualSavings).toBeNull();
    expect(money.installCost.status).toBe("pending");
    expect(money.roi.status).toBe("pending");
    expect(describeSaving(money)).not.toMatch(/0\.25|€/);
  });

  it("a user-typed tariff and install cost still work for a non-registry country (the user supplies both)", () => {
    const money = resolveMoney({
      country: null,
      userTariff: 0.4,
      userInstallCost: 9000,
      savingsKwh: 1000,
      pvKw: 4,
      batteryKwh: 0,
      now: NOW,
    });
    // currency is still null — a user tariff has no currency without a
    // registry country, so no amount can be labelled EUR or GBP by guessing.
    expect(money.currency).toBeNull();
    expect(money.annualSavings).toBeNull();
  });
});

describe("AC3 — a tariff past reviewBy renders stale and is never silently used", () => {
  it("resolves normally before reviewBy", () => {
    const money = resolveMoney({
      country: spain,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 1000,
      pvKw: 4,
      batteryKwh: 0,
      now: new Date("2027-02-12T00:00:00Z"),
    });
    expect(money.tariff.status).toBe("used");
  });

  it("renders pending, with a stale reason, the day after reviewBy — never silently used", () => {
    const money = resolveMoney({
      country: spain,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 1000,
      pvKw: 4,
      batteryKwh: 0,
      now: new Date("2027-02-13T00:00:00Z"),
    });
    expect(money.tariff.status).toBe("pending");
    if (money.tariff.status !== "pending") throw new Error("unreachable");
    expect(money.tariff.reason).toBe("registry_tariff_stale");
    expect(money.annualSavings).toBeNull();
  });
});

describe("UK — banded install cost, and the range/battery refusals", () => {
  it("a battery-free UK system in the 0-4 kW band prices from the DESNZ band, and computes a payback", () => {
    const money = resolveMoney({
      country: uk,
      userTariff: 0.28, // UK tariff is pending in the registry (Eurostat carries no UK value) — the user supplies one
      userInstallCost: null,
      savingsKwh: 2000,
      pvKw: 3,
      batteryKwh: 0,
      now: NOW,
    });
    expect(money.currency).toBe("GBP");
    expect(money.installCost.status).toBe("used");
    if (money.installCost.status !== "used" || money.installCost.source !== "registry_band") {
      throw new Error("expected a banded UK install cost");
    }
    expect(money.installCost.band).toEqual({ fromKw: 0, toKw: 4 });
    expect(money.installCost.amount).toBeGreaterThan(0);
    expect(money.roi.status).toBe("computed");
  });

  it("a UK system with a battery gets no registry install cost — the DESNZ figure is PV-only", () => {
    const money = resolveMoney({
      country: uk,
      userTariff: 0.28,
      userInstallCost: null,
      savingsKwh: 2000,
      pvKw: 3,
      batteryKwh: 5,
      now: NOW,
    });
    expect(money.installCost.status).toBe("pending");
    if (money.installCost.status !== "pending") throw new Error("unreachable");
    expect(money.installCost.reason).toBe("battery_not_in_registry_cost");
    expect(money.roi.status).toBe("pending");
  });

  it("the UK tariff itself is registry-pending (Eurostat has no UK value) unless the user supplies one", () => {
    const money = resolveMoney({
      country: uk,
      userTariff: null,
      userInstallCost: null,
      savingsKwh: 2000,
      pvKw: 3,
      batteryKwh: 0,
      now: NOW,
    });
    expect(money.tariff.status).toBe("pending");
    if (money.tariff.status !== "pending") throw new Error("unreachable");
    expect(money.tariff.reason).toBe("registry_tariff_pending");
    expect(money.currency).toBe("GBP"); // still known: it's the country's currency, just no priced value
    expect(money.annualSavings).toBeNull();
  });
});

describe("P0.4 — a Spain-shaped install-cost RANGE (if ever populated) never computes a payback from it", () => {
  it("a synthetic range entry renders low/high and refuses ROI, never a midpoint", () => {
    // Spain's REAL install cost is pending (UNEF has no publication stating a
    // range — see the ruling), so a range entry is built here to exercise the
    // "range never gets a payback" rule. countries.test.ts covers
    // parseCountries' own range validation from YAML; this is the money
    // pipeline's behaviour once such an entry exists.
    const synthetic = {
      ...spain,
      installCost: {
        status: "current" as const,
        kind: "range" as const,
        unit: "perKW" as const,
        currency: "EUR" as const,
        taxBasis: "all_taxes_included" as const,
        authority: "UNEF",
        authorityType: "industry" as const,
        publication: { title: "t", url: "u", published: "2026-01-01", retrieved: "2026-01-01" },
        edition: "test",
        low: 1100,
        high: 1500,
        note: "synthetic",
      },
    };
    const money = resolveMoney({
      country: synthetic,
      userTariff: 0.27,
      userInstallCost: null,
      savingsKwh: 1000,
      pvKw: 4,
      batteryKwh: 0,
      now: NOW,
    });
    expect(money.installCost.status).toBe("used");
    if (money.installCost.status !== "used" || money.installCost.source !== "registry_range") {
      throw new Error("expected a range install cost");
    }
    expect(money.installCost.low).toBe(4400);
    expect(money.installCost.high).toBe(6000);
    expect(money.roi.status).toBe("pending");
    expect(describeInstallCost(money)).toContain("–");
  });
});
