import { describe, expect, it } from "vitest";
import { resolveCarbonSource, carbonIntensityKgPerKwh } from "./carbon-source";
import { resolveEsConsumerCarbonFactor } from "./es";

describe("resolveCarbonSource — the four honest states", () => {
  it("Spain resolves to the sourced registry factor, not the legacy table", () => {
    const source = resolveCarbonSource("Spain", "Toledo, Spain");
    expect(source.status).toBe("sourced");
    if (source.status === "sourced") {
      expect(source.country).toBe("spain");
      expect(source.factor.basis).toBe("supply_residual");
    }
  });

  it("is case- and whitespace-insensitive on the geocoded country for Spain", () => {
    expect(resolveCarbonSource("  SPAIN  ", "x").status).toBe("sourced");
    expect(resolveCarbonSource("spain", "x").status).toBe("sourced");
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
    const factor = resolveEsConsumerCarbonFactor();
    const kg = carbonIntensityKgPerKwh({ status: "sourced", country: "spain", factor });
    expect(kg).toBeCloseTo(factor.valueGPerKwh / 1000, 9);
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
