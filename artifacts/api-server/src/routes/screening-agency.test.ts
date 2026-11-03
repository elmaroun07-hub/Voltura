import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Agency access keys (operator ruling 3 Nov 2026): a valid key lifts the
 * single-house rule for the list, the building trace and the export; a bad key
 * is a typed 401, never the public view; every use is logged before data is
 * sent, and a failed log refuses the request. Reads and the key store are
 * stubbed (G10: no database, no network).
 */
const calls = vi.hoisted(() => ({ scopes: [] as string[], logged: [] as unknown[][], logFails: false }));

vi.mock("@workspace/screening/db", async () => {
  class ScreeningNotLoaded extends Error {}
  return {
    AGE_FILTERS: ["pre-1980", "1980-2006", "2007-on", "unknown"],
    ScreeningNotLoaded,
    listMunicipalities: async () => [],
    listBuildings: async (_db: unknown, _ine: string, _f: unknown, _p: unknown, scope: string) => {
      calls.scopes.push(scope);
      return { runId: "run-1", total: 0, rows: [] };
    },
    buildingTrace: async (_db: unknown, _ine: string, ref: string, scope: string) => {
      calls.scopes.push(scope);
      return scope === "agency" ? { runId: "run-1", row: { ref }, sources: [] } : { runId: "run-1", notPublished: true };
    },
    portfolioSummary: async () => ({ runId: "run-1", scored: 0, dwellings: 0, certified: 0, deciles: [], gap: { buildings: 0, dwellings: 0 }, districts: [] }),
    exportRows: async (_db: unknown, _ine: string, scope: string) => {
      calls.scopes.push(scope);
      return { runId: "run-1", rows: [] };
    },
  };
});

const { createScreeningRouter } = await import("./screening");
const { generateAgencyKey, hashAgencyKey, isAgencyKeyFormat, agencyKeyLabel } = await import("../lib/agency-keys");

const GOOD = generateAgencyKey();
const REVOKED = generateAgencyKey();

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(
    createScreeningRouter({} as never, {
      agencyKeys: {
        verify: async (key) => (key === GOOD ? { keyId: 7, agencyName: "Agencia de prueba" } : null),
        log: async (...args) => {
          if (calls.logFails) throw new Error("log down");
          calls.logged.push(args);
        },
      },
    }),
  );
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  calls.scopes.length = 0;
  calls.logged.length = 0;
  calls.logFails = false;
});

const get = (path: string, key?: string, lang = "en") =>
  fetch(base + path, { headers: { "Accept-Language": lang, ...(key ? { "X-Agency-Key": key } : {}) } });

describe("agency access keys", () => {
  it("makes keys of the documented form, hashes them, and labels them without revealing them", () => {
    expect(isAgencyKeyFormat(GOOD)).toBe(true);
    expect(GOOD).not.toBe(REVOKED);
    expect(hashAgencyKey(GOOD)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAgencyKey(GOOD)).toBe(hashAgencyKey(GOOD));
    expect(agencyKeyLabel(GOOD)).toHaveLength(10);
    expect(GOOD.startsWith(agencyKeyLabel(GOOD))).toBe(true);
    expect(isAgencyKeyFormat("vak_short")).toBe(false);
  });

  it("no key: the public scope, and the single-house trace stays a 404", async () => {
    await get("/api/screening/14021/buildings");
    const trace = await get("/api/screening/14021/buildings/2642199UG4924S");
    expect(trace.status).toBe(404);
    expect(calls.scopes).toEqual(["public", "public"]);
    expect(calls.logged).toEqual([]);
  });

  it("a valid key: the agency scope for list, trace and export, logged first, never cached", async () => {
    const list = await get("/api/screening/14021/buildings?limit=10", GOOD);
    const trace = await get("/api/screening/14021/buildings/2642199UG4924S", GOOD);
    const csv = await get("/api/screening/14021/export.csv", GOOD);
    expect([list.status, trace.status, csv.status]).toEqual([200, 200, 200]);
    expect(calls.scopes).toEqual(["agency", "agency", "agency"]);
    expect(list.headers.get("cache-control")).toBe("private, no-store");
    expect(list.headers.get("vary")).toContain("X-Agency-Key");
    expect(csv.headers.get("content-disposition")).toContain("cribado-14021-completo.csv");
    expect(calls.logged).toEqual([
      [7, "GET", "/api/screening/14021/buildings"],
      [7, "GET", "/api/screening/14021/buildings/2642199UG4924S"],
      [7, "GET", "/api/screening/14021/export.csv"],
    ]);
  });

  it("a wrong or revoked key is a typed 401 in the reader's language, never the public view", async () => {
    const en = await get("/api/screening/14021/buildings", REVOKED);
    expect(en.status).toBe(401);
    expect(await en.json()).toEqual({ code: "agency_key_invalid", message: "The agency access key is not valid or has been revoked." });
    const es = await get("/api/screening/14021/buildings", "nonsense", "es");
    expect(await es.json()).toEqual({ code: "agency_key_invalid", message: "La clave de acceso de agencia no es válida o ha sido revocada." });
    expect(calls.scopes).toEqual([]);
  });

  it("if the use cannot be logged, nothing is sent", async () => {
    calls.logFails = true;
    const res = await get("/api/screening/14021/buildings", GOOD);
    expect(res.status).toBe(500);
    expect(calls.scopes).toEqual([]);
  });

  it("names the key's agency, or says no key was sent", async () => {
    const ok = await get("/api/screening/agency", GOOD);
    expect(await ok.json()).toEqual({ agency: "Agencia de prueba" });
    const none = await get("/api/screening/agency");
    expect(none.status).toBe(401);
    expect(await none.json()).toMatchObject({ code: "agency_key_missing" });
  });
});
