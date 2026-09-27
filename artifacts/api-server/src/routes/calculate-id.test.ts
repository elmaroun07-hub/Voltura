import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { api } from "../shared-routes";

/**
 * H-D51 — the /api/calculate 200 carries the id of the row it inserted.
 *
 * The PDF button downloads whatever id the page holds. It used to take the
 * newest row of a separate history query, which on the calculator page could
 * still be the previous calculation (D51, D53). The id now comes from the
 * insert, and these tests pin that it is the insert's id for THIS call.
 *
 * Every other storage mock in this directory returns { id: 1, ...calc }, and a
 * test against that cannot tell "returns the inserted id" from "returns 1"
 * (F-e). This one hands out distinct, non-trivial ids and records each.
 *
 * Same fixture-driven harness as calculate.test.ts: every outbound call is
 * served from calculate.fixtures.json, and any other request throws (G10).
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("./calculate.fixtures.json", import.meta.url), "utf8"),
);

const FUENGIROLA = "Fuengirola, Málaga, Spain";
const ALMERIA = "Almería, Spain";

const realFetch = globalThis.fetch;

// vi.mock factories are hoisted above this module's body, so the state they
// share with the tests has to be hoisted with them.
const inserts = vi.hoisted(() => ({
  nextId: 7919,
  issued: [] as { id: number; location: string }[],
}));

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => {
      const row = { ...calc, id: inserts.nextId++ };
      inserts.issued.push({ id: row.id, location: row.location });
      return row;
    },
    getHistory: async () => [],
    getCalculationById: async () => undefined,
  },
  chatStorage: {},
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
  inserts.nextId = 7919;
  inserts.issued.length = 0;
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    // The test's own calls to the server under test must not be intercepted.
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
      return json(structuredClone(hit[1].nasa));
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
      "X-Session-Id": "c5c5c5c5-5555-4555-8555-c5c5c5c5c5c5",
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

describe("H-D51 — the calculate 200 names the row it inserted", () => {
  it("T1: each response carries the id storage returned for that call", async () => {
    const { base, close } = await serve();
    try {
      const first = await calculate(base, FUENGIROLA);
      const second = await calculate(base, ALMERIA);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      // Two inserts, in call order, with distinct ids - so a constant id, a
      // missing one, or the other call's id cannot pass below.
      expect(inserts.issued).toEqual([
        { id: 7919, location: FUENGIROLA },
        { id: 7920, location: ALMERIA },
      ]);
      expect(first.body.id).toBe(inserts.issued[0].id);
      expect(second.body.id).toBe(inserts.issued[1].id);
    } finally {
      await close();
    }
  });

  it("T2: the 200 body parses under the shared create-200 schema, id included", async () => {
    const { base, close } = await serve();
    try {
      const r = await calculate(base, FUENGIROLA);
      expect(r.status).toBe(200);

      // Zod strips keys a schema does not name, so a schema without `id` would
      // still parse - and drop it, which is D51's symptom on the web (F-b).
      // The parsed id is asserted, not only that the parse succeeds.
      const parsed = api.calculations.create.responses[200].parse(r.body);
      expect(parsed.id).toBe(inserts.issued[0].id);
    } finally {
      await close();
    }
  });
});
