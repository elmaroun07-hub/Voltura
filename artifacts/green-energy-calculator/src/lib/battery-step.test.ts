import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculationInputSchema } from "./api";

/**
 * #9 N4: battery_capacity is an integer column, so the form must not offer a
 * half step the API refuses.
 */
describe("#9 N4 — the form offers only whole kWh", () => {
  it("the battery slider steps by 1", () => {
    const src = readFileSync(new URL("../components/calculator/CalculatorForm.tsx", import.meta.url), "utf8");
    const slider = src.slice(src.indexOf('data-testid="slider-battery-capacity"'));
    expect(slider.slice(0, 200)).toMatch(/step=\{1\}/);
  });

  it("the client schema refuses a fractional battery, as the server does", () => {
    const base = { location: "Madrid", energyUsage: 5000, pvWattage: 4000 };
    expect(calculationInputSchema.safeParse({ ...base, batteryCapacity: 4.5 }).success).toBe(false);
    expect(calculationInputSchema.safeParse({ ...base, batteryCapacity: 4 }).success).toBe(true);
  });
});
