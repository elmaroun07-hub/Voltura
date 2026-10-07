import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

/**
 * H-OPT — /api/optimize is grounded in NASA POWER, and the model only writes.
 *
 * The defect this file locks out, verified live on 2026-09-11: the route never
 * called NASA. It handed the location STRING to a language model, which answered
 * from its priors — about 5.5 kWh/m2/day for Tetouan where this codebase
 * computes 5.08, about 4.5 for Fuengirola where it computes 5.05 — and it read
 * the 24-entry pattern as absolute kWh, so every recommendation was sized for
 * the client's fixed 102 kWh/day profile against a 5,000 kWh/year house. A
 * 20,000-30,000 W array came back where the answer is about 3.4 kWp.
 *
 * Deterministic and offline: Nominatim and NASA POWER are served from
 * calculate.fixtures.json (captured live, 22 Aug 2026) and the model provider is
 * mocked. G10 — nothing here can reach the network.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("./calculate.fixtures.json", import.meta.url), "utf8"),
);

const FUENGIROLA = "Fuengirola, Málaga, Spain";
const TETOUAN = "Tétouan, Morocco";
const TROMSO = "Tromsø, Norway";

/** The web client's fixed hourly shape. It sums to 102. */
const CLIENT_PROFILE = [
  2, 2, 2, 2, 3, 5, 8, 8, 6, 4, 3, 3, 3, 3, 4, 5, 7, 10, 8, 5, 3, 2, 2, 2,
];

const realFetch = globalThis.fetch;

/** Per-test hook to bend one NASA payload without touching the fixture file. */
let nasaTransform: (nasa: any, loc: string) => any = (n) => n;

/** What the provider answers, and what it was asked. */
let modelReply: (userMessage: string) => string = () =>
  JSON.stringify({ explanation: "Sized from the figures provided." });
let lastUserMessage = "";
let modelCalls = 0;

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ id: 1, ...calc }),
    getHistory: async () => [],
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
}));

vi.mock("../lib/llm", () => ({
  llmModel: () => "test-model",
  llmApiKey: () => "test-key",
  llmBaseUrl: () => "https://example.invalid/v1",
  resetLlmClient: () => {},
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async (req: any) => {
          modelCalls++;
          lastUserMessage = String(req.messages[req.messages.length - 1].content);
          return { choices: [{ message: { content: modelReply(lastUserMessage) } }] };
        },
      },
    },
  }),
}));

/**
 * The rate limiter is replaced with a pass-through so that eleven requests in
 * one file do not start 429ing at the tenth. Its configuration is asserted
 * below instead of being silently discarded: /api/optimize spends money on a
 * paid API and the limit is the only thing standing between a scraper and a
 * bill.
 */
const rateLimitOptions: any[] = [];
vi.mock("express-rate-limit", () => ({
  default: (opts: any) => {
    rateLimitOptions.push(opts);
    return (_req: any, _res: any, next: any) => next();
  },
}));

