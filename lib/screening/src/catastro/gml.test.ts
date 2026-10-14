import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CatastroParseError,
  featureBlocks,
  parseBuildingFeature,
  parseBuildingPartFeature,
} from "./gml";

/**
 * Fixture: manzana 26421 (sheet UG4924S) of Córdoba, cut verbatim from the
 * Catastro INSPIRE Buildings file A.ES.SDGC.BU.14900.zip (Last-Modified
 * 21 Aug 2026, sha256 7124770e…d8ca53). 20 buildings, 54 building parts.
 * Expected values below were read from the same file with a separate Python
 * reader, not from this module.
 */
const here = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
const BUILDING_GML = readFileSync(here("cordoba-26421.building.gml"), "latin1");
const PART_GML = readFileSync(here("cordoba-26421.buildingpart.gml"), "latin1");

/** Feed text in fixed-size chunks so tags straddle chunk boundaries. */
async function* chunked(text: string, size: number): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect(text: string, size = 997): Promise<string[]> {
  const out: string[] = [];
  for await (const b of featureBlocks(chunked(text, size))) out.push(b);
  return out;
}

describe("featureBlocks — streaming split", () => {
  it("yields every featureMember once, whatever the chunk size", async () => {
    for (const size of [1, 97, 4096, BUILDING_GML.length]) {
      const blocks = await collect(BUILDING_GML, size);
      expect(blocks).toHaveLength(20);
    }
    expect(await collect(PART_GML)).toHaveLength(54);
  });

  it("refuses a file that is not declared ISO-8859-1", async () => {
    const utf8 = BUILDING_GML.replace('encoding="ISO-8859-1"', 'encoding="UTF-8"');
    await expect(collect(utf8)).rejects.toThrow(CatastroParseError);
  });

  it("refuses a truncated file instead of dropping the last building", async () => {
    const cut = BUILDING_GML.slice(0, BUILDING_GML.lastIndexOf("</gml:featureMember>"));
    await expect(collect(cut)).rejects.toThrow(/truncated/);
  });
});

describe("parseBuildingFeature — values as published", () => {
  it("reads the 20 buildings of manzana 26421", async () => {
    const buildings = (await collect(BUILDING_GML)).map(parseBuildingFeature);
    expect(buildings.map((b) => b.ref)).toEqual(
      Array.from({ length: 20 }, (_, i) => `26421${String(i + 1).padStart(2, "0")}UG4924S`),
    );
    expect(new Set(buildings.map((b) => b.epsg))).toEqual(new Set([25830]));
  });

  it("2642106UG4924S: 1959, 8 dwellings, 730 m², one courtyard", async () => {
    const b = (await collect(BUILDING_GML))
      .map(parseBuildingFeature)
      .find((x) => x.ref === "2642106UG4924S")!;
    expect(b.condition).toBe("functional");
    expect(b.yearBeginning).toBe(1959);
    expect(b.yearEnd).toBe(1959);
    expect(b.currentUse).toBe("1_residential");
    expect(b.buildingUnits).toBe(8);
    expect(b.dwellings).toBe(8);
    expect(b.grossFloorAreaM2).toBe(730);
    expect(b.polygons).toHaveLength(1);
    expect(b.polygons[0]).toHaveLength(2); // exterior + one interior
    expect(b.polygons[0][0]).toHaveLength(7);
    expect(b.polygons[0][1]).toHaveLength(7);
  });

  it("2642102UG4924S: units and dwellings differ (10 vs 9) and both are kept", async () => {
    const b = (await collect(BUILDING_GML))
      .map(parseBuildingFeature)
      .find((x) => x.ref === "2642102UG4924S")!;
    expect(b.buildingUnits).toBe(10);
    expect(b.dwellings).toBe(9);
    expect(b.polygons[0]).toHaveLength(1);
    expect(b.polygons[0][0]).toHaveLength(18);
  });

  it("first coordinate of 2642106UG4924S is read exactly", async () => {
    const block = (await collect(BUILDING_GML)).find((x) => x.includes("2642106UG4924S"))!;
    const first = /<gml:posList[^>]*>\s*(\S+)\s+(\S+)/.exec(block)!;
    const b = parseBuildingFeature(block);
    expect(b.polygons[0][0][0]).toEqual([Number(first[1]), Number(first[2])]);
  });
});

