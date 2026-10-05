import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { resolveCarbonSource } from "../lib/emissions/carbon-source";
import { CARBON_INTENSITY_BY_COUNTRY } from "../lib/carbon-intensity";

/**
 * H-ASST-D16-N3 Part B — the country comes from the geocoder, never from the free text.
 *
 * D16: a country outside both tables fell through to a token walk over the
 * user's own text, so "Little Italy, Cairo, Egypt" got Italy's factor. On
 * 5 Oct 2026 that string no longer geocodes at all, but the walk was still
 * live: "Little India, Singapore" geocodes to Singapore and got India's 0.708
 * (refusal B.1, ruled (b)). The lookup now keys on Nominatim's structured
 * `address.country_code`; a code neither table carries takes the existing
 * no-figure path, a 400 `unknown_carbon_country`.
 *
 * G10: the Nominatim answers are the raw responses recorded on 5 Oct
 * (contracts/evidence/h-asst-d16-n3/), read as files. One is synthetic and
 * says so: Egypt as it geocoded when D16 was found, since it no longer does.
 * NASA answers 404, so the route takes its labelled latitude fallback - the
 * carbon decision does not depend on irradiance. Anything else throws.
 */

const EVIDENCE = new URL("../../../../contracts/evidence/h-asst-d16-n3/", import.meta.url);
const recorded = (n: number) => JSON.parse(readFileSync(new URL(`b1-nominatim-${n}.json`, EVIDENCE), "utf8"));

const EGYPT_AS_IT_GEOCODED = [
  { lat: "30.0444", lon: "31.2357", display_name: "Cairo, Egypt", address: { city: "Cairo", country: "Egypt", country_code: "eg" } },
];

let nominatim: Record<string, unknown[]> = {};
const SESSION = "d16d16d1-6666-4666-8666-d16d16d16d16";
const realFetch = globalThis.fetch;

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ ...calc, id: 1 }),
    getHistory: async () => [],
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
}));

const { registerRoutes } = await import("./routes");

beforeEach(() => {
  nominatim = {
    "Little Italy, Cairo, Egypt": recorded(1),
    "Jordan, Minnesota, United States": recorded(2),
    "Lebanon, Pennsylvania, United States": recorded(3),
    "Atlanta, Georgia, United States": recorded(4),
    "Little India, Singapore": recorded(5),
    "Little Italy, Cairo": recorded(6),
  };
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    if (url.includes("nominatim.openstreetmap.org")) {
      const q = new URL(url).searchParams.get("q") ?? "";
      return new Response(JSON.stringify(nominatim[q] ?? []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("power.larc.nasa.gov")) return new Response("{}", { status: 404 });
    throw new Error(`unexpected outbound request in test: ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

async function calculate(location: string) {
  const app = express();
  app.use(express.json());
  await registerRoutes(createServer(app), app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await realFetch(`http://127.0.0.1:${port}/api/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": SESSION },
      body: JSON.stringify({ location, energyUsage: 4000, pvWattage: 3000, batteryCapacity: 5 }),
    });
    return { status: res.status, body: (await res.json()) as any };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const US = CARBON_INTENSITY_BY_COUNTRY["united states"];
const WRONG = new Set([CARBON_INTENSITY_BY_COUNTRY["italy"], CARBON_INTENSITY_BY_COUNTRY["india"]]);

describe("D16 — each string gets its own country's factor, or the existing no-figure path", () => {
  it("Little Italy, Cairo, Egypt: as Nominatim answers today, geocode_failed - no figure at all", async () => {
    const r = await calculate("Little Italy, Cairo, Egypt");
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("geocode_failed");
  });

  it("Little Italy, Cairo, Egypt: geocoded to Egypt, the no-figure path - never Italy's 0.351", async () => {
    nominatim["Little Italy, Cairo, Egypt"] = EGYPT_AS_IT_GEOCODED;
    const r = await calculate("Little Italy, Cairo, Egypt");
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("unknown_carbon_country");
    expect(r.body.resolution.carbonSource).toEqual({ status: "unknown_country", attempted: "Egypt" });
  });

  it("Little India, Singapore: the no-figure path - never India's 0.708", async () => {
    const r = await calculate("Little India, Singapore");
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("unknown_carbon_country");
    expect(r.body.resolution.carbonSource).toEqual({ status: "unknown_country", attempted: "Singapore" });
  });

  it.each([
    "Jordan, Minnesota, United States",
    "Lebanon, Pennsylvania, United States",
    "Atlanta, Georgia, United States",
    // B-a: the display string reads "... Little Italy, Near West Side, Chicago ...".
    "Little Italy, Cairo",
  ])("%s: the United States' factor, from its country code", async (location) => {
    const r = await calculate(location);
    expect(r.status).toBe(200);
    expect(r.body.carbonIntensity).toBe(US);
    expect(WRONG.has(r.body.carbonIntensity)).toBe(false);
    expect(r.body.resolution.carbonSource).toEqual({ status: "unsourced_legacy", country: "United States", valueKgPerKwh: US });
  });
});

describe("D16 — the lookup reads the structured code, not a name", () => {
  it("the code alone decides: a missing or foreign-language name changes nothing", () => {
    expect(resolveCarbonSource("us", "", "Atlanta").status).toBe("unsourced_legacy");
    expect(resolveCarbonSource("us", "Estados Unidos", "Atlanta")).toMatchObject({ valueKgPerKwh: US });
    expect(resolveCarbonSource("es", "España", "Toledo", "ES-CM").status).toBe("sourced");
  });

  it("a name with no code is the no-figure path, whatever the name or the text says", () => {
    for (const [name, text] of [["Italy", "Rome, Italy"], ["", "Little Italy, Cairo, Egypt"], ["India", "Mumbai"]]) {
      expect(resolveCarbonSource("", name, text).status).toBe("unknown_country");
    }
  });
});
