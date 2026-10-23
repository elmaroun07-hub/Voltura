import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * H-D17B: the screening routes' three guards - a per-client limit, a cap on how
 * many screening queries use the database at once (with a typed 503 when the
 * queue is full), and a short cache for the municipality list and summary.
 *
 * The screening database layer is stubbed. Every stubbed query can be held
 * open, so the test can see how many run at once, and counts its calls, so the
 * cache is checked by what reached the database. A router is built per test,
 * so every guard starts empty.
 */

const db = vi.hoisted(() => ({
  hold: false,
  waiters: [] as (() => void)[],
  inFlight: 0,
  maxInFlight: 0,
  calls: { municipalities: 0, buildings: 0, summary: 0 },
  summaryFails: false,
}));

vi.mock("@workspace/screening/db", async () => {
  class ScreeningNotLoaded extends Error {
    constructor(readonly ineMunicipality: string) {
      super("not loaded");
    }
  }
  const query = async <T>(value: () => T): Promise<T> => {
    db.inFlight++;
    db.maxInFlight = Math.max(db.maxInFlight, db.inFlight);
    try {
      if (db.hold) await new Promise<void>((r) => db.waiters.push(r));
      return value();
    } finally {
      db.inFlight--;
    }
  };
  return {
    AGE_FILTERS: ["pre-1980", "1980-2006", "2007-on", "unknown"],
    ScreeningNotLoaded,
    listMunicipalities: () => {
      db.calls.municipalities++;
      return query(() => [{ ine: "14021", name: "Córdoba" }]);
    },
    listBuildings: () => {
      db.calls.buildings++;
      return query(() => ({ runId: "run-1", total: 0, rows: [] }));
    },
    buildingTrace: () => query(() => null),
    portfolioSummary: (_pool: unknown, ine: string) => {
      db.calls.summary++;
      return query(() => {
        if (db.summaryFails) throw new ScreeningNotLoaded(ine);
        return { runId: "run-1", scored: 1, dwellings: 1, certified: 0, deciles: [], gap: { buildings: 0, dwellings: 0 }, districts: [] };
      });
    },
    exportRows: () => query(() => ({ runId: "run-1", rows: [] })),
  };
});

const { createScreeningRouter, SCREENING_PER_MINUTE, SCREENING_CONCURRENCY, SCREENING_MAX_QUEUE, SCREENING_CACHE_MS } =
  await import("./screening");

let server: Server;
let base: string;
let clock = 0;