describe("parseBuildingFeature — refuses rather than guesses", () => {
  const one = BUILDING_GML.slice(
    BUILDING_GML.indexOf("<gml:featureMember>"),
    BUILDING_GML.indexOf("</gml:featureMember>") + "</gml:featureMember>".length,
  );

  it("nil construction dates come back as null, not 0", () => {
    const nil = one.replace(
      /<bu-core2d:beginning>[^<]*<\/bu-core2d:beginning>/,
      '<bu-core2d:beginning xsi:nil="true" nilReason="other:unpopulated"></bu-core2d:beginning>',
    );
    expect(parseBuildingFeature(nil).yearBeginning).toBeNull();
  });

  it("a date with the year omitted (--01-01) is a published unknown: null", () => {
    const unknown = one
      .replace(/<bu-core2d:beginning>[^<]*</, "<bu-core2d:beginning>--01-01T00:00:00<")
      .replace(/<bu-core2d:end>[^<]*</, "<bu-core2d:end>--01-01T00:00:00<");
    const b = parseBuildingFeature(unknown);
    expect(b.yearBeginning).toBeNull();
    expect(b.yearEnd).toBeNull();
  });

  it("a three-digit year (a 10th-century monument) is read as written", () => {
    const old = one.replace(/<bu-core2d:beginning>[^<]*</, "<bu-core2d:beginning>950-01-01T00:00:00<");
    expect(parseBuildingFeature(old).yearBeginning).toBe(950);
  });

  it("a date in any other shape throws", () => {
    const bad = one.replace(/<bu-core2d:beginning>[^<]*</, "<bu-core2d:beginning>1959<");
    expect(() => parseBuildingFeature(bad)).toThrow(/not an ISO date/);
  });

  it("a posList whose count does not match its numbers throws", () => {
    const bad = one.replace(/count="(\d+)"/, (_, n) => `count="${Number(n) + 1}"`);
    expect(() => parseBuildingFeature(bad)).toThrow(/count=/);
  });

  it("a ring that does not close throws", () => {
    const bad = one.replace(/(<gml:posList[^>]*>[^<]*?)(\d)(<\/gml:posList>)/, (_, a, d, c) =>
      `${a}${(Number(d) + 1) % 10}${c}`,
    );
    expect(() => parseBuildingFeature(bad)).toThrow(/does not close/);
  });

  it("a coordinate system other than ETRS89/UTM throws", () => {
    const bad = one.replace(/EPSG::25830/g, "EPSG::4326");
    expect(() => parseBuildingFeature(bad)).toThrow(/unsupported srsName/);
  });

  it("a non-numeric dwelling count throws", () => {
    const bad = one.replace(
      /<bu-ext2d:numberOfDwellings>\d+</,
      "<bu-ext2d:numberOfDwellings>ocho<",
    );
    expect(() => parseBuildingFeature(bad)).toThrow(/not an integer/);
  });

  it("an area published under another reference is not read as floor area", () => {
    const other = one.replace("grossFloorArea", "plotArea");
    expect(parseBuildingFeature(other).grossFloorAreaM2).toBeNull();
  });
});

describe("parseBuildingPartFeature — floors live on the parts", () => {
  it("reads floors per part and ties each part to its building", async () => {
    const parts = (await collect(PART_GML)).map(parseBuildingPartFeature);
    const floorsOf = (ref: string) =>
      parts.filter((p) => p.ref === ref).map((p) => p.floorsAboveGround);
    expect(floorsOf("2642106UG4924S")).toEqual([5, 4]);
    expect(floorsOf("2642105UG4924S")).toEqual([4, 5, 2, 5]);
    expect(floorsOf("2642101UG4924S")).toEqual([5, 6, 5]);
    expect(new Set(parts.map((p) => p.ref)).size).toBe(20);
  });

  it("a part id that is not <ref>_part<n> throws", async () => {
    const block = (await collect(PART_GML))[0];
    const bad = block.replace(/(<base:localId>[0-9A-Z]{14})_part1/, "$1-p1");
    expect(() => parseBuildingPartFeature(bad)).toThrow(/_part/);
  });
});
