import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import ts from "typescript";
import { api } from "../shared-routes";

/**
 * H-PDF — the report a buyer forwards is one document, not twelve pages.
 *
 * Every assertion about the PDF is made on the bytes the route returns, through
 * the same harness as pdf-session-scope.test.ts. PDFKit compresses page
 * streams, so they are inflated here and the text operators decoded; the
 * production renderer keeps compression on.
 *
 *   N1 - a 12-month report ran to 12 pages: `y` was kept by hand and never
 *        compared with the page bottom (M1, M2).
 *   N2 - "CO₂" printed as "CO ‚": U+2082 is not WinAnsi (M3).
 *   D7 - "never paid back" was the number 25 (M4, M5; M6 is in countries.test.ts).
 *
 * G10: no network. Nominatim and NASA are served from calculate.fixtures.json,
 * any other outbound request throws, and storage is a map in this file.
 */

type Fixture = { lat: number; lon: number; nominatim: any[]; nasa: any };
const fixtures: Record<string, Fixture> = JSON.parse(
  readFileSync(new URL("./calculate.fixtures.json", import.meta.url), "utf8"),
);

const FUENGIROLA = "Fuengirola, Málaga, Spain";
const SESSION = "d7d7d7d7-7777-4777-8777-d7d7d7d7d7d7";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HEADER_ROW = ["Month", "Generated", "Consumed", "Saved", "Grid Import"];
const NEVER = "not within 25 years";

const realFetch = globalThis.fetch;

const store = vi.hoisted(() => ({ rows: new Map<number, any>(), nextId: 5101 }));

vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../storage", () => ({
  storage: {
    createCalculation: async (calc: any) => {
      const row = { ...calc, id: store.nextId++, createdAt: new Date("2026-09-28T00:00:00Z") };
      store.rows.set(row.id, row);
      return row;
    },
    getHistory: async () => [],
    // Scoped like the real query: "not yours" and "absent" are both undefined.
    getCalculationById: async (id: number, sessionId: string) => {
      const row = store.rows.get(id);
      return row && row.sessionId === sessionId ? row : undefined;
    },
  },
  chatStorage: {},
}));

