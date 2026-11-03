import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { serverCatalog } from "../i18n";
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
    // This suite pins the English report, so it asks for English (H2b: Spanish is the default).
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Session-Id": SESSION, "Accept-Language": "en" },
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
  /** The same blocks with where each was drawn: y counts up from the page bottom. */
  placed?: { text: string; x: number; y: number }[][];
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
  // An embedded TrueType font (#5) draws glyph ids, not characters; its
  // /ToUnicode CMap is what a viewer's text layer reads them through.
  const cmapOf = (fontObj: number): Map<number, string> | null => {
    const font = dictOf(fontObj);
    if (!/\/ToUnicode \d+ 0 R/.test(font)) return null;
    const cmap = streamOf(ref(font, "ToUnicode"));
    const map = new Map<number, string>();
    const u = (hex: string) => String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)));
    for (const sec of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const [, src, dst] of sec[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(src, 16), u(dst));
    for (const sec of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      // PDFKit writes the array form: <lo> <hi> [<dst> <dst> ...]; the single-destination form is read too.
      for (const [, lo, hi, list, single] of sec[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:\[([^\]]*)\]|<([0-9a-fA-F]+)>)/g)) {
        const dsts = list ? [...list.matchAll(/<([0-9a-fA-F]+)>/g)].map((d) => d[1]) : [];
        for (let c = parseInt(lo, 16); c <= parseInt(hi, 16); c++)
          map.set(c, u(list ? dsts[c - parseInt(lo, 16)]! : (parseInt(single!, 16) + c - parseInt(lo, 16)).toString(16).padStart(4, "0")));
      }
    return map;
  };
  const decodeEmbedded = (block: string, cmap: Map<number, string>) =>
    [...block.matchAll(/<([0-9a-fA-F]*)>/g)]
      .map(([, hex]) => (hex.match(/.{4}/g) ?? []).map((g) => cmap.get(parseInt(g, 16)) ?? "�").join(""))
      .join("");

  const placed = kids.map((kid) => {
    const page = dictOf(kid);
    const resources = dictOf(ref(page, "Resources"));
    const fonts = new Map<string, Map<number, string> | null>();
    for (const [, name, obj] of /\/Font <<([\s\S]*?)>>/.exec(resources)![1].matchAll(/\/(F\d+) (\d+) 0 R/g)) fonts.set(name, cmapOf(Number(obj)));
    return [...streamOf(ref(page, "Contents")).matchAll(/(?:^|\n)BT\n([\s\S]*?)\nET(?=\n|$)/g)].map((m) => {
      const at = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/.exec(m[1]);
      const cmap = fonts.get(/\/(F\d+) [\d.]+ Tf/.exec(m[1])?.[1] ?? "") ?? null;
      return { text: cmap ? decodeEmbedded(m[1], cmap) : decodeBlock(m[1]), x: Number(at?.[1]), y: Number(at?.[2]) };
    });
  });
  const pages = placed.map((page) => page.map((b) => b.text));
  expect(pages).toHaveLength(count);
  return { count, pages, placed };
}

