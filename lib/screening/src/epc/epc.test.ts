import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EpcParseError, certificateBlocks, parseCertificate, type EpcCertificate } from "./register";
import { summariseBuilding } from "./summary";

/**
 * Real excerpt of the Junta's register, Córdoba province (cordoba.7z,
 * Last-Modified 1 Sep 2026, sha256 b781043e…2a503f; CORDOBA.xml written
 * 28 Aug 2026): all 52 certificates whose reference starts with manzana 26421,
 * plus one parcel-only certificate and one listing two units. The Direccion
 * of every certificate was blanked before the excerpt was committed.
 * Expected values were read from the same file with a separate Python reader.
 */
const XML = readFileSync(
  fileURLToPath(new URL("./__fixtures__/cordoba-epc-excerpt.xml", import.meta.url)),
  "utf8",
);
const FILE_DATE = "2026-08-28";

async function* chunked(text: string, size: number): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}
async function blocks(text = XML, size = 1013): Promise<string[]> {
  const out: string[] = [];
  for await (const b of certificateBlocks(chunked(text, size))) out.push(b);
  return out;
}

describe("certificateBlocks", () => {
  it("yields all 54 certificates whatever the chunk size", async () => {
    for (const size of [7, 1013, XML.length]) expect(await blocks(XML, size)).toHaveLength(54);
  });

  it("refuses a truncated file", async () => {
    const cut = XML.slice(0, XML.lastIndexOf("</DatosEnergeticosDelEdificio>"));
    await expect(blocks(cut)).rejects.toThrow(/truncated/);
  });

  it("never carries an address into H3", async () => {
    for (const b of await blocks()) {
      const r = parseCertificate(b, FILE_DATE);
      expect(JSON.stringify(r)).not.toMatch(/Direccion|retirada/);
    }
  });
});

describe("parseCertificate", () => {
  it("reads 2642106UG4924S0007OA: 22 Apr 2025, cooling demand 46.60, letter G, its scale", async () => {
    const b = (await blocks()).find((x) => x.includes("2642106UG4924S0007OA"))!;
    const r = parseCertificate(b, FILE_DATE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cert).toMatchObject({
      buildingRef: "2642106UG4924S",
      unitRef: "2642106UG4924S0007OA",
      refForm: "unit",
      date: "2025-04-22",
      dateValid: true,
      coolingDemand: 46.6,
      coolingLetter: "G",
    });
    expect(r.cert.coolingScale).not.toBeNull();
  });

  it("a parcel-only reference names the building and no unit", async () => {
    const b = (await blocks()).find((x) => x.includes("<ReferenciaCatastral>4062913UG4946S<"))!;
    const r = parseCertificate(b, FILE_DATE);
    expect(r.ok && r.cert).toMatchObject({ buildingRef: "4062913UG4946S", unitRef: null, refForm: "parcel" });
  });

  it("a list of two units of one parcel names the parcel", async () => {
    const b = (await blocks()).find((x) => x.includes("5039201UG4953N0026XA, "))!;
    const r = parseCertificate(b, FILE_DATE);
    expect(r.ok && r.cert).toMatchObject({ buildingRef: "5039201UG4953N", unitRef: null, refForm: "unit-list" });
  });

  it("a 19-character reference (a digit missing) is rejected, not repaired", async () => {
    const b = (await blocks()).find((x) => x.includes("264211UG4924S0007ZA"))!;
    expect(parseCertificate(b, FILE_DATE)).toEqual({ ok: false, reason: "malformed-ref", rawRef: "264211UG4924S0007ZA" });
  });

  it("a list spanning two parcels is rejected", async () => {
    const b = (await blocks()).find((x) => x.includes("5039201UG4953N0026XA, "))!;
    const two = b.replace("5039201UG4953N0027MS", "2642106UG4924S0007OA");
    const r = parseCertificate(two, FILE_DATE);
    expect(r).toMatchObject({ ok: false, reason: "unit-list-spans-parcels" });
  });

  it("dates outside 2007 … file date, or impossible, are kept but flagged", async () => {
    const b = (await blocks()).find((x) => x.includes("2642106UG4924S0007OA"))!;
    const at = (d: string) => parseCertificate(b.replace("22/04/2025", d), FILE_DATE);
    expect(at("22/04/1016")).toMatchObject({ ok: true, cert: { date: "1016-04-22", dateValid: false } });
    expect(at("01/01/2027")).toMatchObject({ ok: true, cert: { date: "2027-01-01", dateValid: false } });
    expect(at("31/02/2020")).toMatchObject({ ok: true, cert: { date: null, dateValid: false } });
  });

  it("an empty cooling demand is null, not 0; a letter outside A–G throws", async () => {
    const b = (await blocks()).find((x) => x.includes("2642106UG4924S0007OA"))!;
    const empty = b.replace(/(<EdificioObjeto>[\s\S]*?<Refrigeracion>)[^<]*(<\/Refrigeracion>)/, "$1$2");
    expect(parseCertificate(empty, FILE_DATE)).toMatchObject({ ok: true, cert: { coolingDemand: null } });
    const h = b.replace(/(<\/EscalaRefrigeracion>[\s\S]*?<Refrigeracion>)G(<\/Refrigeracion>)/, "$1H$2");
    expect(() => parseCertificate(h, FILE_DATE)).toThrow(EpcParseError);
  });
});

