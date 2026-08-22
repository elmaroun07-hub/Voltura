import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

/**
 * Regression lock for the location -> irradiance path.
 *
 * Deterministic by construction: every outbound call is served from
 * calculate.fixtures.json, captured from live Nominatim and NASA POWER on
 * 22 Aug 2026. A test that needs the internet goes amber and gets ignored, and
 * this is the suite that has to still be trustworthy in a year.
 *
 * What it pins: NASA POWER keys monthly data YYYYMM. The code used to build
 * `2022${m}` from ["JAN",...], every lookup missed, and `|| 4.0` supplied a
 * fabricated 4.0 twelve times for every location on Earth - so Fuengirola and
 * Tetouan returned a byte-identical 4203 kWh / EUR 1050.70.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("./calculate.fixtures.json", import.meta.url), "utf8"),
);

const FUENGIROLA = "Fuengirola, Málaga, Spain";
const TETOUAN = "Tétouan, Morocco";
const TROMSO = "Tromsø, Norway";
const ALMERIA = "Almería, Spain";

const realFetch = globalThis.fetch;

/** Per-test hook to bend one NASA payload without touching the fixture file. */
let nasaTransform: (nasa: any, loc: string) => any = (n) => n;

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ id: 1, ...calc }),
    getHistory: async () => [],
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
}));

const { registerRoutes, fallbackIrradiance } = await import("./routes");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function findByCoords(lat: string | null, lon: string | null) {
  return Object.entries(fixtures).find(
    ([, f]) => f.lat.toFixed(4) === lat && f.lon.toFixed(4) === lon,
  );
}