const { registerRoutes } = await import("./routes");

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
  modelReply = () => JSON.stringify({ explanation: "Sized from the figures provided." });
  lastUserMessage = "";
  modelCalls = 0;
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);

    if (url.includes("nominatim.openstreetmap.org")) {
      const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      const hit = fixtures[q];
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

async function optimize(base: string, body: Record<string, unknown>) {
  const res = await realFetch(`${base}/api/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Id": "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f",
      // This suite pins the English text, so it asks for English (H2b: Spanish is the default).
      "Accept-Language": "en",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

function optimizeBody(over: Record<string, unknown> = {}) {
  return {
    location: FUENGIROLA,
    energyPattern: CLIENT_PROFILE,
    annualUsageKwh: 5000,
    ...over,
  };
}

async function calculate(base: string, location: string) {
  const res = await realFetch(`${base}/api/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Session-Id": "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f",
      // This suite pins the English text, so it asks for English (H2b: Spanish is the default).
      "Accept-Language": "en",
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

describe("O.1/O.2 — the optimizer calls NASA, not the model's memory", () => {
  it("sizes from the same irradiance /api/calculate reports for the same town", async () => {
    const { base, close } = await serve();
    const opt = await optimize(base, optimizeBody({ location: FUENGIROLA }));
    const calc = await calculate(base, FUENGIROLA);

    expect(opt.status).toBe(200);
    // One figure, one town. Two routes quoting two irradiances is the P5
    // failure this block closes.
    expect(opt.body.sizing.irradianceKwhM2Day).toBe(calc.body.avgIrradiance);
    expect(opt.body.sizing.irradianceKwhM2Day).toBeCloseTo(5.05, 2);

    // The model's prior for Fuengirola, live on 2026-09-11.
    expect(opt.body.sizing.irradianceKwhM2Day).not.toBeCloseTo(4.5, 1);

    // Provenance travels with it — the tab has something to show. O.7.
    expect(opt.body.resolution.irradianceSource).toBe("nasa-live");
    expect(opt.body.resolution.irradiancePeriod).toEqual({ start: 2019, end: 2023 });
    expect(opt.body.resolution.nasaHttpStatus).toBe(200);
    expect(opt.body.resolution.geocodeStatus).toBe("resolved");
    expect(opt.body.resolution.lat).toBeCloseTo(36.5388, 4);
    expect(opt.body.resolution.irradianceMonthly).toHaveLength(12);
    await close();
  });

  it("gives two nearby towns two different, real irradiances", async () => {
    const { base, close } = await serve();
    const fuen = await optimize(base, optimizeBody({ location: FUENGIROLA }));
    const tet = await optimize(base, optimizeBody({ location: TETOUAN }));

    expect(tet.body.sizing.irradianceKwhM2Day).toBeCloseTo(5.08, 2);
    expect(fuen.body.sizing.irradianceKwhM2Day).toBeCloseTo(5.05, 2);
    // The model said 5.5 against 4.5 — a 22% gap, in the wrong direction.
    expect(tet.body.sizing.irradianceKwhM2Day).toBeGreaterThan(
      fuen.body.sizing.irradianceKwhM2Day,
    );
    expect(tet.body.optimalPv).toBeLessThan(fuen.body.optimalPv);
    await close();
  });

  it("returns about 3.4 kWp for a 5,000 kWh/year house, not 20-30 kW", async () => {
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.body.optimalPv).toBe(3391);
    expect(r.body.sizing.pvKwp).toBeCloseTo(3.391, 3);
    expect(r.body.optimalBattery).toBeCloseTo(4.1, 2);
    expect(r.body.optimalPv).toBeLessThan(5000);
    await close();
  });

  it("moves the array with latitude, because it is reading the satellite", async () => {
    const { base, close } = await serve();
    const tromso = await optimize(base, optimizeBody({ location: TROMSO }));
    const fuen = await optimize(base, optimizeBody({ location: FUENGIROLA }));

    // Same load, 33 degrees apart: Tromso needs a far bigger array.
    expect(tromso.body.optimalPv).toBeGreaterThan(fuen.body.optimalPv * 2);
    expect(tromso.body.sizing.irradianceKwhM2Day).toBeLessThan(2.5);
    await close();
  });
});

describe("O.2 — the parse boundary applies here too", () => {
  it("returns a typed 422 and no size when NASA fills a month with -999", async () => {
    nasaTransform = (nasa) => {
      nasa.properties.parameter.ALLSKY_SFC_SW_DWN["202108"] = -999;
      return nasa;
    };
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(422);
    expect(r.body.code).toBe("nasa_fill_value");
    expect(r.body.message).toContain("-999");
    // No figure of any kind, and no model call: nothing was paid for either.
    expect(r.body.optimalPv).toBeUndefined();
    expect(r.body.sizing).toBeUndefined();
    expect(r.body.resolution.irradianceSource).toBe("not-reached");
    expect(modelCalls).toBe(0);
    await close();
  });

  it("returns a typed 422 when NASA covers fewer months than requested", async () => {
    nasaTransform = (nasa) => {
      delete nasa.properties.parameter.ALLSKY_SFC_SW_DWN["202007"];
      return nasa;
    };
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(422);
    expect(r.body.code).toBe("nasa_partial_coverage");
    expect(r.body.optimalPv).toBeUndefined();
    await close();
  });

  it("returns 422 with a not-reached record when the location does not exist", async () => {
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody({ location: "Xqzzyvwmpq Nowhereville 99999" }));

    expect(r.status).toBe(422);
    expect(r.body.code).toBe("geocode_failed");
    expect(r.body.resolution.geocodeStatus).toBe("failed");
    expect(r.body.resolution.nasaHttpStatus).toBe("not-called");
    expect(modelCalls).toBe(0);
    await close();
  });
});

describe("O.4 — the load is the user's usage", () => {
  it("doubling the usage doubles the array", async () => {
    const { base, close } = await serve();
    const base5 = await optimize(base, optimizeBody({ annualUsageKwh: 5000 }));
    const base10 = await optimize(base, optimizeBody({ annualUsageKwh: 10000 }));

    expect(base10.body.optimalPv).toBeCloseTo(base5.body.optimalPv * 2, 0);
    expect(base5.body.sizing.annualUsageKwh).toBe(5000);
    await close();
  });

  it("rejects a request with no usage rather than assuming one", async () => {
    const { base, close } = await serve();
    const r = await optimize(base, {
      location: FUENGIROLA,
      energyPattern: CLIENT_PROFILE,
    });

    // A missing magnitude used to become the pattern's own sum, 102 kWh/day.
    expect(r.status).toBe(400);
    expect(modelCalls).toBe(0);
    await close();
  });

  it("rejects a profile that is not 24 hourly weights", async () => {
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody({ energyPattern: [1, 2, 3] }));

    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/one weight per hour/i);
    await close();
  });
});

