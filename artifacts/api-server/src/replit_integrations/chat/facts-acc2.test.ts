import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { VOLTURA_FACTS } from "./facts";
import { loadCountries } from "../../lib/emissions/countries";

/**
 * H-ASST-ACC2 TF5: the five rewritten sentences (E1, E2, E3, P1, P2), each
 * pinned to the code that decides it - behaviour through the routes, plus the
 * sentence that states it (A.1, contracts/evidence/h-asst-acc2/a1-facts.md).
 *
 * G10: Nominatim and NASA come from routes/calculate.fixtures.json, the model
 * is a stub, storage is a map, and any other outbound request throws.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("../../routes/calculate.fixtures.json", import.meta.url), "utf8"),
);
const source = (repoPath: string) =>
  readFileSync(new URL(`../../../../../${repoPath}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fact = (id: string) => VOLTURA_FACTS.find((f) => f.id === id)!.text;

const SESSION = "acc2acc2-2222-4222-8222-acc2acc2acc2";
const realFetch = globalThis.fetch;
const store = vi.hoisted(() => ({ rows: new Map<number, any>(), nextId: 7001, historyAsked: [] as string[] }));

vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => {
      const row = { ...calc, id: store.nextId++, createdAt: new Date("2026-10-05T00:00:00Z") };
      store.rows.set(row.id, row);
      return row;
    },
    getHistory: async (sessionId: string) => {
      store.historyAsked.push(sessionId);
      return [...store.rows.values()].filter((r) => r.sessionId === sessionId);
    },
    getCalculationById: async (id: number, sessionId: string) => {
      const row = store.rows.get(id);
      return row && row.sessionId === sessionId ? row : undefined;
    },
  },
  chatStorage: {},
}));
vi.mock("../../lib/llm", () => ({
  llmModel: () => "stub-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: JSON.stringify({ explanation: "Sized from the figures provided." }) } }] }),
      },
    },
  }),
}));

const { registerRoutes } = await import("../../routes/routes");

let nasaMode: "fixture" | "http-500" | "malformed" | "non-numeric" | "request-failed" | "fill" | "partial" = "fixture";

beforeEach(() => {
  nasaMode = "fixture";
  store.rows.clear();
  store.historyAsked = [];
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.includes("nominatim.openstreetmap.org")) {
      const q = new URL(url).searchParams.get("q") ?? "";
      return json(fixtures[q] ? fixtures[q].nominatim : []);
    }
    if (url.includes("power.larc.nasa.gov")) {
      if (nasaMode === "request-failed") throw new TypeError("fetch failed");
      if (nasaMode === "http-500") return json({}, 500);
      if (nasaMode === "malformed") return json({ properties: {} });
      const u = new URL(url);
      const hit = Object.values(fixtures).find(
        (f) => f.lat.toFixed(4) === u.searchParams.get("latitude") && f.lon.toFixed(4) === u.searchParams.get("longitude"),
      );
      if (!hit) return json({}, 404);
      const body = structuredClone(hit.nasa);
      const irr = body.properties.parameter.ALLSKY_SFC_SW_DWN;
      const first = Object.keys(irr)[0];
      if (nasaMode === "fill") irr[first] = -999;
      if (nasaMode === "partial") delete irr[first];
      if (nasaMode === "non-numeric") irr[first] = null;
      return json(body);
    }
    throw new Error(`unexpected outbound request in test: ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  await registerRoutes(createServer(app), app);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (base: string, path: string, body: unknown, session = SESSION) =>
  realFetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": session },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: (await r.json()) as any }));

const calcBody = (extra: Record<string, unknown> = {}) => ({
  location: "Fuengirola, Málaga, Spain", energyUsage: 5000, pvWattage: 4000, batteryCapacity: 10, ...extra,
});

/** The text a viewer extracts from the PDF: every BT..ET block, windows-1252 hex strings, in page order. */
function pdfLines(bytes: Buffer): string[] {
  const s = bytes.toString("latin1");
  const W = new TextDecoder("windows-1252");
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n?$/.exec(s)![1]);
  const first = startxref + /^xref\n0 (\d+)\n/.exec(s.slice(startxref))![0].length;
  const off = (n: number) => Number(s.slice(first + n * 20, first + n * 20 + 10));
  const dict = (n: number) => s.slice(off(n), s.indexOf("endobj", off(n)));
  const ref = (d: string, k: string) => Number(new RegExp(`/${k} (\\d+) 0 R`).exec(d)![1]);
  const stream = (n: number) => {
    const at = off(n), ds = s.indexOf("stream\n", at) + 7;
    return inflateSync(bytes.subarray(ds, ds + Number(/\/Length (\d+)/.exec(s.slice(at, ds))![1]))).toString("latin1");
  };
  const tree = dict(ref(dict(ref(s.slice(s.lastIndexOf("trailer")), "Root")), "Pages"));
  const kids = [.../\/Kids \[([^\]]*)\]/.exec(tree)![1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
  return kids.flatMap((k) =>
    [...stream(ref(dict(k), "Contents")).matchAll(/(?:^|\n)BT\n([\s\S]*?)\nET(?=\n|$)/g)].map((m) =>
      [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)].map(([, h]) => W.decode(Buffer.from(h.length % 2 ? `${h}0` : h, "hex"))).join(""),
    ),
  );
}

