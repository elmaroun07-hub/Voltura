import { describe, expect, it } from "vitest";
import { resolveCarbonSource, carbonIntensityKgPerKwh } from "./carbon-source";
import { loadCountries } from "./countries";

describe("resolveCarbonSource — the five honest states", () => {
  it("a mainland Spanish address resolves to the sourced PENINSULAR factor (A21), not the legacy table", () => {
    const source = resolveCarbonSource("Spain", "Toledo, Spain", "ES-CM");
    expect(source.status).toBe("sourced");
    if (source.status === "sourced") {
      expect(source.country).toBe("spain");
      expect(source.factor.system).toBe("peninsular");
      expect(source.factor.basis).toBe("generation");
    }
  });

  it("is case- and whitespace-insensitive on the geocoded country for Spain", () => {
    expect(resolveCarbonSource("  SPAIN  ", "x", "ES-AN").status).toBe("sourced");
    expect(resolveCarbonSource("spain", "x", "ES-AN").status).toBe("sourced");
  });

  it("the United Kingdom resolves through the registry, and is absent from the legacy table", () => {
    const source = resolveCarbonSource("United Kingdom", "London", "GB-ENG");
    expect(source.status).toBe("sourced");
    if (source.status === "sourced") {
      expect(source.factor.system).toBe("gb");
      expect(source.factor.authority).toMatch(/DESNZ/);
    }
  });

  it.each(["ES-IB", "ES-CN", "ES-CE", "ES-ML"])(
    "an address on %s is PENDING, never the peninsular factor (A21)",
    (code) => {
      const source = resolveCarbonSource("Spain", "an island", code);
      expect(source.status).toBe("pending");
      if (source.status === "pending") expect(source.reason).toBe("system_factor_pending");
      expect(() => carbonIntensityKgPerKwh(source)).toThrow(/must reject/);
    },
  );

  it("a Spanish address whose region code is missing is pending, not assumed peninsular", () => {
    for (const code of ["", "  ", "not-a-code", "GB-ENG"]) {
      const source = resolveCarbonSource("Spain", "somewhere", code);
      expect(source.status).toBe("pending");
      if (source.status === "pending") expect(source.reason).toBe("system_undetermined");
    }
  });

  it("a country still on the legacy table resolves as unsourced_legacy, unchanged in value", () => {
    const source = resolveCarbonSource("Morocco", "Tétouan");
    expect(source.status).toBe("unsourced_legacy");
    if (source.status === "unsourced_legacy") {
      expect(source.valueKgPerKwh).toBe(0.543);
    }
  });

  it("D15: an unknown country is a typed rejection, never a substituted number", () => {
    const source = resolveCarbonSource("Bhutan", "Thimphu");
    expect(source.status).toBe("unknown_country");
    if (source.status === "unknown_country") {
      expect(source.attempted).toBe("Bhutan");
    }
  });

  it("an empty geocoded country with unresolvable free text is also unknown_country", () => {
    const source = resolveCarbonSource("", "somewhere unrecognisable");
    expect(source.status).toBe("unknown_country");
  });
});

describe("carbonIntensityKgPerKwh", () => {
  it("returns the registry value in kg/kWh for a sourced Spain result", () => {
    const spain = loadCountries().find((c) => c.key === "spain")!;
    const entry = spain.carbonFactor.systems.peninsular;
    if (entry.status !== "current") throw new Error("peninsular entry must be current");
    const source = resolveCarbonSource("Spain", "x", "ES-AN");
    expect(carbonIntensityKgPerKwh(source)).toBeCloseTo(entry.value / 1000, 12);
  });

  it("returns the bare legacy value unchanged for unsourced_legacy", () => {
    const kg = carbonIntensityKgPerKwh({
      status: "unsourced_legacy",
      country: "Morocco",
      valueKgPerKwh: 0.543,
    });
    expect(kg).toBe(0.543);
  });

  it("throws rather than substituting a number for unknown_country", () => {
    expect(() =>
      carbonIntensityKgPerKwh({ status: "unknown_country", attempted: "Bhutan" }),
    ).toThrow(/must reject/);
  });

  it("throws rather than substituting a number for not_reached", () => {
    expect(() => carbonIntensityKgPerKwh({ status: "not_reached" })).toThrow(/must reject/);
  });
});