async function serve() {
  const app = express();
  app.use(createScreeningRouter({} as never, { now: () => clock }));
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const get = (path: string, client: string, lang?: string) =>
  fetch(base + path, { headers: { "CF-Connecting-IP": client, ...(lang ? { "Accept-Language": lang } : {}) } });

/** Wait until n stubbed queries are being held open. */
async function untilHeld(n: number) {
  for (let i = 0; i < 200 && db.waiters.length < n; i++) await new Promise((r) => setTimeout(r, 5));
  expect(db.waiters.length).toBe(n);
}

/** Let held queries finish, including ones the gate starts after others end. */
async function releaseAll(pending: Promise<Response>[]) {
  db.hold = false;
  let done = false;
  const all = Promise.all(pending).then((r) => ((done = true), r));
  while (!done) {
    db.waiters.splice(0).forEach((r) => r());
    await new Promise((r) => setTimeout(r, 5));
  }
  return all;
}

beforeEach(async () => {
  Object.assign(db, { hold: false, waiters: [], inFlight: 0, maxInFlight: 0, summaryFails: false });
  db.calls = { municipalities: 0, buildings: 0, summary: 0 };
  clock = 1_000_000;
  await serve();
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe("H-D17B — every screening route is limited per client", () => {
  it(`request ${SCREENING_PER_MINUTE + 1} in a minute is refused, in the reader's language; another client is not affected`, async () => {
    for (let i = 0; i < SCREENING_PER_MINUTE; i++) expect((await get("/api/screening/municipalities", "203.0.113.50")).status).toBe(200);
    const es = await get("/api/screening/14021/buildings", "203.0.113.50");
    expect(es.status).toBe(429);
    expect(await es.json()).toEqual({ code: "rate_limited", message: "Demasiadas solicitudes de cribado. Inténtelo de nuevo en un minuto." });
    const en = await get("/api/screening/14021/summary", "203.0.113.50", "en");
    expect(await en.json()).toEqual({ code: "rate_limited", message: "Too many screening requests. Please try again in a minute." });
    expect((await get("/api/screening/municipalities", "203.0.113.51")).status).toBe(200);
  });
});

describe("H-D17B — screening queries share a small slice of the database", () => {
  it(`no more than ${SCREENING_CONCURRENCY} run at once, whoever sends them; the rest wait and then succeed`, async () => {
    db.hold = true;
    const pending = Array.from({ length: 6 }, (_, i) => get("/api/screening/14021/buildings", `198.51.100.${i + 1}`));
    await untilHeld(SCREENING_CONCURRENCY);
    await new Promise((r) => setTimeout(r, 30)); // nothing else may start meanwhile
    expect(db.inFlight).toBe(SCREENING_CONCURRENCY);
    const responses = await releaseAll(pending);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(db.maxInFlight).toBe(SCREENING_CONCURRENCY);
    expect(db.calls.buildings).toBe(6);
  });

  it(`with ${SCREENING_MAX_QUEUE} already waiting, the next is answered at once with a typed 503 and Retry-After`, async () => {
    db.hold = true;
    const accepted = Array.from({ length: SCREENING_CONCURRENCY + SCREENING_MAX_QUEUE }, (_, i) =>
      get("/api/screening/14021/buildings", `2001:db8:${(i + 1).toString(16)}::1`),
    );
    await untilHeld(SCREENING_CONCURRENCY);
    for (let i = 0; i < 200 && db.calls.buildings < SCREENING_CONCURRENCY; i++) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 30)); // let every accepted request reach the queue
    const busy = await get("/api/screening/14021/buildings", "203.0.113.60");
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("10");
    expect(await busy.json()).toEqual({
      code: "screening_busy",
      message: "El cribado está atendiendo muchas solicitudes. Inténtelo de nuevo en unos segundos.",
    });
    const busyEn = await get("/api/screening/14021/summary", "203.0.113.61", "en");
    expect(busyEn.status).toBe(503);
    expect(((await busyEn.json()) as { message: string }).message).toBe(
      "The screening is handling many requests. Please try again in a few seconds.",
    );
    const responses = await releaseAll(accepted);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(db.calls.buildings).toBe(SCREENING_CONCURRENCY + SCREENING_MAX_QUEUE);
  });
});

describe("H-D17B — the municipality list and summary are kept for a few minutes", () => {
  it("a second summary within the window does not reach the database; after it, one query runs again", async () => {
    expect((await get("/api/screening/14021/summary", "203.0.113.70")).status).toBe(200);
    expect((await get("/api/screening/14021/summary", "203.0.113.71")).status).toBe(200);
    expect(db.calls.summary).toBe(1);
    clock += SCREENING_CACHE_MS - 1;
    await get("/api/screening/14021/summary", "203.0.113.72");
    expect(db.calls.summary).toBe(1);
    clock += 1;
    await get("/api/screening/14021/summary", "203.0.113.73");
    expect(db.calls.summary).toBe(2);
  });

  it("the municipality list is kept too", async () => {
    await get("/api/screening/municipalities", "203.0.113.74");
    await get("/api/screening/municipalities", "203.0.113.75");
    expect(db.calls.municipalities).toBe(1);
  });

  it("summaries asked for while one is being computed share that one query", async () => {
    db.hold = true;
    const pending = [1, 2, 3].map((i) => get("/api/screening/14021/summary", `203.0.113.8${i}`));
    await untilHeld(1);
    const responses = await releaseAll(pending);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(db.calls.summary).toBe(1);
  });

  it("a failure is not kept: 'not loaded' is checked again on the next request", async () => {
    db.summaryFails = true;
    expect((await get("/api/screening/14021/summary", "203.0.113.90")).status).toBe(404);
    expect((await get("/api/screening/14021/summary", "203.0.113.91")).status).toBe(404);
    expect(db.calls.summary).toBe(2);
    db.summaryFails = false;
    expect((await get("/api/screening/14021/summary", "203.0.113.92")).status).toBe(200);
  });
});