describe("H-ASST-ACC2 TF5 — the five rewritten facts, pinned to the code", () => {
  it.each(["http-500", "malformed", "non-numeric", "request-failed"] as const)(
    "E1 nasa: the latitude estimate runs when NASA cannot be used (%s), and is labelled",
    async (mode) => {
      expect(fact("nasa")).toContain(
        // H-ASST-ACC3: reworded as Case 1; the behaviour pinned below is unchanged.
        "Case 1 - NASA does not answer, answers with an error status, or sends an answer Voltura cannot read: Voltura estimates irradiance and temperature from the latitude, and labels the result as that estimate in the API response and on the page.",
      );
      nasaMode = mode;
      const r = await withServer((b) => post(b, "/api/calculate", calcBody()));
      expect(r.status).toBe(200);
      expect(r.body.irradianceSource).toBe("fallback-lat");
      expect(r.body.resolution.irradianceSource).toBe("fallback-lat");
    },
  );

  it.each([
    ["fill", "nasa_fill_value"],
    ["partial", "nasa_partial_coverage"],
  ] as const)("E1 nasa: NASA marking months as no data (%s) is no estimate and no result", async (mode, code) => {
    expect(fact("nasa")).toContain(
      "Case 2 - NASA answers, but one or more months have no value or are left out: there is no estimate and no result, and the calculation stops with an error.",
    );
    expect(fact("nasa")).toContain("Only Case 1 gives a latitude estimate; only Case 2 stops the calculation.");
    // Words the model read as either case (H-ASST-ACC2 E1, H-ASST-ACC3 N1).
    expect(fact("nasa")).not.toMatch(/missing|unavailable/i);
    nasaMode = mode;
    const r = await withServer((b) => post(b, "/api/calculate", calcBody()));
    expect(r.status).toBe(422);
    expect(r.body.code).toBe(code);
    expect(r.body.irradianceSource).toBeUndefined();
    expect(r.body.resolution.irradianceSource).toBe("not-reached");
    expect(store.rows.size).toBe(0);
  });

  it("E2 history: calculations are stored on the server; the browser keeps only the id", async () => {
    expect(fact("history")).toContain(
      "The calculations themselves are stored on Voltura's server, not in the browser; this browser keeps only a random id that links it to them.",
    );
    expect(fact("history")).toContain("gets a new id and so an empty history");
    await withServer(async (b) => {
      const made = await post(b, "/api/calculate", calcBody());
      expect(made.status).toBe(200);
      expect(store.rows.get(made.body.id)).toMatchObject({ sessionId: SESSION, savingsKwh: made.body.savingsKwh });
      const mine = await (await realFetch(`${b}/api/history`, { headers: { "X-Session-Id": SESSION } })).json();
      const fresh = await (await realFetch(`${b}/api/history`, { headers: { "X-Session-Id": "a0a0a0a0-0000-4000-8000-a0a0a0a0a0a0" } })).json();
      expect((mine as any[]).map((r) => r.id)).toEqual([made.body.id]);
      expect(fresh).toEqual([]);
    });
    // The web writes exactly one thing to localStorage: the session id.
    const qc = source("artifacts/green-energy-calculator/src/lib/queryClient.ts");
    expect([...qc.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1])).toEqual(["SESSION_ID_KEY"]);
    expect(qc).toContain("sessionId = crypto.randomUUID();");
  });

  it("E3 optimizer: it returns the PV size and battery capacity as numbers; the AI supplies only the explanation", async () => {
    const o = fact("optimizer");
    expect(o).toContain("The AI Optimizer returns a recommended PV size in watts and a battery capacity in kWh as numbers, computed by a formula");
    expect(o).toContain("The AI Optimizer's numbers come from that formula; a language model then writes the explanation text shown beside them, and cannot change the numbers.");
    const r = await withServer((b) =>
      post(b, "/api/optimize", { location: "Fuengirola, Málaga, Spain", annualUsageKwh: 5000, energyPattern: Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 22 ? 2 : 1)) }),
    );
    expect(r.status).toBe(200);
    expect(typeof r.body.optimalPv).toBe("number");
    expect(typeof r.body.optimalBattery).toBe("number");
    expect(r.body.optimalPv).toBeGreaterThan(0);
    expect(r.body.optimalPv).toBe(r.body.sizing.pvWatts);
    expect(r.body.optimalBattery).toBe(r.body.sizing.batteryKwh);
    expect(r.body.explanation).toBe("Sized from the figures provided.");
    const page = source("artifacts/green-energy-calculator/src/pages/Optimizer.tsx");
    // H2b: the units are catalog entries now, and the numbers are formatted
    // for the reader; they are still the response's numbers, not the model's.
    expect(page).toContain('t("unit.wValue", { n: num(result.optimalPv) })');
    expect(page).toContain('t("unit.kwhValue", { n: num(result.optimalBattery) })');
  });

  it("P1 pdf: the eight inputs it prints, no installation cost, no charts", async () => {
    expect(fact("pdf")).toContain(
      "the location and the inputs (annual usage, PV size, battery capacity and efficiency, tariff, panel orientation and roof angle), the result figures and the monthly table. The installation cost is not printed, and the PDF has no charts.",
    );
    const lines = await withServer(async (b) => {
      const made = await post(b, "/api/calculate", calcBody({ installationCost: 9287 }));
      expect(store.rows.get(made.body.id).installationCostEur).toBe(9287);
      // The fact is written in English, so the report is asked for in English (H2b).
      const res = await realFetch(`${b}/api/calculate/${made.body.id}/pdf`, { headers: { "X-Session-Id": SESSION, "Accept-Language": "en" } });
      expect(res.status).toBe(200);
      return pdfLines(Buffer.from(await res.arrayBuffer()));
    });
    for (const label of ["Location", "Annual Energy Usage", "PV System Size", "Battery Capacity", "Battery Efficiency", "Electricity Tariff", "Panel Orientation", "Roof Angle"]) {
      expect(lines, label).toContain(label);
    }
    expect(lines.filter((l) => /9,?287/.test(l))).toEqual([]);
    expect(lines.filter((l) => /install(ation)? cost/i.test(l) && !l.startsWith("Est. 25-Year Net"))).toEqual([]);
  });

  it("P2 tariff: the UK has no national tariff; a typed UK tariff prices the saving", async () => {
    const t = fact("tariff");
    expect(t).toContain("The UK has no national tariff in Voltura, so a UK saving is priced only when the user types a tariff.");
    expect(t).toContain("There, a tariff the user types is always used.");
    expect(loadCountries().find((c) => c.key === "united kingdom")!.tariff.status).toBe("pending");
    await withServer(async (b) => {
      const untyped = await post(b, "/api/calculate", calcBody({ location: "London, United Kingdom" }));
      const typed = await post(b, "/api/calculate", calcBody({ location: "London, United Kingdom", electricityTariff: 0.25 }));
      expect(untyped.body.money).toMatchObject({ annualSavings: null, tariff: { status: "pending", reason: "registry_tariff_pending" } });
      expect(typed.body.money.tariff).toMatchObject({ status: "used", source: "user", value: 0.25 });
      expect(typed.body.money.annualSavings).toBeGreaterThan(0);
      expect(typed.body.money.currency).toBe("GBP");
    });
  });
});
