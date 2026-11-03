import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * VPUB-SEC (3 Nov 2026), before the repository goes public:
 * - every session guard accepts only a version 4 UUID (the web app makes one
 *   with crypto.randomUUID()); a short or made-up id is answered as a missing
 *   header, 400, before any lookup;
 * - GET /api/history and the PDF get a per-client limit (READS_PER_WINDOW).
 * Harness copied from h-d17-limits.test.ts; own file, so every limiter starts at zero.
 */

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ id: 1, ...calc }),
    getHistory: async () => [],
    // Throws like Postgres 22P02 would if a non-integer id reached the query.
    getCalculationById: async (id: number) => {
      if (!Number.isInteger(id)) throw new Error(`invalid input syntax for type integer: "${id}"`);
      return undefined;
    },
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

const UUID = "5e5e5e5e-5555-4555-8555-5e5e5e5e5e5e";
const get = (base: string, path: string, client: string, session?: string) =>
  realFetch(`${base}${path}`, {
    headers: { "CF-Connecting-IP": client, ...(session ? { "X-Session-Id": session } : {}) },
  });

describe("VPUB-SEC — only a version 4 UUID is a session id", () => {
  it("history, the PDF and the chat refuse a made-up id with 400, and history accepts a UUID", async () => {
    const { base, close } = await serve();
    try {
      for (const bad of ["1", "test", "browser-a", "00000000-0000-0000-0000-000000000000"]) {
        expect((await get(base, "/api/history", "198.51.100.40", bad)).status).toBe(400);
        expect((await get(base, "/api/calculate/1/pdf", "198.51.100.41", bad)).status).toBe(400);
        const chat = await realFetch(`${base}/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.42", "X-Session-Id": bad },
          body: JSON.stringify({ title: "t" }),
        });
        expect(chat.status).toBe(400);
      }
      expect((await get(base, "/api/history", "198.51.100.43", UUID)).status).toBe(200);
    } finally {
      await close();
    }
  });
});

describe("VPUB-SEC — GET /api/history is rate-limited per client", () => {
  it("the request after READS_PER_WINDOW is refused; another client is not affected", async () => {
    const { READS_PER_WINDOW } = await import("./routes");
    const { base, close } = await serve();
    try {
      for (let i = 0; i < READS_PER_WINDOW; i++) {
        expect((await get(base, "/api/history", "198.51.100.50", UUID)).status).toBe(200);
      }
      const over = await get(base, "/api/history", "198.51.100.50", UUID);
      expect(over.status).toBe(429);
      expect(((await over.json()) as any).message).toMatch(/Demasiadas solicitudes/);
      expect((await get(base, "/api/history", "198.51.100.51", UUID)).status).toBe(200);
    } finally {
      await close();
    }
  });
});

describe("Issue #9 (N4) — a value the database cannot hold is a 400/404, never a 500", () => {
  it("a half-kWh battery is refused with 400 before any work; an id that is not a number is a 404", async () => {
    const { base, close } = await serve();
    try {
      const res = await realFetch(`${base}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.60", "X-Session-Id": UUID, "Accept-Language": "en" },
        body: JSON.stringify({ location: "Fuengirola, Málaga, Spain", energyUsage: 5000, pvWattage: 4000, batteryCapacity: 4.5 }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).field).toBe("batteryCapacity");
      expect(outbound).toEqual([]);
      for (const bad of ["undefined", "1.5", "-1", "99999999999"]) {
        expect((await get(base, `/api/calculate/${bad}/pdf`, "198.51.100.61", UUID)).status).toBe(404);
      }
    } finally {
      await close();
    }
  });
});
