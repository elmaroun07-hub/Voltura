import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * H-D17: /api/calculate gets a limiter it never had (D17), and /api/optimize and
 * the screening export are re-keyed so their limiters count clients rather than
 * proxy addresses. Own file, so every limiter starts at zero.
 *
 * The limiters run before each handler, so the requests that use up an
 * allowance here are refused ones (no session header, or an empty body) - no
 * geocoder, NASA or model call is needed, and none is allowed: any outbound
 * request fails the test (G10).
 *
 * Every request names its client in CF-Connecting-IP. In a test all requests
 * come from 127.0.0.1, so a limiter that ignored the header would put every
 * client in one bucket - the "another client is not limited" lines catch that.
 */

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
  llmModel: () => "stub-model",
  getLlmClient: () => {
    throw new Error("no model call is expected in this file");
  },
}));
vi.mock("@workspace/screening/db", async () => {
  class ScreeningNotLoaded extends Error {
    constructor(readonly ineMunicipality: string) {
      super("not loaded");
    }
  }
  return {
    AGE_FILTERS: ["pre-1980", "1980-2006", "2007-on", "unknown"],
    ScreeningNotLoaded,
    listMunicipalities: async () => [],
    listBuildings: async () => ({ runId: "run-1", total: 0, rows: [] }),
    buildingTrace: async () => null,
    portfolioSummary: async () => ({ runId: "run-1", scored: 0, dwellings: 0, certified: 0, deciles: [], gap: { buildings: 0, dwellings: 0 }, districts: [] }),
    exportRows: async () => ({ runId: "run-1", rows: [] }),
  };
});

const realFetch = globalThis.fetch;
const { registerRoutes } = await import("./routes");
const outbound: string[] = [];

beforeEach(() => {
  outbound.length = 0;
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    outbound.push(url);
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
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

const post = (base: string, path: string, client: string, opts: { session?: boolean; lang?: string; body?: unknown } = {}) =>
  realFetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": client,
      ...(opts.session ? { "X-Session-Id": "d17d17d1-7777-4777-8777-d17d17d17d17" } : {}),
      ...(opts.lang ? { "Accept-Language": opts.lang } : {}),
    },
    body: JSON.stringify(opts.body ?? {}),
  });

describe("H-D17 — POST /api/calculate is rate-limited per client (D17)", () => {
  it("the 21st request in 15 minutes is refused, in the reader's language; another client is not affected", async () => {
    const { base, close } = await serve();
    try {
      for (let i = 0; i < 20; i++) {
        const refused = await post(base, "/api/calculate", "198.51.100.10");
        expect(refused.status).toBe(400); // no session header: refused by the handler, counted by the limiter
      }
      const es = await post(base, "/api/calculate", "198.51.100.10");
      expect(es.status).toBe(429);
      expect(await es.json()).toEqual({ message: "Demasiados cálculos. Inténtelo de nuevo más tarde." });
      const en = await post(base, "/api/calculate", "198.51.100.10", { lang: "en" });
      expect(en.status).toBe(429);
      expect(await en.json()).toEqual({ message: "Too many calculations. Please try again later." });

      expect((await post(base, "/api/calculate", "198.51.100.11")).status).toBe(400);
    } finally {
      await close();
    }
  });

  it("refuses a location longer than 200 characters before any outbound call; 200 goes through", async () => {
    const { base, close } = await serve();
    try {
      const body = { location: "x".repeat(201), energyUsage: 5000, pvWattage: 4000, batteryCapacity: 10 };
      const res = await post(base, "/api/calculate", "198.51.100.12", { session: true, lang: "en", body });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ message: "Please enter a valid location", field: "location" });
      expect(outbound).toEqual([]);
      // 200 characters passes validation and goes on to the geocoder. The stub
      // records the attempt and refuses it; the attempt is what this proves.
      const ok = await post(base, "/api/calculate", "198.51.100.12", { session: true, lang: "en", body: { ...body, location: "x".repeat(200) } });
      await ok.text();
      expect(outbound.length).toBeGreaterThan(0);
      expect(outbound[0]).toContain("nominatim.openstreetmap.org");
    } finally {
      await close();
    }
  });
});

describe("H-D17 — POST /api/optimize counts per client, not per proxy address", () => {
  it("one client's 11th request is refused while another client's first is not", async () => {
    const { base, close } = await serve();
    try {
      for (let i = 0; i < 10; i++) expect((await post(base, "/api/optimize", "198.51.100.20")).status).toBe(400);
      expect((await post(base, "/api/optimize", "198.51.100.20")).status).toBe(429);
      expect((await post(base, "/api/optimize", "198.51.100.21")).status).toBe(400);
    } finally {
      await close();
    }
  });

  it("refuses a location longer than 200 characters", async () => {
    const { base, close } = await serve();
    try {
      const body = { energyPattern: Array(24).fill(1), location: "x".repeat(201), annualUsageKwh: 5000 };
      const res = await post(base, "/api/optimize", "198.51.100.22", { lang: "en", body });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { field: string }).field).toBe("location");
    } finally {
      await close();
    }
  });
});

describe("H-D17 — the screening export counts per client, not per proxy address", () => {
  it("one client's 11th export in a minute is refused while another client's first is not", async () => {
    const { base, close } = await serve();
    const get = (client: string) => realFetch(`${base}/api/screening/14021/export.csv`, { headers: { "CF-Connecting-IP": client } });
    try {
      for (let i = 0; i < 10; i++) {
        const ok = await get("198.51.100.30");
        await ok.text();
        expect(ok.status).toBe(200);
      }
      expect((await get("198.51.100.30")).status).toBe(429);
      const other = await get("198.51.100.31");
      await other.text();
      expect(other.status).toBe(200);
    } finally {
      await close();
    }
  });
});
