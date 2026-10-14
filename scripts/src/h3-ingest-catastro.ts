/**
 * H3.1/H3.2 — load one municipality's Catastro buildings into PostGIS and
 * derive their façades.
 *
 *   DATABASE_URL=… pnpm --filter @workspace/scripts h3:ingest -- \
 *     --manifest data/sources/h3/catastro-bu-14900.json \
 *     --dir /path/to/unzipped/A.ES.SDGC.BU.14900 \
 *     [--tolerance 0.2] \
 *     [--dem-manifest data/sources/h3/ign-mdt25-cordoba.json --dem /path/to/wcs-response.asc] \
 *     [--census-manifest data/sources/h3/ine-censo2021.json --secc-dir /path/to/Seccionado_2021 --c2021 /path/to/C2021_Indicadores.csv] \
 *     [--epc-manifest data/sources/h3/junta-epc-cordoba.json --epc /path/to/CORDOBA.xml] \
 *     [--index]   (3.7/3.8: score every residential building; needs all steps above)
 *
 * Refuses to load a file whose sha256 differs from the manifest: every row
 * must trace to the exact file the manifest dates and hashes.
 */
import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  assignBuildingsToSections,
  computeClimate,
  computeFacades,
  ensureH3Schema,
  ingestMunicipality,
  loadCensusSections,
  loadEpcRegister,
  computeIndex,
  upsertSource,
} from "@workspace/screening/db";
import { extractAsciiGridPart, parseAsciiGrid, parseC2021Indicators, readPolygonShapefile } from "@workspace/screening";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function required(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`--${name} is required`);
  return v;
}

async function sha256(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const manifest = JSON.parse(readFileSync(required("manifest"), "utf8"));
  const dir = required("dir");
  const toleranceArg = arg("tolerance");
  const tolerance = toleranceArg === undefined ? 0.2 : Number(toleranceArg);

  const paths = {
    building: join(dir, manifest.files.building.name),
    buildingPart: join(dir, manifest.files.buildingPart.name),
  };
  for (const [k, p] of Object.entries(paths)) {
    const got = await sha256(p);
    const want = manifest.files[k].sha256;
    if (got !== want) throw new Error(`${p}: sha256 ${got} ≠ manifest ${want}. Refusing to load.`);
    console.log(`ok  ${k} sha256 ${got}`);
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    await ensureH3Schema(pool);
    const t0 = Date.now();
    const stats = await ingestMunicipality(pool, {
      ineMunicipality: manifest.municipality.ine,
      catastroMunicipality: manifest.municipality.catastro,
      source: manifest.source,
      buildingGml: createReadStream(paths.building, { encoding: "latin1" }) as AsyncIterable<string>,
      buildingPartGml: createReadStream(paths.buildingPart, { encoding: "latin1" }) as AsyncIterable<string>,
    });
    console.log(`ingest ${JSON.stringify(stats)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const t1 = Date.now();
    const f = await computeFacades(pool, manifest.municipality.ine, tolerance);
    console.log(`facades ${JSON.stringify(f)} tolerance ${tolerance} m in ${((Date.now() - t1) / 1000).toFixed(1)} s`);

    const demManifestPath = arg("dem-manifest");
    if (demManifestPath) {
      const demManifest = JSON.parse(readFileSync(demManifestPath, "utf8"));
      const demPath = required("dem");
      const got = await sha256(demPath);
      if (got !== demManifest.source.sha256) {
        throw new Error(`${demPath}: sha256 ${got} ≠ manifest ${demManifest.source.sha256}. Refusing to load.`);
      }
      console.log(`ok  dem sha256 ${got}`);
      if (demManifest.province !== manifest.municipality.province) {
        throw new Error(`DEM manifest is for ${demManifest.province}, buildings for ${manifest.municipality.province}`);
      }
      const grid = parseAsciiGrid(extractAsciiGridPart(readFileSync(demPath, "latin1")));
      await upsertSource(pool, demManifest.source);
      const t2 = Date.now();
      const c = await computeClimate(pool, manifest.municipality.ine, manifest.municipality.province, grid, demManifest.source.id);
      console.log(`climate ${JSON.stringify(c)} in ${((Date.now() - t2) / 1000).toFixed(1)} s`);
    }

    const censusManifestPath = arg("census-manifest");
    if (censusManifestPath) {
      const cm = JSON.parse(readFileSync(censusManifestPath, "utf8"));
      const seccDir = required("secc-dir");
      const csvPath = required("c2021");
      const shpPath = join(seccDir, cm.boundaries.files.shp.name);
      const dbfPath = join(seccDir, cm.boundaries.files.dbf.name);
      for (const [p, want] of [
        [shpPath, cm.boundaries.files.shp.sha256],
        [dbfPath, cm.boundaries.files.dbf.sha256],
        [csvPath, cm.indicators.source.sha256],
      ] as const) {
        const got = await sha256(p);
        if (got !== want) throw new Error(`${p}: sha256 ${got} ≠ manifest ${want}. Refusing to load.`);
        console.log(`ok  ${p.split("/").pop()} sha256 ${got}`);
      }
      const prj = readFileSync(shpPath.replace(/\.shp$/, ".prj"), "utf8");
      if (!prj.includes(cm.boundaries.files.prj)) throw new Error(`section boundaries are not in ${cm.boundaries.files.prj}`);
      const ine = manifest.municipality.ine;
      const shapes = readPolygonShapefile(readFileSync(shpPath), readFileSync(dbfPath), (a) => a.CUMUN === ine, cm.boundaries.files.dbf.encoding);
      const indicators = parseC2021Indicators(readFileSync(csvPath, "utf8"), ine);
      await upsertSource(pool, cm.boundaries.source);
      await upsertSource(pool, cm.indicators.source);
      const t3 = Date.now();
      const loaded = await loadCensusSections(pool, ine, shapes, indicators, cm.boundaries.source.id, cm.indicators.source.id);
      const assigned = await assignBuildingsToSections(pool, ine);
      console.log(`census ${JSON.stringify(loaded)} sections; buildings ${JSON.stringify({ assigned: assigned.assigned, unassigned: assigned.unassigned.length, ties: assigned.ties })} in ${((Date.now() - t3) / 1000).toFixed(1)} s`);
      if (assigned.unassigned.length > 0) console.log(`unassigned: ${assigned.unassigned.join(" ")}`);
    }

    const epcManifestPath = arg("epc-manifest");
    if (epcManifestPath) {
      const em = JSON.parse(readFileSync(epcManifestPath, "utf8"));
      const xmlPath = required("epc");
      const got = await sha256(xmlPath);
      if (got !== em.xml.sha256) throw new Error(`${xmlPath}: sha256 ${got} ≠ manifest ${em.xml.sha256}. Refusing to load.`);
      console.log(`ok  ${em.xml.name} sha256 ${got}`);
      await upsertSource(pool, em.source);
      const t4 = Date.now();
      const e = await loadEpcRegister(
        pool,
        manifest.municipality.ine,
        createReadStream(xmlPath, { encoding: "utf8" }) as AsyncIterable<string>,
        em.xml.writtenOn,
        em.source.id,
      );
      console.log(`epc ${JSON.stringify(e)} in ${((Date.now() - t4) / 1000).toFixed(1)} s`);
    }

    if (process.argv.includes("--index")) {
      const t5 = Date.now();
      const ix = await computeIndex(pool, manifest.municipality.ine);
      console.log(`index ${JSON.stringify(ix)} in ${((Date.now() - t5) / 1000).toFixed(1)} s`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