const { registerRoutes } = await import("./routes");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  store.rows.clear();
  store.nextId = 5101;
  vi.stubGlobal("fetch", async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith("http://127.0.0.1")) return realFetch(input, init);
    if (url.includes("nominatim.openstreetmap.org")) {
      const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      return json(fixtures[q] ? fixtures[q].nominatim : []);
    }
    if (url.includes("power.larc.nasa.gov")) {
      const u = new URL(url);
      const hit = Object.values(fixtures).find(
        (f) =>
          f.lat.toFixed(4) === u.searchParams.get("latitude") &&
          f.lon.toFixed(4) === u.searchParams.get("longitude"),
      );
      return hit ? json(structuredClone(hit.nasa)) : json({}, 404);
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
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

async function calculate(base: string, body: Record<string, unknown>) {
  const res = await realFetch(`${base}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Session-Id": SESSION },
    body: JSON.stringify({ location: FUENGIROLA, energyUsage: 5000, pvWattage: 4000, batteryCapacity: 10, ...body }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

// ── Reading the real bytes ───────────────────────────────────────────────────

// The characters a PDFKit standard font draws as themselves. PDFKit writes each
// UTF-16 unit as hex: the 27 WinAnsi specials (€ – ‚ …) are mapped to their
// byte, anything else is written as its own code - so U+2082 goes out as the
// bytes 20 82 (" ‚", N2), and a code above U+00FF as three or four hex digits
// that shift every byte after it. Derived from the WHATWG windows-1252 decoder
// rather than typed out: 0x20-0x7E and 0x80-0xFF, minus the five bytes
// windows-1252 leaves undefined (they decode to C1 controls).
const WIN_1252 = new TextDecoder("windows-1252");
const WINANSI = new Set<number>();
for (let b = 0x20; b <= 0xff; b++) {
  if (b === 0x7f) continue;
  const cp = WIN_1252.decode(Uint8Array.of(b)).codePointAt(0)!;
  if (cp < 0x80 || cp > 0x9f) WINANSI.add(cp);
}
const notWinAnsi = (s: string) => [...s].filter((ch) => !WINANSI.has(ch.codePointAt(0)!));
const codePoint = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

interface PdfRead {
  /** /Count of the page tree. */
  count: number;
  /** Per page, in /Kids order: one string per BT…ET block, as a viewer's text layer holds it. */
  pages: string[][];
}

function readPdf(bytes: Buffer): PdfRead {
  const s = bytes.toString("latin1"); // one char per byte: string offsets are byte offsets
  expect(s.startsWith("%PDF-")).toBe(true);

  // Objects are found through the xref table PDFKit writes, not by searching
  // for "N 0 obj": compressed stream bytes could hold that text by chance.
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n?$/.exec(s)![1]);
  const xref = /^xref\n0 (\d+)\n/.exec(s.slice(startxref))!;
  const firstEntry = startxref + xref[0].length;
  const offsetOf = (n: number) => Number(s.slice(firstEntry + n * 20, firstEntry + n * 20 + 10));
  const dictOf = (n: number) => s.slice(offsetOf(n), s.indexOf("endobj", offsetOf(n)));
  const ref = (dict: string, key: string) => Number(new RegExp(`/${key} (\\d+) 0 R`).exec(dict)![1]);
  const streamOf = (n: number) => {
    const at = offsetOf(n);
    const dataStart = s.indexOf("stream\n", at) + "stream\n".length;
    const header = s.slice(at, dataStart);
    expect(header).toContain("/Filter /FlateDecode");
    const length = Number(/\/Length (\d+)/.exec(header)![1]);
    return inflateSync(bytes.subarray(dataStart, dataStart + length)).toString("latin1");
  };
  // A hex string with an odd digit count ends in an implied 0 (PDF 32000-1 §7.3.4.3).
  const decodeBlock = (block: string) =>
    [...block.matchAll(/<([0-9a-fA-F]*)>/g)]
      .map(([, hex]) => WIN_1252.decode(Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex")))
      .join("");

  const trailer = s.slice(s.lastIndexOf("trailer"));
  const pageTree = dictOf(ref(dictOf(ref(trailer, "Root")), "Pages"));
  const count = Number(/\/Count (\d+)/.exec(pageTree)![1]);
  const kids = [.../\/Kids \[([^\]]*)\]/.exec(pageTree)![1].matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
  const pages = kids.map((kid) =>
    [...streamOf(ref(dictOf(kid), "Contents")).matchAll(/(?:^|\n)BT\n([\s\S]*?)\nET(?=\n|$)/g)].map((m) =>
      decodeBlock(m[1]),
    ),
  );
  expect(pages).toHaveLength(count);
  return { count, pages };
}

async function getPdf(base: string, id: number): Promise<PdfRead> {
  const res = await realFetch(`${base}/api/calculate/${id}/pdf`, { headers: { "X-Session-Id": SESSION } });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/pdf");
  return readPdf(Buffer.from(await res.arrayBuffer()));
}

/** The value drawn right after a label (every label and its value are consecutive draws). */
function valueOf(pdf: PdfRead, label: string): string {
  const lines = pdf.pages.flat();
  expect(lines.filter((l) => l === label)).toHaveLength(1);
  return lines[lines.indexOf(label) + 1];
}

/** A persisted row as the calculate handler writes it; the money fields vary per case. */
function seed(overrides: Record<string, unknown>): number {
  const row = {
    id: store.nextId++,
    sessionId: SESSION,
    location: FUENGIROLA,
    energyUsage: 5000,
    pvWattage: 4000,
    batteryCapacity: 10,
    electricityTariff: 0.2669,
    batteryEfficiency: 0.9,
    panelOrientation: "south",
    roofAngle: 30,
    savingsKwh: 3860,
    co2Reduction: 333,
    annualSavingsEur: 1030.34,
    carbonFootprint: 0,
    installationCostEur: null,
    paybackYears: null,
    lifetimeSavingsEur: null,
    renewableMix: { solar: 62, wind: 0, currency: "EUR" },
    monthlyData: MONTHS.map((name, i) => ({
      month: i + 1,
      name,
      generationKwh: 312.4 + i,
      consumptionKwh: 416.7,
      savingsKwh: 280.1,
      gridImportKwh: 136.6,
      co2Kg: 24.2,
    })),
    createdAt: new Date("2026-09-28T00:00:00Z"),
    ...overrides,
  };
  store.rows.set(row.id, row);
  return row.id;
}

// ── N1 and N2, on the path L2 takes live ─────────────────────────────────────

describe("H-PDF — a 12-month report, from POST /api/calculate to the PDF bytes", () => {
  it("M1: renders on exactly 2 pages — the table breaks after October", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, {});
      expect(calc.status).toBe(200);
      expect(calc.body.monthlyData).toHaveLength(12);

      const pdf = await getPdf(base, calc.body.id);
      expect(pdf.count).toBe(2);
      const [first, second] = pdf.pages;
      expect(first).toEqual(expect.arrayContaining(["Summary", "Results", "Monthly Breakdown", ...MONTHS.slice(0, 10)]));
      expect(second).toEqual(expect.arrayContaining(["Nov", "Dec", "Generated by Green Energy Savings Calculator"]));
    } finally {
      await close();
    }
  });

  it("M2: each month appears exactly once, and every page with month rows carries the header row", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, {});
      const pdf = await getPdf(base, calc.body.id);

      for (const m of MONTHS) expect(pdf.pages.flat().filter((l) => l === m), m).toHaveLength(1);
      const withMonths = pdf.pages.filter((page) => page.some((l) => MONTHS.includes(l)));
      // The table really does continue, so the header check below is not vacuous.
      expect(withMonths.length).toBeGreaterThanOrEqual(2);
      for (const page of withMonths) expect(page).toEqual(expect.arrayContaining(HEADER_ROW));
    } finally {
      await close();
    }
  });

  it("N2: the text layer reads CO2, with no low comma (U+201A) anywhere", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, {});
      const lines = (await getPdf(base, calc.body.id)).pages.flat();
      expect(lines).toContain("CO2 Emissions Reduced");
      expect(lines.filter((l) => l.includes("‚"))).toEqual([]);
    } finally {
      await close();
    }
  });
});

// ── P.2 — every static string the renderer draws ─────────────────────────────

describe("H-PDF P.2 — static text is WinAnsi-encodable", () => {
  it("M3: every string literal in the PDF route handler draws as itself", () => {
    // Static text is every string and template literal inside the handler of
    // app.get("/api/calculate/:id/pdf", ...), wherever it sits and whichever
    // branch draws it. Dynamic text (the user's location, formatted numbers)
    // is not a literal and is not checked here.
    const file = new URL("./routes.ts", import.meta.url);
    const sf = ts.createSourceFile("routes.ts", readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    let handler: ts.Node | undefined;
    const find = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        n.arguments.length === 2 &&
        ts.isStringLiteral(n.arguments[0]) &&
        n.arguments[0].text === "/api/calculate/:id/pdf"
      ) {
        handler = n.arguments[1];
        return;
      }
      ts.forEachChild(n, find);
    };
    find(sf);
    expect(handler, "the PDF route handler is not in routes.ts").toBeDefined();

    const literals: { line: number; text: string }[] = [];
    const collect = (n: ts.Node): void => {
      if (
        ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isTemplateHead(n) ||
        ts.isTemplateMiddle(n) ||
        ts.isTemplateTail(n)
      ) {
        literals.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, text: n.text });
      }
      ts.forEachChild(n, collect);
    };
    collect(handler!);

    const offending = literals
      .filter((l) => notWinAnsi(l.text).length > 0)
      .map((l) => `routes.ts:${l.line} ${JSON.stringify(l.text)} — ${notWinAnsi(l.text).map(codePoint).join(" ")}`);
    expect(offending).toEqual([]);

    // Not vacuous: the scan reaches labels from every section, the table and the footer.
    expect(literals.map((l) => l.text)).toEqual(
      expect.arrayContaining(["Battery Efficiency", "Estimated Payback Period", "Grid Import", "Generated by Green Energy Savings Calculator"]),
    );
  });
});

// ── D7 — "not paid back within the horizon" is a state ───────────────────────

describe("H-PDF D7 — never paid back is not a number", () => {
  it("M4: an install cost the savings never cover is null end to end, and the PDF says so in words", async () => {
    const { base, close } = await serve();
    try {
      // 200,000 is the input schema's maximum: the L2 second probe.
      const calc = await calculate(base, { installationCost: 200000 });
      expect(calc.status).toBe(200);
      const roi = calc.body.money.roi;
      expect(roi.status).toBe("computed");
      expect(roi.paybackYears).toBeNull();
      expect(roi.lifetimeSavings).toBeGreaterThan(0);
      expect(roi.lifetimeSavings).toBeLessThan(200000);
      // The shared schema carries the state rather than stripping or rejecting it.
      expect(api.calculations.create.responses[200].parse(calc.body).money.roi).toMatchObject({ paybackYears: null });

      const row = store.rows.get(calc.body.id);
      expect(row.paybackYears).toBeNull();
      expect(row.lifetimeSavingsEur).toBe(roi.lifetimeSavings);

      const pdf = await getPdf(base, calc.body.id);
      expect(valueOf(pdf, "Estimated Payback Period")).toBe(NEVER);
      expect(pdf.pages.flat()).not.toContain("25.0 years");
    } finally {
      await close();
    }
  });

  it("M5: pending and never print different words — lifetimeSavingsEur tells them apart", async () => {
    const { base, close } = await serve();
    try {
      // Install cost pending (battery outside the registry cost): no ROI, both null.
      const pending = seed({ paybackYears: null, lifetimeSavingsEur: null });
      // ROI computed, curve never crossed: payback null, lifetime written.
      const never = seed({ installationCostEur: 200000, paybackYears: null, lifetimeSavingsEur: 30965 });
      const paid = seed({ installationCostEur: 9200, paybackYears: 8.4, lifetimeSavingsEur: 30965 });

      expect(valueOf(await getPdf(base, pending), "Estimated Payback Period")).toBe("pending");
      expect(valueOf(await getPdf(base, never), "Estimated Payback Period")).toBe(NEVER);
      expect(valueOf(await getPdf(base, paid), "Estimated Payback Period")).toBe("8.4 years");
    } finally {
      await close();
    }
  });
});

// ── H-D8D52 T7 — a row stored before the flows were recorded ─────────────────

// A row as the calculate handler stores it once the engine records its flows:
// each month's Generated = PV direct + PV into battery + surplus, and
// Consumed = PV direct + battery delivered + grid import.
const RECORDED_MONTHS = MONTHS.map((name, i) => {
  const surplusKwh = parseFloat((94.4 + i).toFixed(1));
  return {
    month: i + 1,
    name,
    generationKwh: parseFloat((250.1 + 55.5 + surplusKwh).toFixed(1)),
    consumptionKwh: 416.7,
    savingsKwh: 300.2,
    gridImportKwh: 116.5,
    co2Kg: 25.9,
    pvDirectKwh: 250.1,
    batteryChargeKwh: 55.5,
    batteryDischargeKwh: 50.1,
    surplusKwh,
  };
});

describe("H-D8D52 T7 — an old row says 'Not recorded', never 0", () => {
  it("a row without recorded flows prints no surplus column and says so; a recorded row prints the column on every table page", async () => {
    const { base, close } = await serve();
    try {
      // seed()'s months carry no flow fields: a row written before this block.
      const old = (await getPdf(base, seed({}))).pages.flat();
      expect(old).toContain("Surplus not used: Not recorded for this calculation");
      expect(old).not.toContain("Surplus not used");

      const recorded = await getPdf(base, seed({ monthlyData: RECORDED_MONTHS }));
      expect(recorded.count).toBe(2);
      expect(recorded.pages.flat().some((l) => l.includes("Not recorded"))).toBe(false);
      const withMonths = recorded.pages.filter((page) => page.some((l) => MONTHS.includes(l)));
      expect(withMonths.length).toBeGreaterThanOrEqual(2);
      for (const page of withMonths) expect(page).toEqual(expect.arrayContaining([...HEADER_ROW, "Surplus not used"]));
      // January's surplus cell is its stored value, drawn after its Grid Import cell.
      const lines = recorded.pages.flat();
      const jan = lines.indexOf("Jan");
      expect(lines.slice(jan, jan + 6)).toEqual(["Jan", "400 kWh", "416.7 kWh", "300.2 kWh", "116.5 kWh", "94.4 kWh"]);
    } finally {
      await close();
    }
  });
});

// ── L-local — user text outside WinAnsi: record only ─────────────────────────

describe("H-PDF L-local — a location outside WinAnsi (record only, not fixed here)", () => {
  it("still renders the whole report on 2 pages; what the location prints is logged for the ruling", async () => {
    const { base, close } = await serve();
    try {
      const location = "Łódź, Poland";
      const pdf = await getPdf(base, seed({ location }));
      expect(pdf.count).toBe(2);
      const printed = valueOf(pdf, "Location");
      const shown = [...printed]
        .map((ch) => (WINANSI.has(ch.codePointAt(0)!) ? ch : `\\x${ch.codePointAt(0)!.toString(16).padStart(2, "0")}`))
        .join("");
      console.log(`L-local: location ${JSON.stringify(location)} prints as ${JSON.stringify(shown)}`);
    } finally {
      await close();
    }
  });
});