async function getPdf(base: string, id: number): Promise<PdfRead> {
  const res = await realFetch(`${base}/api/calculate/${id}/pdf`, { headers: { "X-Session-Id": SESSION, "Accept-Language": "en" } });
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

    // H2b: the labels moved out of the handler into the server catalog, in two
    // languages. Every entry the PDF can draw (pdf.*, unit.*) is checked in
    // both, because Spanish adds letters (á é í ó ú ñ) the English never used.
    const drawn = Object.keys(serverCatalog.es).filter((k) => k.startsWith("pdf.") || k.startsWith("unit."));
    const catalogOffending = (["es", "en"] as const).flatMap((loc) =>
      drawn
        .map((k) => [k, (serverCatalog[loc] as Record<string, string>)[k]] as const)
        .filter(([, text]) => notWinAnsi(text).length > 0)
        .map(([k, text]) => `${loc}.${k} ${JSON.stringify(text)} — ${notWinAnsi(text).map(codePoint).join(" ")}`),
    );
    expect(catalogOffending).toEqual([]);

    // Not vacuous: the scan reaches labels from every section, the table and the footer.
    const english = drawn.map((k) => (serverCatalog.en as Record<string, string>)[k]);
    expect(english).toEqual(
      expect.arrayContaining(["Battery Efficiency", "Estimated Payback Period", "Grid Import", "Generated by Green Energy Savings Calculator"]),
    );
    const spanish = drawn.map((k) => (serverCatalog.es as Record<string, string>)[k]);
    expect(spanish).toEqual(expect.arrayContaining(["Rendimiento de la batería", "Ángulo del tejado", "Importación de red"]));
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

describe("#5 L-local — a location outside WinAnsi prints as typed", () => {
  it.each(["Łódź, Poland", "Brno, Česko", "İstanbul, Türkiye", "București, România", "Αθήνα, Ελλάδα"])(
    "%s round-trips through the PDF text layer, and the report still renders on 2 pages",
    async (location) => {
      const { base, close } = await serve();
      try {
        const pdf = await getPdf(base, seed({ location }));
        expect(pdf.count).toBe(2);
        expect(valueOf(pdf, "Location")).toBe(location);
      } finally {
        await close();
      }
    },
  );

  it("a WinAnsi name (Málaga) still prints as typed", async () => {
    const { base, close } = await serve();
    try {
      expect(valueOf(await getPdf(base, seed({})), "Location")).toBe(FUENGIROLA);
    } finally {
      await close();
    }
  });
});

// ── H-ASST-D16-N3 Part C — the PDF's net figure is actually net ──────────────

// N3: "Est. 25-Year Net Gain" printed lifetimeSavingsEur, the GROSS 25-year
// saving. Live row 102 (an install cost of 200,000) read "Net Gain €30,975"
// while its ROI curve ended at -€169,025.
const SAVINGS = "Est. 25-Year Savings";
const NET = "Est. 25-Year Net (after install cost)";

describe("H-ASST-D16-N3 N3 — gross and net are two rows, and net is net", () => {
  it("TC1: savings is always shown; net only when the install cost is known", async () => {
    const { base, close } = await serve();
    try {
      const known = (await getPdf(base, seed({ installationCostEur: 9200, paybackYears: 8.4, lifetimeSavingsEur: 30975 }))).pages.flat();
      expect(valueOf({ count: 0, pages: [known] }, SAVINGS)).toBe("€30,975");
      expect(valueOf({ count: 0, pages: [known] }, NET)).toBe("€21,775");

      const unknown = (await getPdf(base, seed({}))).pages.flat();
      expect(valueOf({ count: 0, pages: [unknown] }, SAVINGS)).toBe("pending");
      expect(unknown).not.toContain(NET);

      // C-a: no "Gain" anywhere, on a figure that can be negative.
      expect([...known, ...unknown].filter((l) => /gain/i.test(l))).toEqual([]);
    } finally {
      await close();
    }
  });

  it("TC2: net equals the ROI curve's year-25 value exactly, for the curve the web draws", async () => {
    const { base, close } = await serve();
    try {
      for (const installationCost of [200000, 9200, 31000, 1]) {
        const calc = await calculate(base, { installationCost });
        expect(calc.status).toBe(200);
        const year25 = calc.body.money.roi.curve[25];
        expect(year25.year).toBe(25);
        const pdf = await getPdf(base, calc.body.id);
        const printed = valueOf(pdf, NET);
        const expected = `${year25.netPosition < 0 ? "-" : ""}€${Math.abs(year25.netPosition).toLocaleString("en-GB")}`;
        expect(printed, `install cost ${installationCost}`).toBe(expected);
        // C-b: the cost behind the net is the cost the curve was built from.
        expect(year25.cumulativeSavings - year25.netPosition).toBe(installationCost);
      }
    } finally {
      await close();
    }
  });

  it("TC3: the 200,000 never case prints -€169,025 with an ASCII hyphen-minus, and no U+2212 reaches the bytes", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, { installationCost: 200000 });
      const pdf = await getPdf(base, calc.body.id);
      expect(valueOf(pdf, SAVINGS)).toBe("€30,975");
      const net = valueOf(pdf, NET);
      expect(net).toBe("-€169,025");
      expect(net.codePointAt(0)).toBe(0x2d);
      // A U+2212 drawn by a standard font goes out as the hex "2212" and decodes
      // to two stray bytes (N2's shape), so any non-WinAnsi char is the check.
      expect(pdf.pages.flat().flatMap(notWinAnsi).map(codePoint)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("TC4: an absent install cost prints no net row - never a net computed from 0", async () => {
    const { base, close } = await serve();
    try {
      // A lifetime figure with no stored cost: a net from 0 would print €30,975.
      const lines = (await getPdf(base, seed({ installationCostEur: null, lifetimeSavingsEur: 30975 }))).pages.flat();
      // Not vacuous: the report has its 25-year block, and the net is what is missing.
      expect(valueOf({ count: 0, pages: [lines] }, SAVINGS)).toBe("€30,975");
      expect(lines).not.toContain(NET);
      expect(lines.filter((l) => l === "€30,975")).toHaveLength(1); // the savings row only

      // Through the route: no cost entered, battery outside the registry cost.
      const calc = await calculate(base, {});
      expect(store.rows.get(calc.body.id).installationCostEur).toBeNull();
      expect((await getPdf(base, calc.body.id)).pages.flat()).not.toContain(NET);
    } finally {
      await close();
    }
  });

  it("TC5: money pin - stored savings, payback and lifetimeSavings are unchanged", async () => {
    // Values read from POST /api/calculate on these fixtures at 0f9f7a1, before Part C.
    const { base, close } = await serve();
    try {
      const pinned = [
        { installationCost: 200000, annualSavingsEur: 1030.34, installationCostEur: 200000, paybackYears: null, lifetimeSavingsEur: 30975 },
        { installationCost: 9200, annualSavingsEur: 1030.34, installationCostEur: 9200, paybackYears: 8.4, lifetimeSavingsEur: 30975 },
        { installationCost: undefined, annualSavingsEur: 1030.34, installationCostEur: null, paybackYears: null, lifetimeSavingsEur: null },
      ];
      for (const { installationCost, ...stored } of pinned) {
        const calc = await calculate(base, installationCost === undefined ? {} : { installationCost });
        const row = store.rows.get(calc.body.id);
        expect(row.savingsKwh).toBe(3860);
        expect({
          annualSavingsEur: row.annualSavingsEur,
          installationCostEur: row.installationCostEur,
          paybackYears: row.paybackYears,
          lifetimeSavingsEur: row.lifetimeSavingsEur,
        }).toEqual(stored);
      }
    } finally {
      await close();
    }
  });
});

// ── H2b 2b.4 — the report in Spanish ─────────────────────────────────────────

async function getPdfIn(base: string, id: number, acceptLanguage: string | null): Promise<PdfRead> {
  const headers: Record<string, string> = { "X-Session-Id": SESSION };
  if (acceptLanguage !== null) headers["Accept-Language"] = acceptLanguage;
  const res = await realFetch(`${base}/api/calculate/${id}/pdf`, { headers });
  expect(res.status).toBe(200);
  return readPdf(Buffer.from(await res.arrayBuffer()));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

describe("H2b 2b.4 — the PDF in Spanish, with Spanish numbers and dates", () => {
  it("is Spanish when the request names no language, and every label, month and unit is Spanish", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, { installationCost: 9287 });
      expect(calc.status).toBe(200);
      const pdf = await getPdfIn(base, calc.body.id, null);
      const lines = pdf.pages.flat();

      for (const label of [
        "Informe de ahorro con energía verde",
        "Resumen",
        "Ubicación",
        "Consumo energético anual",
        "Tamaño del sistema FV",
        "Capacidad de la batería",
        "Rendimiento de la batería",
        "Tarifa eléctrica",
        "Orientación del panel",
        "Ángulo del tejado",
        "Resultados",
        "Energía ahorrada al año",
        "Periodo de retorno estimado",
        "Desglose mensual",
        "Mes",
        "Generado por la calculadora de ahorro con energía verde",
      ]) {
        expect(lines, label).toContain(label);
      }
      // No English label survives.
      for (const english of ["Summary", "Results", "Monthly Breakdown", "Location", "Month", "pending"]) {
        expect(lines, english).not.toContain(english);
      }
      // G7: the stored enum is a word, in the reader's language.
      expect(lines[lines.indexOf("Orientación del panel") + 1]).toBe("Sur");
      // Months come from the month number: each Spanish month exactly once.
      for (const m of MESES) expect(lines.filter((l) => l === m), m).toHaveLength(1);
      // The date is written the Spanish way.
      expect(lines.find((l) => l.startsWith("Generado: "))).toMatch(/^Generado: \d{1,2} de [a-z]+ de \d{4}$/);
    } finally {
      await close();
    }
  });

  it("writes numbers and money the Spanish way: decimal comma, euro sign after the figure", async () => {
    const { base, close } = await serve();
    try {
      // A user tariff with three decimals and a wattage that groups in both languages.
      const calc = await calculate(base, { electricityTariff: 0.2669, pvWattage: 12500 });
      const es = (await getPdfIn(base, calc.body.id, "es")).pages.flat();
      const en = (await getPdfIn(base, calc.body.id, "en")).pages.flat();

      expect(es[es.indexOf("Tamaño del sistema FV") + 1]).toBe("12.500 W");
      expect(en[en.indexOf("PV System Size") + 1]).toBe("12,500 W");
      // es-ES: "0,267 €/kWh" (with a no-break space before €, which WinAnsi has).
      expect(es[es.indexOf("Tarifa eléctrica") + 1]).toBe("0,267 €/kWh");
      expect(en[en.indexOf("Electricity Tariff") + 1]).toBe("€0.267/kWh");
      expect(es[es.indexOf("Rendimiento de la batería") + 1]).toBe("90 %");
      expect(en[en.indexOf("Battery Efficiency") + 1]).toBe("90%");
    } finally {
      await close();
    }
  });

  it("is English when asked for English, and Spanish for an unsupported language", async () => {
    const { base, close } = await serve();
    try {
      const calc = await calculate(base, {});
      expect((await getPdfIn(base, calc.body.id, "en-GB,en;q=0.9")).pages.flat()).toContain("Summary");
      expect((await getPdfIn(base, calc.body.id, "fr-FR")).pages.flat()).toContain("Resumen");
    } finally {
      await close();
    }
  });
});