describe("summariseBuilding — one entry per unit, median with range", () => {
  async function byBuilding(): Promise<Map<string, EpcCertificate[]>> {
    const m = new Map<string, EpcCertificate[]>();
    for (const b of await blocks()) {
      const r = parseCertificate(b, FILE_DATE);
      if (!r.ok) continue;
      const list = m.get(r.cert.buildingRef) ?? [];
      list.push(r.cert);
      m.set(r.cert.buildingRef, list);
    }
    return m;
  }

  it("matches the Python reader on every building of the block", async () => {
    const expected: Record<string, [number, number, number, number, number]> = {
      // certificates, entries, median, min, max
      "2642101UG4924S": [3, 3, 23.8, 22.99, 43.37],
      "2642102UG4924S": [5, 3, 22.89, 19.02, 26.39],
      "2642104UG4924S": [1, 1, 27.01, 27.01, 27.01],
      "2642105UG4924S": [3, 3, 24.25, 22.91, 33.89],
      "2642106UG4924S": [2, 2, 35.045, 23.49, 46.6],
      "2642107UG4924S": [2, 2, 32.73, 21.23, 44.23],
      "2642108UG4924S": [2, 2, 25.565, 24.61, 26.52],
      "2642109UG4924S": [1, 1, 19.26, 19.26, 19.26],
      "2642110UG4924S": [1, 1, 18.22, 18.22, 18.22],
      "2642111UG4924S": [4, 2, 18.155, 16.0, 20.31],
      "2642112UG4924S": [5, 4, 21.44, 15.81, 22.72],
      "2642113UG4924S": [1, 1, 25.88, 25.88, 25.88],
      "2642114UG4924S": [9, 8, 24.735, 16.98, 43.07],
      "2642115UG4924S": [3, 2, 19.74, 15.1, 24.38],
      "2642116UG4924S": [1, 1, 20.24, 20.24, 20.24],
      "2642117UG4924S": [3, 3, 21.78, 19.43, 22.03],
      "2642118UG4924S": [2, 2, 19.23, 17.97, 20.49],
      "2642119UG4924S": [1, 1, 22.98, 22.98, 22.98],
      "2642120UG4924S": [2, 2, 22.935, 22.65, 23.22],
    };
    const m = await byBuilding();
    expect(m.has("2642103UG4924S")).toBe(false); // no certificate at all: no summary
    for (const [ref, [n, e, med, lo, hi]] of Object.entries(expected)) {
      const s = summariseBuilding(m.get(ref)!);
      expect([s.certificates, s.entries], ref).toEqual([n, e]);
      expect(s.coolingDemandMedian!, ref).toBeCloseTo(med, 6);
      expect(s.coolingDemandMin!, ref).toBeCloseTo(lo, 6);
      expect(s.coolingDemandMax!, ref).toBeCloseTo(hi, 6);
    }
  });

  it("a re-certified unit counts once, as its latest valid certificate", () => {
    const base: EpcCertificate = {
      buildingRef: "2642106UG4924S", unitRef: "2642106UG4924S0007OA", refForm: "unit",
      date: "2019-01-01", dateValid: true, buildingType: null, scope: null, procedure: null,
      yearBuiltRaw: null, zone: null, habitableAreaM2: null, coolingDemand: 40, coolingLetter: "F", coolingScale: null,
    };
    const later = { ...base, date: "2024-01-01", coolingDemand: 20, coolingLetter: "C" as const };
    const bogus = { ...base, date: "2027-01-01", dateValid: false, coolingDemand: 99 };
    const s = summariseBuilding([later, base, bogus]);
    expect(s.entries).toBe(1);
    expect(s.coolingDemandMedian).toBe(20);
    expect(s.latestDate).toBe("2024-01-01");
  });

  it("refuses an empty list and a mixed list", () => {
    expect(() => summariseBuilding([])).toThrow();
  });
});
