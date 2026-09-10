import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Gate H1 criterion (ii), as amended by A20 — the guard against the REAL
 * fill value.
 *
 * A18 recorded (ii) as satisfied on the stated fact that a test consumes
 * `contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json`.
 * No test ever did. What A3.6 rejects is a `-999` the test itself writes into
 * a monthly fixture at run time (`calculate.test.ts:259`) — synthetic, which
 * is the one thing (ii) exists to exclude.
 *
 * The reason it was never wired is structural, not lazy: the fixture is a
 * DAILY response, keyed `20260821`, and production calls the MONTHLY endpoint,
 * keyed `202608`. It cannot be fed to the route unedited, and editing it to
 * fit is exactly what (ii) forbids. A20's answer is to exercise the guard
 * where it actually lives — as a pure function — rather than to build a daily
 * parse in production, which would add a surface `-999` could re-enter
 * through.
 *
 * So: unedited bytes, read from disk, hash-pinned. Every `-999` NASA really
 * sent, classified by the real guard, and the typed 422 it produces.
 *
 * G10 holds absolutely: this file reads one local JSON file and calls two pure
 * functions. There is no server, no fetch, and nothing to leak to the network.
 */

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({ storage: {}, chatStorage: {} }));

const { classifyNasaValue, nasaDataFailureToHttp } = await import("./routes");

const FIXTURE_URL = new URL(
  "../../../../contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json",
  import.meta.url,
);

/** The bytes, not a parsed-and-reserialised approximation of them. */
const bytes = readFileSync(FIXTURE_URL);
const fixture = JSON.parse(bytes.toString("utf8"));

/**
 * Pinned so the fixture cannot be "fixed" into passing.
 *
 * (ii) is a claim about an UNEDITED live response. If someone reshapes this
 * file into monthly keys, or trims the `-999` days, the claim silently becomes
 * false while every assertion below still passes. The hash is what makes
 * "unedited" checkable rather than asserted.
 */
const FIXTURE_SHA256 =
  "c526b22edbdbb4677a982b076c8ba60676cae7efd6b36e3b7e2ddb4bd4ce2706";

/** Every (parameter, key) NASA filled, found independently of the guard. */
function realFillValues(): Array<{ parameter: string; key: string }> {
  const hits: Array<{ parameter: string; key: string }> = [];
  for (const [parameter, series] of Object.entries<Record<string, unknown>>(
    fixture.properties.parameter,
  )) {
    for (const [key, value] of Object.entries(series)) {
      if (value === -999.0) hits.push({ parameter, key });
    }
  }
  return hits;
}

describe("H1 (ii), A20 — the guard against a real NASA fill value", () => {
  it("reads an unedited live NASA POWER response", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(FIXTURE_SHA256);

    // NASA's own header declares the sentinel. This is the response saying
    // what -999 means, not the test asserting it.
    expect(fixture.header.fill_value).toBe(-999.0);
    expect(fixture.header.api.name).toBe("POWER Daily API");

    // Daily keys, YYYYMMDD. Stated here because it is the whole reason the
    // route cannot consume this file and the classifier must.
    for (const key of Object.keys(fixture.properties.parameter.ALLSKY_SFC_SW_DWN)) {
      expect(key).toMatch(/^\d{8}$/);
    }
  });

  it("carries real fill values in both parameters", () => {
    const hits = realFillValues();

    // Exact, not "at least one": a fixture quietly swapped for a cleaner
    // capture would still satisfy a loose assertion while destroying the only
    // real -999 in the repository.
    expect(hits).toEqual([
      { parameter: "ALLSKY_SFC_SW_DWN", key: "20260821" },
      { parameter: "ALLSKY_SFC_SW_DWN", key: "20260822" },
      { parameter: "ALLSKY_SFC_SW_DWN", key: "20260823" },
      { parameter: "T2M", key: "20260823" },
    ]);
  });

  it("filters every -999 the response actually carries", () => {
    const hits = realFillValues();
    expect(hits.length).toBeGreaterThan(0);

    for (const { parameter, key } of hits) {
      const rawValue = fixture.properties.parameter[parameter][key];
      const classified = classifyNasaValue(rawValue);

      expect(classified.kind).toBe("fill");
      // The point of the guard: it never becomes a number.
      expect(classified).not.toHaveProperty("value");
    }
  });

  it("does not filter the readings NASA did supply", () => {
    // Over-rejection would be its own defect - a working month discarded as a
    // sentinel. Every non-fill value in the file is a usable reading.
    const filled = new Set(realFillValues().map((h) => `${h.parameter}:${h.key}`));
    let checked = 0;

    for (const [parameter, series] of Object.entries<Record<string, unknown>>(
      fixture.properties.parameter,
    )) {
      for (const [key, value] of Object.entries(series)) {
        if (filled.has(`${parameter}:${key}`)) continue;
        const classified = classifyNasaValue(value);
        expect(classified).toEqual({ kind: "value", value: Number(value) });
        checked++;
      }
    }

    expect(checked).toBe(18);
  });

  it("turns the real fill value into a typed 422 naming it", () => {
    const hits = realFillValues().filter((h) => h.parameter === "ALLSKY_SFC_SW_DWN");

    const typed = nasaDataFailureToHttp({
      kind: "fill-value",
      parameter: hits[0].parameter,
      keys: hits.map((h) => h.key),
    });

    expect(typed.status).toBe(422);
    expect(typed.code).toBe("nasa_fill_value");
    expect(typed.message).toContain("-999");
    expect(typed.message).toContain("20260821, 20260822, 20260823");
    // No number is offered in place of the missing one. That is the whole of
    // H1.0: a typed error, never a substitution.
    expect(typed.message).toContain("No irradiance figure can be computed");
  });
});
