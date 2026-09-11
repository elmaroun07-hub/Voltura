import { describe, expect, it } from "vitest";
import {
  DAYS_PER_YEAR,
  SIZING_DEFAULTS,
  sizePvAndBattery,
  sizingFailureMessage,
  type SizingInputs,
} from "./sizing";

/**
 * H-OPT — the sizing arithmetic, tested against numbers computed by hand rather
 * than against the implementation's own output.
 *
 * Offline by construction: this module imports nothing, touches no clock and
 * opens no socket, so G10 is satisfied by the code rather than by a stub.
 *
 * Every expectation below is derived from the two formulas in the block file:
 *
 *   PV_kWp      = (coverage x daily_kWh / performance_ratio) / irradiance
 *   Battery_kWh = (night_kWh / round_trip_eff) / usable_DoD
 */

/** The web client's fixed 24-hour shape. It sums to 102, which is the point. */
const CLIENT_PROFILE = [
  2, 2, 2, 2, 3, 5, 8, 8, 6, 4, 3, 3, 3, 3, 4, 5, 7, 10, 8, 5, 3, 2, 2, 2,
];

/** The production solar profile: zero before 06:00 and after 20:00. */
const SOLAR_PROFILE: number[] = (() => {
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (h < 6 || h > 20) return 0;
    return Math.exp(-0.5 * Math.pow((h - 12) / 3.5, 2));
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / sum);
})();

function inputs(over: Partial<SizingInputs> = {}): SizingInputs {
  return {
    annualUsageKwh: 5000,
    hourlyLoadShape: CLIENT_PROFILE,
    hourlySolarShape: SOLAR_PROFILE,
    irradianceKwhM2Day: 5.05,
    ...over,
  };
}

function sizeOrThrow(over: Partial<SizingInputs> = {}) {
  const r = sizePvAndBattery(inputs(over));
  if (!r.ok) throw new Error(`unexpected sizing failure: ${r.failure.kind}`);
  return r.sizing;
}

describe("O.3 — the two formulas, by hand", () => {
  it("sizes Fuengirola's array from NASA's 5.05, not from a model's 4.5", () => {
    const s = sizeOrThrow({ irradianceKwhM2Day: 5.05 });

    // 5000 / 365          = 13.6986 kWh/day
    // 13.6986 / 0.80      = 17.1233 kWh/day of array output required
    // 17.1233 / 5.05      = 3.3908 kWp
    expect(s.dailyUsageKwh).toBeCloseTo(13.699, 3);
    expect(s.pvKwp).toBeCloseTo(3.391, 3);
    expect(s.pvWatts).toBe(3391);

    // Nothing near the 20,000-30,000 W the model used to return.
    expect(s.pvWatts).toBeLessThan(5000);
  });

  it("sizes Tetouan's array from NASA's 5.08, not from a model's 5.5", () => {
    const s = sizeOrThrow({ irradianceKwhM2Day: 5.08 });
    expect(s.pvKwp).toBeCloseTo(3.371, 3);

    // The difference between the two towns is small and REAL. A model quoting
    // 5.5 against 4.5 would have made it 22%, in the wrong direction.
    const fuengirola = sizeOrThrow({ irradianceKwhM2Day: 5.05 });
    expect(s.pvKwp).toBeLessThan(fuengirola.pvKwp);
  });

  it("sizes the battery from the night share of the load shape", () => {
    const s = sizeOrThrow();

    // The array produces nothing for 9 hours: 00-05 and 21-23.
    // Those hours carry 2+2+2+2+3+5 + 2+2+2 = 22 of the shape's 102 weights.
    expect(s.darkHours).toBe(9);
    expect(s.nightShare).toBeCloseTo(22 / 102, 4);

    // 13.6986 x 0.215686 = 2.9546 kWh overnight
    // 2.9546 / 0.90      = 3.2829
    // 3.2829 / 0.80      = 4.1036 kWh of nameplate
    expect(s.nightUsageKwh).toBeCloseTo(2.955, 3);
    expect(s.batteryKwh).toBeCloseTo(4.1, 2);
  });

  it("reports the assumptions it used, so the response can state them", () => {
    const s = sizeOrThrow();
    expect(s.performanceRatio).toBe(0.8);
    expect(s.roundTripEfficiency).toBe(0.9);
    expect(s.usableDepthOfDischarge).toBe(0.8);
    expect(s.coverageTarget).toBe(1);
    expect(s.daysPerYear).toBe(DAYS_PER_YEAR);
    expect(SIZING_DEFAULTS.coverageTarget).toBe(1);
  });

  it("is deterministic — same inputs, same numbers", () => {
    expect(sizeOrThrow()).toEqual(sizeOrThrow());
  });
});

describe("O.3 — one coverage target, applied to every location", () => {
  it("applies the same coverage to Tromso as to Almeria", () => {
    const tromso = sizeOrThrow({ irradianceKwhM2Day: 1.94 });
    const almeria = sizeOrThrow({ irradianceKwhM2Day: 5.0 });

    expect(tromso.coverageTarget).toBe(almeria.coverageTarget);

    // Same load, same target: the array scales as 1/irradiance and nothing
    // else. The old behaviour silently sized London to 40% of its load and
    // Tetouan to 100%, which is a coverage target nobody chose.
    expect(tromso.pvKwp * 1.94).toBeCloseTo(almeria.pvKwp * 5.0, 2);
  });

  it("a lower coverage target scales PV and leaves the battery alone", () => {
    const full = sizeOrThrow();
    const half = sizeOrThrow({ assumptions: { coverageTarget: 0.5 } });

    expect(half.pvKwp).toBeCloseTo(full.pvKwp / 2, 3);
    // Sizing the array to half the year does not make the night shorter.
    expect(half.batteryKwh).toBe(full.batteryKwh);
  });
});

