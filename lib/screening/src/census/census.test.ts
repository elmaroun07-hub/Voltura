import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CensusError, parseC2021Indicators, peopleInputs } from "./indicators";
import { ShapefileError, readPolygonShapefile } from "./shapefile";

/**
 * Real excerpt of INE's C2021_Indicadores.csv (Last-Modified 30 Jun 2023,
 * sha256 f1749637…4391d8): header, Córdoba sections 1402101001 and
 * 1402101002, and Almería 0402601001, whose figures are withheld for
 * statistical secrecy (population 59, every other cell blank).
 */
const CSV = readFileSync(
  fileURLToPath(new URL("./__fixtures__/c2021-indicadores-excerpt.csv", import.meta.url)),
  "utf8",
);

describe("parseC2021Indicators", () => {
  it("reads Córdoba's sections with INE's own codes and values", () => {
    const rows = parseC2021Indicators(CSV, "14021");
    expect(rows.map((r) => r.cusec)).toEqual(["1402101001", "1402101002"]);
    const s = rows[0].values;
    expect(s.t1_1).toBe(986);
    expect(s.t4_3).toBe(0.216); // a fraction, not 21.6
    expect(s.t21_1).toBe(382);
    expect(s.t22_1).toBe(95);
  });

  it("reads a withheld cell as null, never as 0", () => {
    const [r] = parseC2021Indicators(CSV, "04026");
    expect(r.values.t1_1).toBe(59);
    expect(r.values.t4_3).toBeNull();
    expect(r.values.t22_5).toBeNull();
  });

  it("refuses a file whose columns are not the 41 it was built for", () => {
    expect(() => parseC2021Indicators(CSV.replace("t4_3", "t4_x"), "14021")).toThrow(CensusError);
  });

  it("refuses a non-numeric cell and a duplicated section", () => {
    expect(() => parseC2021Indicators(CSV.replace(",986,", ",n/a,"), "14021")).toThrow(/not a number/);
    const dup = CSV.trimEnd() + "\n" + CSV.split("\n")[1] + "\n";
    expect(() => parseC2021Indicators(dup, "14021")).toThrow(/twice/);
  });
});

/** Build a tiny Polygon shapefile in memory: the format, written by hand. */
function makeShapefile(
  records: { attrs: Record<string, string>; parts: [number, number][][] }[],
  fields: { name: string; length: number }[],
  opts: { shapeType?: number; deleteFirst?: boolean } = {},
) {
  const recBufs = records.map((r, i) => {
    const pts = r.parts.flat();
    const content = Buffer.alloc(44 + 4 * r.parts.length + 16 * pts.length);
    content.writeInt32LE(opts.shapeType ?? 5, 0);
    let k = 0;
    for (const [pi, part] of r.parts.entries()) {
      content.writeInt32LE(k, 44 + 4 * pi);
      k += part.length;
    }
    content.writeInt32LE(r.parts.length, 36);
    content.writeInt32LE(pts.length, 40);
    pts.forEach(([x, y], j) => {
      content.writeDoubleLE(x, 44 + 4 * r.parts.length + 16 * j);
      content.writeDoubleLE(y, 44 + 4 * r.parts.length + 16 * j + 8);
    });
    const head = Buffer.alloc(8);
    head.writeInt32BE(i + 1, 0);
    head.writeInt32BE(content.length / 2, 4);
    return Buffer.concat([head, content]);
  });
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  const total = 100 + recBufs.reduce((s, b) => s + b.length, 0);
  header.writeInt32BE(total / 2, 24);
  header.writeInt32LE(opts.shapeType ?? 5, 32);
  const shp = Buffer.concat([header, ...recBufs]);

  const recordLength = 1 + fields.reduce((s, f) => s + f.length, 0);
  const headerLength = 32 + 32 * fields.length + 1;
  const dbf = Buffer.alloc(headerLength + recordLength * records.length);
  dbf.writeUInt32LE(records.length, 4);
  dbf.writeUInt16LE(headerLength, 8);
  dbf.writeUInt16LE(recordLength, 10);
  fields.forEach((f, i) => {
    dbf.write(f.name, 32 + 32 * i, "latin1");
    dbf[32 + 32 * i + 11] = "C".charCodeAt(0);
    dbf[32 + 32 * i + 16] = f.length;
  });
  dbf[32 + 32 * fields.length] = 0x0d;
  records.forEach((r, i) => {
    let pos = headerLength + i * recordLength;
    dbf[pos] = opts.deleteFirst && i === 0 ? 0x2a : 0x20;
    pos++;
    for (const f of fields) {
      dbf.write((r.attrs[f.name] ?? "").padEnd(f.length, " "), pos, "utf8");
      pos += f.length;
    }
  });
  return { shp, dbf };
}

