/**
 * H3.1 + H3.2 against a real PostGIS. Run with `pnpm test:integration` and
 * H3_TEST_DATABASE_URL pointing at a throwaway database whose name ends in
 * "test" (the suite drops and recreates the h3_ tables there).
 *
 * Not part of `pnpm test`: it needs a PostGIS server. CI runs it in its own
 * job with a postgis service container. If the variable is missing the suite
 * FAILS — a skipped integration suite reads as green and proves nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createReadStream, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { CTE_ORIENTATIONS } from "../orientation";
import { computeFacades, ensureH3Schema, ingestMunicipality, upsertSource, type SourceRecord } from "./ingest";
import { computeClimate } from "./climate-db";
import { parseAsciiGrid } from "../dem/ascii-grid";

const url = process.env.H3_TEST_DATABASE_URL;
if (!url) {
  throw new Error("H3_TEST_DATABASE_URL is not set: the PostGIS integration suite cannot run.");
}
if (!/\/[^/?]*test(\?|$)/.test(url)) {
  throw new Error("H3_TEST_DATABASE_URL must name a database ending in 'test'; this suite drops tables.");
}

const fixture = (name: string) =>
  fileURLToPath(new URL(`../catastro/__fixtures__/${name}`, import.meta.url));

const stream = (name: string) =>
  createReadStream(fixture(name), { encoding: "latin1", highWaterMark: 4096 }) as AsyncIterable<string>;

const SOURCE: SourceRecord = {
  id: "test-catastro-bu-14900-manzana-26421",
  publisher: "Dirección General del Catastro",
  dataset: "INSPIRE Buildings (BU), municipal bulk download — test excerpt",
  url: "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/14/14900-CORDOBA/A.ES.SDGC.BU.14900.zip",
  lastModified: "2026-08-21T16:17:43Z",
  sha256: "7124770efc5ad2220203fbc012eb73c99585380264ae63e3d7ee2a99d0d8ca53",
  retrievedAt: "2026-10-14T00:27:00Z",
  licence: "Catastro open data licence — attribution to the Dirección General del Catastro",
};

type OracleBuilding = {
  perimeter: number;
  party: number;
  street: Record<string, number>;
  courtyard: Record<string, number>;
};
const ORACLE: Record<string, OracleBuilding> = JSON.parse(
  readFileSync(fixture("cordoba-26421.facades-oracle-0.2.json"), "utf8"),
);

const pool = new pg.Pool({ connectionString: url });

beforeAll(async () => {
  await pool.query("DROP TABLE IF EXISTS h3_building_climate, h3_facades_inferred, h3_buildings, h3_sources");
  await ensureH3Schema(pool);
});
afterAll(async () => {
  await pool.end();
});

const ingest = () =>
  ingestMunicipality(pool, {
    ineMunicipality: "14021",
    catastroMunicipality: "14900",
    source: SOURCE,
    buildingGml: stream("cordoba-26421.building.gml"),
    buildingPartGml: stream("cordoba-26421.buildingpart.gml"),
    batchSize: 7, // smaller than the block, so batching is exercised
  });

describe("H3.1 — ingest into PostGIS", () => {
  it("loads 20 buildings and 54 parts, every building with its parts", async () => {
    const stats = await ingest();
    expect(stats).toEqual({
      buildings: 20,
      parts: 54,
      buildingsWithoutParts: 0,
      partsWithoutBuilding: 0,
      staleRows: 0,
    });
  });

  it("running it again changes nothing", async () => {
    const stats = await ingest();
    expect(stats.buildings).toBe(20);
    const n = await pool.query("SELECT count(*)::int AS n FROM h3_buildings");
    expect(n.rows[0].n).toBe(20);
  });

  it("stores floors as the highest part, and keeps the source on every row", async () => {
    const r = await pool.query(
      `SELECT ref, floors_above_max, part_count, year_beginning, dwellings, source_id,
              ST_SRID(footprint) AS srid, ST_IsValid(footprint) AS valid
         FROM h3_buildings WHERE ref IN ('2642101UG4924S','2642106UG4924S') ORDER BY ref`,
    );
    expect(r.rows).toEqual([
      expect.objectContaining({ ref: "2642101UG4924S", floors_above_max: 6, part_count: 3, year_beginning: 1958, dwellings: 10, source_id: SOURCE.id, srid: 25830 }),
      expect.objectContaining({ ref: "2642106UG4924S", floors_above_max: 5, part_count: 2, year_beginning: 1959, dwellings: 8, source_id: SOURCE.id, srid: 25830 }),
    ]);
  });

  it("footprint area matches the GML polygon to the square centimetre", async () => {
    // Shoelace on the published exterior minus the courtyard, independent of PostGIS.
    const gml = readFileSync(fixture("cordoba-26421.building.gml"), "latin1");
    const block = gml.slice(gml.indexOf("2642106UG4924S") - 200);
    const lists = [...block.matchAll(/<gml:posList[^>]*>([^<]*)<\/gml:posList>/g)].slice(0, 2);
    // Coordinates shifted to the ring's first vertex: products of raw UTM
    // values (~4e6 × 3e5) lose ~1e-4 m² to rounding, the size of the tolerance.
    const area = (txt: string) => {
      const v = txt.trim().split(/\s+/).map(Number);
      const [x0, y0] = [v[0], v[1]];
      let a = 0;
      for (let i = 0; i + 3 < v.length; i += 2) {
        a += (v[i] - x0) * (v[i + 3] - y0) - (v[i + 2] - x0) * (v[i + 1] - y0);
      }
      return Math.abs(a) / 2;
    };
    const expected = area(lists[0][1]) - area(lists[1][1]);
    const r = await pool.query(`SELECT ST_Area(footprint) AS a FROM h3_buildings WHERE ref = '2642106UG4924S'`);
    expect(Number(r.rows[0].a)).toBeCloseTo(expected, 4);
  });
});

describe("H3.2 — façades inferred from the block's geometry", () => {
  it("computes a profile for every building", async () => {
    const stats = await computeFacades(pool, "14021", 0.2, 6);
    expect(stats.buildings).toBe(20);
    expect(stats.segments).toBeGreaterThan(20 * 4);
  });

  it("agrees with the shapely oracle to the centimetre, building by building, orientation by orientation", async () => {
    const r = await pool.query(
      `SELECT ref, perimeter_m, party_wall_m, exposed_m, method, tolerance_m FROM h3_facades_inferred ORDER BY ref`,
    );
    expect(r.rows).toHaveLength(20);
    for (const row of r.rows) {
      const o = ORACLE[row.ref];
      expect(o, row.ref).toBeDefined();
      expect(Number(row.perimeter_m)).toBeCloseTo(o.perimeter, 2);
      expect(Number(row.party_wall_m)).toBeCloseTo(o.party, 2);
      expect(row.exposed_m.basis).toBe("inferred-from-footprint");
      for (const k of CTE_ORIENTATIONS) {
        expect(row.exposed_m.street[k], `${row.ref} street ${k}`).toBeCloseTo(o.street[k], 2);
        expect(row.exposed_m.courtyard[k], `${row.ref} courtyard ${k}`).toBeCloseTo(o.courtyard[k], 2);
      }
      expect(row.method).toBe("postgis-party-wall-buffer-v1");
      expect(Number(row.tolerance_m)).toBe(0.2);
    }
  });

  it("2642106UG4924S, mid-terrace: about 59% of its walls are party walls and its street façade faces SE", async () => {
    const r = await pool.query(`SELECT * FROM h3_facades_inferred WHERE ref = '2642106UG4924S'`);
    const row = r.rows[0];
    expect(Number(row.party_wall_m) / Number(row.perimeter_m)).toBeCloseTo(0.59, 2);
    const street = row.exposed_m.street as Record<string, number>;
    const top = Object.entries(street).sort((a, b) => b[1] - a[1])[0];
    expect(top[0]).toBe("SE");
  });

  /** Recompute one building after altering how its footprint is written, then restore it. */
  async function profileAfter(ref: string, alteredFootprintSql: string) {
    const before = await pool.query(`SELECT footprint FROM h3_buildings WHERE ref = $1`, [ref]);
    try {
      await pool.query(`UPDATE h3_buildings SET footprint = ${alteredFootprintSql} WHERE ref = $1`, [ref]);
      await computeFacades(pool, "14021", 0.2);
      const r = await pool.query(`SELECT * FROM h3_facades_inferred WHERE ref = $1`, [ref]);
      return r.rows[0];
    } finally {
      await pool.query(`UPDATE h3_buildings SET footprint = $2 WHERE ref = $1`, [ref, before.rows[0].footprint]);
      await computeFacades(pool, "14021", 0.2);
    }
  }

  function expectOracle(row: { ref: string; perimeter_m: string; exposed_m: { street: Record<string, number>; courtyard: Record<string, number> } }) {
    const o = ORACLE[row.ref];
    expect(Number(row.perimeter_m)).toBeCloseTo(o.perimeter, 2);
    for (const k of CTE_ORIENTATIONS) {
      expect(row.exposed_m.street[k], `${row.ref} street ${k}`).toBeCloseTo(o.street[k], 2);
      expect(row.exposed_m.courtyard[k], `${row.ref} courtyard ${k}`).toBeCloseTo(o.courtyard[k], 2);
    }
  }

  it("a footprint written counter-clockwise gives the same façades (rings are re-oriented, not trusted)", async () => {
    const row = await profileAfter("2642106UG4924S", "ST_Reverse(footprint)");
    expectOracle(row);
  });

  it("a building published as two touching patches gives the same façades (the seam is not a façade)", async () => {
    // Cut 2642101UG4924S in two along a line through its centroid; same outline, two patches.
    const row = await profileAfter(
      "2642101UG4924S",
      `ST_Multi(ST_CollectionExtract(ST_Split(footprint,
         ST_MakeLine(ST_Translate(ST_Centroid(footprint), -100, -1), ST_Translate(ST_Centroid(footprint), 100, 1))), 3))`,
    );
    expectOracle(row);
  });

  it("H3.3/3.4 — zone and July exposure per building from a terrain grid", async () => {
    // Synthetic 2×2 grid of 100 m cells over manzana 26421: west column
    // (x 342450–342550) at 120 m, east column (x 342550–342650) at 160 m,
    // so the block straddles Córdoba's 150/151 m band edge (B4 | C4).
    const grid = parseAsciiGrid(
      ["ncols 2", "nrows 2", "xllcorner 342450", "yllcorner 4193900", "cellsize 100", "120 160", "120 160"].join("\n"),
    );
    await upsertSource(pool, { ...SOURCE, id: "test-dem", lastModified: null, sha256: "synthetic" });
    const stats = await computeClimate(pool, "14021", "Córdoba", grid, "test-dem");
    expect(stats.buildings).toBe(20);
    expect(Object.keys(stats.byZone).sort()).toEqual(["B4", "C4"]);

    const r = await pool.query(
      `SELECT c.*, ST_X(ST_PointOnSurface(b.footprint)) AS x, ST_Y(ST_PointOnSurface(b.footprint)) AS y
         FROM h3_building_climate c JOIN h3_buildings b USING (ref) ORDER BY ref`,
    );
    for (const row of r.rows) {
      const ne = Number(row.x) >= 342550;
      expect(Number(row.altitude_m), row.ref).toBe(ne ? 160 : 120);
      expect(row.zone, row.ref).toBe(ne ? "C4" : "B4");
      expect(row.summer).toBe(4);
      expect(row.altitude_basis).toBe("ign-mdt25-cell-at-point-on-surface");
    }

    // 2642106UG4924S against the oracle's façades × DA DB-HE/1 tabla 20, row B4, typed here.
    const B4: Record<string, number> = { N: 61.0, NE: 101.7, E: 135.64, SE: 125.09, S: 94.13, SO: 121.94, O: 131.14, NO: 98.48 };
    const o = ORACLE["2642106UG4924S"];
    const street = CTE_ORIENTATIONS.reduce((s, k) => s + o.street[k] * B4[k], 0);
    const court = CTE_ORIENTATIONS.reduce((s, k) => s + o.courtyard[k] * B4[k], 0);
    const row = r.rows.find((x) => x.ref === "2642106UG4924S");
    expect(row.zone).toBe("B4");
    expect(Number(row.july_street_kwh_per_m)).toBeCloseTo(street, 1);
    expect(Number(row.july_courtyard_kwh_per_m)).toBeCloseTo(court, 1);
    expect(Number(row.july_roof_kwh_m2)).toBe(235.31);
  });

  it("H3.3 refuses a building outside the terrain grid instead of guessing its altitude", async () => {
    const tiny = parseAsciiGrid(["ncols 1", "nrows 1", "xllcorner 0", "yllcorner 0", "cellsize 25", "100"].join("\n"));
    await expect(computeClimate(pool, "14021", "Córdoba", tiny, "test-dem")).rejects.toThrow(/outside the grid/);
  });

  it("refuses a tolerance outside (0, 5) m", async () => {
    await expect(computeFacades(pool, "14021", 0)).rejects.toThrow(/tolerance/);
    await expect(computeFacades(pool, "14021", 10)).rejects.toThrow(/tolerance/);
  });
});