describe("O.4 — the load is the user's usage, never the profile's sum", () => {
  it("doubling annual usage doubles both figures", () => {
    const base = sizeOrThrow({ annualUsageKwh: 5000 });
    const twice = sizeOrThrow({ annualUsageKwh: 10000 });

    expect(twice.pvKwp).toBeCloseTo(base.pvKwp * 2, 3);
    // One decimal, not two: batteryKwh is reported to 0.01 kWh, so twice the
    // rounded figure and the rounded doubled figure can legitimately differ by
    // a hundredth (4.10 x 2 = 8.20 against 8.2071 -> 8.21).
    expect(twice.batteryKwh).toBeCloseTo(base.batteryKwh * 2, 1);
  });

  it("the hourly profile is a shape: scaling it changes nothing", () => {
    const asGiven = sizeOrThrow();
    // x100. If any code path read this array as kWh, this would move.
    const scaled = sizeOrThrow({
      hourlyLoadShape: CLIENT_PROFILE.map((v) => v * 100),
    });

    expect(scaled).toEqual(asGiven);
  });

  it("does not size a 102 kWh/day house for a 5,000 kWh/year one", () => {
    const s = sizeOrThrow();
    // What the old route effectively assumed: the profile's sum as a daily
    // load. 102 / 0.8 / 5.05 = 25.25 kWp — the 20-30 kW array users saw.
    const asKwhPerDay = sizeOrThrow({ annualUsageKwh: 102 * DAYS_PER_YEAR });

    expect(asKwhPerDay.pvKwp).toBeGreaterThan(25);
    expect(s.pvKwp).toBeLessThan(4);
  });

  it("moving the load into the night grows the battery and not the array", () => {
    const daytime = Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 20 ? 1 : 0));
    const nighttime = Array.from({ length: 24 }, (_, h) => (h < 6 || h > 20 ? 1 : 0));

    const day = sizeOrThrow({ hourlyLoadShape: daytime });
    const night = sizeOrThrow({ hourlyLoadShape: nighttime });

    expect(day.batteryKwh).toBe(0);
    expect(night.nightShare).toBe(1);
    expect(night.batteryKwh).toBeGreaterThan(day.batteryKwh);
    expect(day.pvKwp).toBe(night.pvKwp);
  });
});

describe("O.3 — refusals, never substitutions (G5, P2)", () => {
  it("refuses a non-positive or non-finite irradiance rather than dividing", () => {
    for (const irradianceKwhM2Day of [0, -1, -999, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = sizePvAndBattery(inputs({ irradianceKwhM2Day }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.failure.kind).toBe("non-positive-irradiance");
      expect(sizingFailureMessage(r.failure)).toMatch(/irradiance/i);
    }
  });

  it("refuses a non-positive or non-finite annual usage", () => {
    for (const annualUsageKwh of [0, -5000, Number.NaN]) {
      const r = sizePvAndBattery(inputs({ annualUsageKwh }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.failure.kind).toBe("non-positive-usage");
    }
  });

  it("refuses a profile that is not 24 hours, or carries junk", () => {
    const cases: { shape: number[]; reason: string }[] = [
      { shape: [1, 2, 3], reason: "length" },
      { shape: Array.from({ length: 25 }, () => 1), reason: "length" },
      { shape: Array.from({ length: 24 }, (_, h) => (h === 3 ? Number.NaN : 1)), reason: "non-finite" },
      { shape: Array.from({ length: 24 }, (_, h) => (h === 3 ? -1 : 1)), reason: "negative" },
      { shape: Array.from({ length: 24 }, () => 0), reason: "zero-sum" },
    ];

    for (const { shape, reason } of cases) {
      const r = sizePvAndBattery(inputs({ hourlyLoadShape: shape }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.failure).toEqual({ kind: "bad-shape", which: "load", reason });
    }
  });

  it("refuses an assumption that is not a ratio in (0, 1]", () => {
    for (const performanceRatio of [0, -0.5, 1.5, Number.NaN]) {
      const r = sizePvAndBattery(inputs({ assumptions: { performanceRatio } }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.failure).toEqual({
        kind: "bad-assumption",
        name: "performanceRatio",
        value: performanceRatio,
      });
    }
  });

  it("refuses a solar profile with no dark hours instead of returning 0 kWh", () => {
    const r = sizePvAndBattery(
      inputs({ hourlySolarShape: Array.from({ length: 24 }, () => 1 / 24) }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // "You need no battery" is a claim, and this input does not support it.
    expect(r.failure.kind).toBe("no-dark-hours");
  });

  it("every failure has a message, and none of them is a number", () => {
    const failures = [
      sizePvAndBattery(inputs({ irradianceKwhM2Day: 0 })),
      sizePvAndBattery(inputs({ annualUsageKwh: 0 })),
      sizePvAndBattery(inputs({ hourlyLoadShape: [] })),
      sizePvAndBattery(inputs({ assumptions: { roundTripEfficiency: 2 } })),
      sizePvAndBattery(inputs({ hourlySolarShape: Array.from({ length: 24 }, () => 1) })),
    ];

    for (const f of failures) {
      expect(f.ok).toBe(false);
      if (f.ok) return;
      expect(sizingFailureMessage(f.failure).length).toBeGreaterThan(10);
    }
  });
});
