/**
 * H3.1/H3.2 — load one municipality's Catastro buildings into PostGIS and
 * derive their façades.
 *
 *   DATABASE_URL=… pnpm --filter @workspace/scripts h3:ingest -- \
 *     --manifest data/sources/h3/catastro-bu-14900.json \
 *     --dir /path/to/unzipped/A.ES.SDGC.BU.14900 \
 *     [--tolerance 0.2] \
 *     [--dem-manifest data/sources/h3/ign-mdt25-cordoba.json --dem /path/to/wcs-response.asc]
 *
 * Refuses to load a file whose sha256 differs from the manifest: every row
 * must trace to the exact file the manifest dates and hashes.
 */
import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { computeClimate, computeFacades, ensureH3Schema, ingestMunicipality, upsertSource } from "@workspace/screening/db";
import { extractAsciiGridPart, parseAsciiGrid } from "@workspace/screening";

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
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