// ── #6 R2 — long user text must not run into the next row or page-break by itself ─

describe("#6 R2 — a long location", () => {
  const LONG =
    "Urbanización Los Álamos de la Sierra, Calle de la Fuente Vieja número doce, bloque tres, escalera izquierda, " +
    "piso segundo puerta cuarta, junto al antiguo mercado municipal, Fuengirola, Málaga, Andalucía, Spain, 29640 (entrada por el patio)";

  it("a 300-character location wraps inside its row: nothing is drawn over the next row", async () => {
    expect(LONG.length + 1 + LONG.length).toBeGreaterThan(300);
    const loc = (LONG + " " + LONG).slice(0, 300).trimEnd();
    const { base, close } = await serve();
    try {
      const id = seed({ location: loc });
      const pdf = await getPdf(base, id);
      const page = pdf.placed![0]!;
      const label = page.findIndex((b) => b.text === "Location");
      const next = page.findIndex((b) => b.text === "Annual Energy Usage");
      expect(label).toBeGreaterThan(-1);
      expect(next).toBeGreaterThan(label);
      // Everything drawn between the "Location" label and the next label is the location, wrapped.
      const lines = page.slice(label + 1, next);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.map((l) => l.text).join(" ").replace(/\s+/g, " ")).toBe(loc.replace(/\s+/g, " "));
      // The next row starts below the last wrapped line, with a full line of clearance.
      const lowest = Math.min(...lines.map((l) => l.y));
      const nextY = page[next]!.y;
      expect(nextY).toBeLessThan(lowest - 8);
      // The location stays in its own column: it does not run back over the label (x 58).
      for (const l of lines) expect(l.x).toBeGreaterThan(160);
    } finally {
      await close();
    }
  });

  it("a location far past the schema's cap is bounded: it adds no page of PDFKit's own and the report still ends in its footer", async () => {
    const huge = "Calle de la Fuente Vieja ".repeat(800); // ~20,000 characters, seeded past the 200-character cap
    const { base, close } = await serve();
    try {
      const baseline = await getPdf(base, seed({}));
      const pdf = await getPdf(base, seed({ location: huge }));
      expect(pdf.count).toBeLessThanOrEqual(baseline.count + 1);
      expect(pdf.pages.flat().filter((l) => l === "Generated by Green Energy Savings Calculator")).toHaveLength(1);
      for (const m of MONTHS) expect(pdf.pages.flat().filter((l) => l === m), m).toHaveLength(1);
    } finally {
      await close();
    }
  });
});