const square = (x: number, y: number, s: number): [number, number][] => [
  [x, y], [x, y + s], [x + s, y + s], [x + s, y], [x, y],
];
const FIELDS = [{ name: "CUSEC", length: 10 }, { name: "CUMUN", length: 5 }];
const RECORDS = [
  { attrs: { CUSEC: "1402101001", CUMUN: "14021" }, parts: [square(0, 0, 100), square(40, 40, 10)] },
  { attrs: { CUSEC: "0400101001", CUMUN: "04001" }, parts: [square(200, 0, 50)] },
  { attrs: { CUSEC: "1402101002", CUMUN: "14021" }, parts: [square(100, 0, 100)] },
];

describe("readPolygonShapefile", () => {
  it("reads the kept records' rings and attributes, in order", () => {
    const { shp, dbf } = makeShapefile(RECORDS, FIELDS);
    const out = readPolygonShapefile(shp, dbf, (a) => a.CUMUN === "14021");
    expect(out.map((r) => r.attributes.CUSEC)).toEqual(["1402101001", "1402101002"]);
    expect(out[0].rings).toHaveLength(2); // outer + hole, both returned as published
    expect(out[0].rings[1][0]).toEqual([40, 40]);
  });

  it("refuses a shape type other than Polygon", () => {
    const { shp, dbf } = makeShapefile(RECORDS, FIELDS, { shapeType: 3 });
    expect(() => readPolygonShapefile(shp, dbf, () => true)).toThrow(ShapefileError);
  });

  it("refuses a deleted DBF record rather than misaligning shapes and attributes", () => {
    const { shp, dbf } = makeShapefile(RECORDS, FIELDS, { deleteFirst: true });
    expect(() => readPolygonShapefile(shp, dbf, () => true)).toThrow(/deleted/);
  });

  it("refuses a ring that does not close", () => {
    const open = [{ attrs: RECORDS[0].attrs, parts: [square(0, 0, 10).slice(0, 4).concat([[1, 1]])] }];
    const { shp, dbf } = makeShapefile(open, FIELDS);
    expect(() => readPolygonShapefile(shp, dbf, () => true)).toThrow(/closed ring/);
  });

  it("refuses a truncated .shp", () => {
    const { shp, dbf } = makeShapefile(RECORDS, FIELDS);
    expect(() => readPolygonShapefile(shp.subarray(0, shp.length - 8), dbf, () => true)).toThrow(ShapefileError);
  });
});

describe("peopleInputs — the index's three census figures", () => {
  it("maps Córdoba 1402101001 to over-64 share, one-person households, households, unemployment", () => {
    const [s] = parseC2021Indicators(CSV, "14021");
    expect(peopleInputs(s.values)).toEqual({ over64: 0.216, onePersonHouseholds: 95, households: 382, unemployment: 0.2009 });
  });

  it("a withheld figure leaves the input absent, not zero", () => {
    const [withheld] = parseC2021Indicators(CSV, "04026");
    expect(peopleInputs(withheld.values)).toBeNull();
    const [s] = parseC2021Indicators(CSV, "14021");
    expect(peopleInputs({ ...s.values, t10_1: null })).toBeNull();
    expect(peopleInputs({ ...s.values, t21_1: 0 })).toBeNull();
    expect(peopleInputs(null)).toBeNull();
  });
});
