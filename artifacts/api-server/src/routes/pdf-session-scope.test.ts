import { describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Access-control lock for GET /api/calculate/:id/pdf — finding F2.
 *
 * The route used to read no session header and take a sequential integer, so
 * /api/calculate/1/pdf, /2/pdf, /3/pdf walked every calculation ever made and
 * rendered location, annual usage, PV size, battery capacity, tariff, panel
 * orientation and roof angle for each one. Not a replay of somebody's session —
 * no session id was needed at all.
 *
 * What these tests pin, in the order that matters:
 *   1. no header            -> 400, before any lookup happens
 *   2. someone else's row   -> 404
 *   3. a row that is absent -> 404, byte-identical to (2)
 *   4. the owner            -> 200 and an actual PDF
 *
 * (2) and (3) being byte-identical is the whole point. A 403 on (2) would
 * confirm the row exists and hand back the oracle the scoping just closed.
 *
 * No DB and no network: ../db and ../storage are mocked, and the fake storage
 * is the only place that knows who owns what.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const INTRUDER = "22222222-2222-4222-8222-222222222222";
const OWNED_ID = 42;
const ABSENT_ID = 999;

/** The single row the fake storage holds, owned by OWNER. */
const ROW = {
  id: OWNED_ID,
  sessionId: OWNER,
  location: "Fuengirola, Málaga, Spain",
  energyUsage: 5000,
  pvWattage: 4000,
  batteryCapacity: 10,
  batteryEfficiency: 0.9,
  electricityTariff: 0.25,
  panelOrientation: "south",
  roofAngle: 35,
  savingsKwh: 3702,
  co2Reduction: 903,
  annualSavingsEur: 925,
  installationCostEur: 9200,
  paybackYears: 8.4,
  lifetimeSavingsEur: 27750,
  monthlyData: [
    { name: "Jan", generationKwh: 210, consumptionKwh: 515, savingsKwh: 180, gridImportKwh: 335 },
  ],
  renewableMix: { solar: 0.62, wind: 0 },
  createdAt: new Date("2026-08-26T00:00:00Z"),
};

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => ({ id: 1, ...calc }),
    getHistory: async () => [],
    // Mirrors the real query: both predicates, so "not yours" and "absent"
    // collapse to the same undefined before the route ever sees them.
    getCalculationById: async (id: number, sessionId: string) =>
      id === ROW.id && sessionId === ROW.sessionId ? ROW : undefined,
  },
  chatStorage: {},
}));

const { registerRoutes } = await import("./routes");

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

function pdfUrl(base: string, id: number) {
  return `${base}/api/calculate/${id}/pdf`;
}

describe("F2 — GET /api/calculate/:id/pdf is session-scoped", () => {
  it("rejects a request with no X-Session-Id header", async () => {
    const { base, close } = await serve();
    try {
      const res = await fetch(pdfUrl(base, OWNED_ID), { headers: { "Accept-Language": "en" } });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ message: "X-Session-Id header is required" });
      // H2b: with no language asked for, the same refusal is in Spanish.
      const es = await fetch(pdfUrl(base, OWNED_ID));
      expect(es.status).toBe(400);
      expect(await es.json()).toEqual({ message: "Falta la cabecera X-Session-Id" });
    } finally {
      await close();
    }
  });

  it("does not serve a calculation belonging to another session", async () => {
    const { base, close } = await serve();
    try {
      const res = await fetch(pdfUrl(base, OWNED_ID), {
        headers: { "X-Session-Id": INTRUDER },
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).not.toContain("application/pdf");
    } finally {
      await close();
    }
  });

  it("answers 'not yours' and 'does not exist' identically — no oracle", async () => {
    const { base, close } = await serve();
    try {
      const notYours = await fetch(pdfUrl(base, OWNED_ID), {
        headers: { "X-Session-Id": INTRUDER },
      });
      const absent = await fetch(pdfUrl(base, ABSENT_ID), {
        headers: { "X-Session-Id": INTRUDER },
      });

      expect(notYours.status).toBe(absent.status);
      expect(await notYours.text()).toBe(await absent.text());
    } finally {
      await close();
    }
  });

  it("still serves the PDF to the session that owns the calculation", async () => {
    const { base, close } = await serve();
    try {
      const res = await fetch(pdfUrl(base, OWNED_ID), {
        headers: { "X-Session-Id": OWNER },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/pdf");

      // A real PDF, not an error page that happens to carry the header.
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.byteLength).toBeGreaterThan(1000);
    } finally {
      await close();
    }
  });

  it("cannot be walked by incrementing the id", async () => {
    const { base, close } = await serve();
    try {
      const statuses = await Promise.all(
        [1, 2, 3, OWNED_ID, 100].map(async (id) => {
          const res = await fetch(pdfUrl(base, id), {
            headers: { "X-Session-Id": INTRUDER },
          });
          return res.status;
        }),
      );
      // Every id looks the same to a session that owns none of them, including
      // the one that really exists.
      expect(statuses).toEqual([404, 404, 404, 404, 404]);
    } finally {
      await close();
    }
  });
});