describe("O.5/O.6 — the model explains and nothing else", () => {
  it("is shown the computed figures, not the bare location string", async () => {
    const { base, close } = await serve();
    await optimize(base, optimizeBody());

    expect(modelCalls).toBe(1);
    expect(lastUserMessage).toContain("3.391 kWp");
    expect(lastUserMessage).toContain("5.05 kWh/m2/day");
    expect(lastUserMessage).toContain("5000 kWh/year");
    expect(lastUserMessage).toContain("NASA POWER satellite measurement, 2019–2023");
    // The old prompt asked the model to "Recommend optimal PV size (Watts)".
    expect(lastUserMessage).not.toMatch(/recommend optimal pv size/i);
    await close();
  });

  it("ignores a size the model volunteers — P3", async () => {
    modelReply = () =>
      JSON.stringify({
        optimal_pv_watts: 25000,
        optimal_battery_kwh: 40,
        explanation: "A 3.391 kWp array suits this roof.",
      });
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(200);
    expect(r.body.optimalPv).toBe(3391);
    expect(r.body.optimalBattery).not.toBe(40);
    await close();
  });

  it("502s when the prose carries a figure the model was never given", async () => {
    modelReply = () =>
      JSON.stringify({
        explanation:
          "Fuengirola gets about 4.5 kWh/m2/day and the system pays back in 7.5 years.",
      });
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(502);
    expect(r.body.code).toBe("invalid_model_response");
    // Readable prose, never Zod internals or the rejected figures.
    expect(r.body.message).not.toMatch(/invalid_type|zod|4\.5/);
    expect(r.body.optimalPv).toBeUndefined();
    await close();
  });

  it("502s when the model returns something that is not JSON", async () => {
    modelReply = () => "I recommend 5 kW of solar.";
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(502);
    expect(r.body.code).toBe("invalid_model_response");
    await close();
  });

  it("passes prose that quotes the given figures back verbatim", async () => {
    modelReply = (user) => {
      expect(user).toContain("4.1 kWh");
      return JSON.stringify({
        explanation:
          "At 5.05 kWh/m2/day, 3.391 kWp covers your 5000 kWh/year and 4.1 kWh of storage carries the night.",
      });
    };
    const { base, close } = await serve();
    const r = await optimize(base, optimizeBody());

    expect(r.status).toBe(200);
    expect(r.body.explanation).toContain("3.391 kWp");
    await close();
  });
});

describe("the paid route stays rate limited", () => {
  it("registers a limiter of 10 requests per 15 minutes", () => {
    // The limiter itself is stubbed out above so this file can make more than
    // ten requests. Its configuration is asserted rather than assumed: this is
    // one of two routes that spends money per call.
    expect(rateLimitOptions.length).toBeGreaterThan(0);
    expect(rateLimitOptions).toContainEqual(
      expect.objectContaining({ windowMs: 15 * 60 * 1000, limit: 10 }),
    );
  });
});
