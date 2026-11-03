import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * H3.9 — the screening routes, with the database reads stubbed (G10: no DB,
 * no network). The reads themselves are tested against PostGIS in
 * lib/screening's integration suite; this file pins the HTTP contract:
 * validation, typed errors in the reader's language, CSV shape.
 */
const calls = vi.hoisted(() => ({ list: [] as unknown[][], loaded: true }));

vi.mock("@workspace/screening/db", async () => {
  class ScreeningNotLoaded extends Error {
    constructor(readonly ineMunicipality: string) {
      super("not loaded");
    }
  }
  const row = (rank: number, ref: string) => ({
    rank, ref, dwellings: 8, year: 1959, floors: 5, zone: "B4", cusec: "1402101001",
    index: { low: 0.9123, mid: 1.0123, high: 1.1345 }, certificateCoverage: 0.25, certificateCapped: false, censusSection: true,
  });
  const guard = (ine: string) => {
    if (!calls.loaded || ine !== "14021") throw new ScreeningNotLoaded(ine);
  };
  return {
    AGE_FILTERS: ["pre-1980", "1980-2006", "2007-on", "unknown"],
    ScreeningNotLoaded,
    listMunicipalities: async () => (calls.loaded ? [{ ine: "14021", name: "Córdoba" }] : []),
    listBuildings: async (...args: unknown[]) => {
      calls.list.push(args.slice(1));
      guard(args[1] as string);
      return { runId: "run-1", total: 2, rows: [row(1, "2642106UG4924S"), row(2, "2642103UG4924S")] };
    },
    buildingTrace: async (_db: unknown, ine: string, ref: string) => {
      guard(ine);
      if (ref === "2642199UG4924S") return { runId: "run-1", notPublished: true };
      return ref === "2642106UG4924S" ? { runId: "run-1", row: { ref }, sources: [] } : null;
    },
    portfolioSummary: async (_db: unknown, ine: string) => {
      guard(ine);
      return { runId: "run-1", scored: 2, dwellings: 16, certified: 1, deciles: [], gap: { buildings: 1, dwellings: 8 }, districts: ["01"] };
    },
    exportRows: async (_db: unknown, ine: string) => {
      guard(ine);
      return { runId: "run-1", rows: [row(1, "2642106UG4924S"), { ...row(2, "2642103UG4924S"), year: null, cusec: null, censusSection: false }] };
    },
  };
});

const { createScreeningRouter, csvField } = await import("./screening");

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(createScreeningRouter({} as never));
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  calls.list.length = 0;
  calls.loaded = true;
});

const get = (path: string, lang?: string) => fetch(base + path, { headers: lang ? { "Accept-Language": lang } : {} });

describe("H3.9 screening routes", () => {
  it("lists municipalities without a session header", async () => {
    const res = await get("/api/screening/municipalities");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ municipalities: [{ ine: "14021", name: "Córdoba" }] });
  });

  it("passes filters and paging through to the read", async () => {
    const res = await get("/api/screening/14021/buildings?age=pre-1980&certificate=without&district=01&limit=20&offset=40");
    expect(res.status).toBe(200);
    expect(calls.list[0]).toEqual(["14021", { age: "pre-1980", certificate: "without", district: "01" }, { limit: 20, offset: 40 }, "public"]);
  });

  it("defaults to the first 50", async () => {
    await get("/api/screening/14021/buildings");
    expect(calls.list[0]).toEqual(["14021", {}, { limit: 50, offset: 0 }, "public"]);
  });

  it.each([
    ["/api/screening/1402/buildings", "ine"],
    ["/api/screening/14021/buildings?age=old", "age"],
    ["/api/screening/14021/buildings?certificate=maybe", "certificate"],
    ["/api/screening/14021/buildings?district=1", "district"],
    ["/api/screening/14021/buildings?limit=501", "limit"],
    ["/api/screening/14021/buildings?limit=0", "limit"],
    ["/api/screening/14021/buildings?offset=-1", "offset"],
    ["/api/screening/14021/buildings/not-a-ref", "ref"],
  ])("refuses %s with a typed 400 naming %s", async (path, param) => {
    const res = await get(path);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "bad_param", param });
  });

  it("a municipality with nothing loaded is a 404 in Spanish by default, English on request — never an empty list", async () => {
    calls.loaded = false;
    const es = await get("/api/screening/14021/buildings");
    expect(es.status).toBe(404);
    expect(await es.json()).toEqual({ code: "screening_not_loaded", message: "No hay un cribado cargado para el municipio 14021." });
    const en = await get("/api/screening/14021/summary", "en");
    expect(await en.json()).toEqual({ code: "screening_not_loaded", message: "No screening is loaded for municipality 14021." });
  });

  it("a building outside the screening is a 404 of its own", async () => {
    const res = await get("/api/screening/14021/buildings/0000000XX0000X");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "building_not_found" });
    const ok = await get("/api/screening/14021/buildings/2642106UG4924S");
    expect(ok.status).toBe(200);
  });

  it("VPUB: a single-family house is a 404 of its own, with no score or inputs, in the reader's language", async () => {
    const es = await get("/api/screening/14021/buildings/2642199UG4924S");
    expect(es.status).toBe(404);
    expect(await es.json()).toEqual({
      code: "building_not_published",
      message: "El edificio 2642199UG4924S es una vivienda unifamiliar: se puntúa, pero no se publica una a una para proteger la privacidad de quien vive en ella.",
    });
    const en = await get("/api/screening/14021/buildings/2642199UG4924S", "en");
    expect(await en.json()).toEqual({
      code: "building_not_published",
      message: "Building 2642199UG4924S is a single-family house: it is scored, but not published one by one, to protect the privacy of the household.",
    });
  });

  it("exports CSV: BOM, Spanish headers by default, CRLF, empty cells for absent values, the run in a header", async () => {
    const res = await get("/api/screening/14021/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="cribado-14021.csv"');
    expect(res.headers.get("x-screening-run")).toBe("run-1");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(
      "Orden,Referencia catastral,Viviendas,Año de construcción,Plantas,Zona climática CTE,Sección censal," +
        "Índice de cribado (extremo bajo),Índice de cribado (valor central),Índice de cribado (extremo alto)," +
        "Viviendas con certificado (proporción),Certificado limitado al percentil 99,Datos censales",
    );
    expect(lines[1]).toBe("1,2642106UG4924S,8,1959,5,B4,1402101001,0.9123,1.0123,1.1345,0.2500,no,sí");
    expect(lines[2]).toBe("2,2642103UG4924S,8,,5,B4,,0.9123,1.0123,1.1345,0.2500,no,no");
    expect(lines[3]).toBe("");
  });

  it("CSV headers follow the reader's language", async () => {
    const text = await (await get("/api/screening/14021/export.csv", "en")).text();
    expect(text.replace(/^﻿/, "").split("\r\n")[0]).toMatch(/^Rank,Cadastral reference,/);
  });

  it("csvField quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("x\ny")).toBe('"x\ny"');
    expect(csvField(null)).toBe("");
    expect(csvField(3)).toBe("3");
  });

  it("never calls the index a grade, a rating or a compliance result (P7)", async () => {
    const text = await (await get("/api/screening/14021/export.csv", "en")).text();
    expect(text).not.toMatch(/grade|rating|compliance/i);
  });
});