beforeEach(() => {
  nasaTransform = (n) => n;
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    // The test's own calls to the server under test must not be intercepted.
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);

    if (url.includes("nominatim.openstreetmap.org")) {
      const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      const hit = fixtures[q];
      // Unknown location -> Nominatim's real empty-result shape.
      return json(hit ? hit.nominatim : []);
    }
    if (url.includes("power.larc.nasa.gov")) {
      const u = new URL(url);
      const hit = findByCoords(u.searchParams.get("latitude"), u.searchParams.get("longitude"));
      if (!hit) return json({}, 404);
      return json(nasaTransform(structuredClone(hit[1].nasa), hit[0]));
    }
    throw new Error(`unexpected outbound request in test: ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

async function serve() {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

async function calculate(base: string, location: string) {
  const res = await realFetch(`${base}/api/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Id": "a3a3a3a3-3333-4333-8333-a3a3a3a3a3a3",
    },
    body: JSON.stringify({
      location,
      energyUsage: 5000,
      pvWattage: 4000,
      batteryCapacity: 10,
    }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe("A3.1 regression pair — Fuengirola vs Tétouan", () => {
  it("does not return identical savings for two different cities", async () => {
    const { base, close } = await serve();
    const fuen = await calculate(base, FUENGIROLA);
    const tet = await calculate(base, TETOUAN);

    expect(fuen.status).toBe(200);
    expect(tet.status).toBe(200);

    // Non-equality only. They are ~110 km apart, so a small delta is
    // physically correct; any threshold here would be invented.
    expect(fuen.body.savingsKwh).not.toBe(tet.body.savingsKwh);
    expect(fuen.body.annualSavingsEur).not.toBe(tet.body.annualSavingsEur);
    expect(fuen.body.resolution.irradianceMonthly).not.toEqual(
      tet.body.resolution.irradianceMonthly,
    );
    await close();
  });

  it("consumes the real January irradiance, not a fabricated 4.0", async () => {
    const { base, close } = await serve();
    const fuen = await calculate(base, FUENGIROLA);

    expect(fuen.body.resolution.irradianceMonthly[0]).toBeCloseTo(2.6544, 4);
    expect(fuen.body.resolution.irradianceMonthly.every((v: number) => v === 4)).toBe(false);
    await close();
  });
});

describe("A3.2 strong pair — Tromsø vs Almería", () => {
  it("moves the number substantially across ~33 degrees of latitude", async () => {
    const { base, close } = await serve();
    const tromso = await calculate(base, TROMSO);
    const almeria = await calculate(base, ALMERIA);

    expect(tromso.body.resolution.lat).toBeGreaterThan(60);
    expect(almeria.body.resolution.lat).toBeLessThan(40);

    // Almería must out-generate Tromsø by a wide margin. The ratio is asserted
    // loosely: the claim is "latitude moves this a lot", not a tuned constant.
    expect(almeria.body.savingsKwh).toBeGreaterThan(tromso.body.savingsKwh * 1.5);
    await close();
  });
});

describe("A3.3 array length — the 202213 guard", () => {
  it("consumes exactly twelve months for every fixture", async () => {
    const { base, close } = await serve();
    for (const loc of [FUENGIROLA, TETOUAN, TROMSO, ALMERIA]) {
      const r = await calculate(base, loc);
      expect(r.body.resolution.irradianceMonthly).toHaveLength(12);
      expect(r.body.monthlyData).toHaveLength(12);
    }
    await close();
  });

  it("the fixtures really do carry the thirteenth annual-mean key", async () => {
    // If this ever fails, NASA changed shape and the guard above is untested.
    for (const loc of [FUENGIROLA, TETOUAN, TROMSO, ALMERIA]) {
      const keys = Object.keys(fixtures[loc].nasa.properties.parameter.ALLSKY_SFC_SW_DWN);
      expect(keys).toHaveLength(13);
      expect(keys).toContain("202213");
    }
  });
});

describe("A3.4 provenance", () => {
  it("reports nasa-live and a concrete year for a known-good location", async () => {
    const { base, close } = await serve();
    const r = await calculate(base, ALMERIA);

    expect(r.body.resolution.irradianceSource).toBe("nasa-live");
    expect(r.body.resolution.irradianceYear).toBe(2022);
    expect(r.body.resolution.nasaHttpStatus).toBe(200);
    expect(r.body.resolution.geocodeStatus).toBe("resolved");
    // Requested and present key sets agree - the A1 mismatch is closed.
    expect(r.body.resolution.nasaKeysPresent).toEqual(r.body.resolution.nasaKeysRequested);
    await close();
  });
});

describe("A3.5 fallback honesty", () => {
  it("one non-finite month fails the whole read and says fallback-lat", async () => {
    nasaTransform = (nasa) => {
      delete nasa.properties.parameter.ALLSKY_SFC_SW_DWN["202207"];
      return nasa;
    };
    const { base, close } = await serve();
    const r = await calculate(base, FUENGIROLA);

    expect(r.status).toBe(200);
    expect(r.body.resolution.irradianceSource).toBe("fallback-lat");
    expect(r.body.resolution.irradianceYear).toBeNull();
    // No partial-NASA state: not 11 real months plus one invented one.
    expect(r.body.resolution.irradianceMonthly).toHaveLength(12);
    expect(r.body.resolution.irradianceMonthly[0]).not.toBeCloseTo(2.6544, 4);
    // The fallback still runs on the real geocoded latitude.
    expect(r.body.resolution.lat).toBeCloseTo(36.5388, 4);
    await close();
  });

  it("a non-finite temperature month fails the read too", async () => {
    nasaTransform = (nasa) => {
      delete nasa.properties.parameter.T2M["202203"];
      return nasa;
    };
    const { base, close } = await serve();
    const r = await calculate(base, FUENGIROLA);

    expect(r.body.resolution.irradianceSource).toBe("fallback-lat");
    await close();
  });

  it("fallbackIrradiance throws on a non-finite latitude rather than defaulting to 45", async () => {
    expect(() => fallbackIrradiance(Number.NaN)).toThrow(/non-finite latitude/);
    expect(() => fallbackIrradiance(undefined as unknown as number)).toThrow(/non-finite latitude/);
    // Latitude 0 is a real place. The old `lat || 45` moved the equator to 45N.
    expect(() => fallbackIrradiance(0)).not.toThrow();
    expect(fallbackIrradiance(0).irradiance).toHaveLength(12);
    expect(fallbackIrradiance(0).irradiance).not.toEqual(fallbackIrradiance(45).irradiance);
  });
});

describe("A3.5b unresolvable location", () => {
  it("returns 422 carrying a not-reached provenance record", async () => {
    const { base, close } = await serve();
    const r = await calculate(base, "Xqzzyvwmpq Nowhereville 99999");

    expect(r.status).toBe(422);
    expect(r.body.code).toBe("geocode_failed");
    expect(r.body.resolution.geocodeStatus).toBe("failed");
    expect(r.body.resolution.irradianceSource).toBe("not-reached");
    expect(r.body.resolution.nasaHttpStatus).toBe("not-called");
    expect(r.body.resolution.lat).toBeNull();
    expect(r.body.resolution.irradianceMonthly).toEqual([]);
    await close();
  });
});
