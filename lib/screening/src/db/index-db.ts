/**
 * H3.7 + H3.8 in the database: read every residential building's inputs,
 * compute the municipality's references, score, rank on the high end.
 */
import type { Client, Pool, PoolClient } from "pg";
import { peopleInputs } from "../census/indicators";
import { METHOD_V1, computeReferences, scoreBuilding, type BuildingInputs, type IndexMethod } from "../heat-index";

type Db = Pool | PoolClient | Client;

export interface IndexRunStats {
  readonly runId: string;
  readonly scored: number;
  readonly notScored: { readonly notResidential: number; readonly noDwellings: number };
  readonly withCertificate: number;
  readonly withoutCensusInput: number;
  readonly coolingCap: number;
  readonly cappedBuildings: number;
}

const INPUTS_SQL = `
SELECT b.ref, b.dwellings, b.year_end, b.current_use,
       c.july_roof_kwh_m2, c.july_street_kwh_per_m, f.perimeter_m,
       e.entries, e.cooling_demand_median, e.cooling_demand_min, e.cooling_demand_max,
       cs.indicators
  FROM h3_buildings b
  JOIN h3_facades_inferred f USING (ref)
  JOIN h3_building_climate c USING (ref)
  LEFT JOIN h3_building_epc e USING (ref)
  LEFT JOIN h3_building_section s USING (ref)
  LEFT JOIN h3_census_sections cs ON cs.cusec = s.cusec
 WHERE b.ine_municipality = $1
 ORDER BY b.ref`;

type Row = {
  ref: string; dwellings: number | null; year_end: number | null; current_use: string | null;
  july_roof_kwh_m2: string; july_street_kwh_per_m: string; perimeter_m: string;
  entries: number | null; cooling_demand_median: string | null; cooling_demand_min: string | null; cooling_demand_max: string | null;
  indicators: Record<string, number | null> | null;
};


export async function computeIndex(db: Db, ineMunicipality: string, method: IndexMethod = METHOD_V1): Promise<IndexRunStats> {
  const rows = (await db.query<Row>(INPUTS_SQL, [ineMunicipality])).rows;
  let notResidential = 0;
  let noDwellings = 0;
  const inputs: BuildingInputs[] = [];
  for (const r of rows) {
    if (r.current_use !== "1_residential") { notResidential++; continue; }
    if (!(r.dwellings !== null && r.dwellings > 0)) { noDwellings++; continue; }
    const hasCert = r.entries !== null && r.cooling_demand_median !== null;
    inputs.push({
      ref: r.ref,
      dwellings: r.dwellings,
      year: r.year_end,
      hsolHorizontal: Number(r.july_roof_kwh_m2),
      streetKwhPerMetre: Number(r.july_street_kwh_per_m),
      perimeterM: Number(r.perimeter_m),
      certificate: hasCert
        ? { entries: r.entries!, median: Number(r.cooling_demand_median), min: Number(r.cooling_demand_min), max: Number(r.cooling_demand_max) }
        : null,
      census: peopleInputs(r.indicators),
    });
  }
  const values = (
    await db.query<{ v: string }>(
      `SELECT c.cooling_demand AS v FROM h3_epc_certificates c JOIN h3_buildings b USING (ref)
        WHERE b.ine_municipality = $1 AND c.cooling_demand IS NOT NULL`,
      [ineMunicipality],
    )
  ).rows.map((r) => Number(r.v));
  const refs = computeReferences(inputs, values, method);
  const scores = inputs.map((b) => scoreBuilding(b, refs));
  const ranked = [...scores].sort(
    (a, b) => b.index.high - a.index.high || b.index.mid - a.index.mid || (a.ref < b.ref ? -1 : 1),
  );
  const runId = `${method.version}-${ineMunicipality}-${new Date().toISOString()}`;
  await db.query(
    `INSERT INTO h3_index_runs (id, ine_municipality, method, refs, scored, not_scored) VALUES ($1,$2,$3,$4,$5,$6)`,
    [runId, ineMunicipality, JSON.stringify(method), JSON.stringify(refs), scores.length, JSON.stringify({ notResidential, noDwellings })],
  );
  for (let i = 0; i < ranked.length; i += 1000) {
    const page = ranked.slice(i, i + 1000);
    const values: unknown[] = [];
    const tuples: string[] = [];
    page.forEach((s, j) => {
      const k = values.length;
      values.push(s.ref, runId, s.index.low, s.index.mid, s.index.high, i + j + 1, JSON.stringify(s.factors), JSON.stringify(s.completeness));
      tuples.push(`($${k + 1},$${k + 2},$${k + 3},$${k + 4},$${k + 5},$${k + 6},$${k + 7}::jsonb,$${k + 8}::jsonb)`);
    });
    await db.query(
      `INSERT INTO h3_index (ref, run_id, index_low, index_mid, index_high, rank_high, factors, completeness)
       VALUES ${tuples.join(",")}
       ON CONFLICT (ref) DO UPDATE SET run_id = EXCLUDED.run_id, index_low = EXCLUDED.index_low,
         index_mid = EXCLUDED.index_mid, index_high = EXCLUDED.index_high, rank_high = EXCLUDED.rank_high,
         factors = EXCLUDED.factors, completeness = EXCLUDED.completeness`,
      values,
    );
  }
  return {
    runId,
    scored: scores.length,
    notScored: { notResidential, noDwellings },
    withCertificate: inputs.filter((b) => b.certificate !== null).length,
    withoutCensusInput: inputs.filter((b) => b.census === null).length,
    coolingCap: refs.coolingCap.value,
    cappedBuildings: scores.filter((x) => x.completeness.certificateCapped).length,
  };
}
