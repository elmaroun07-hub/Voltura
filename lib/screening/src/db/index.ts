export { H3_SCHEMA_SQL } from "./schema";
export { FACADE_SEGMENTS_SQL } from "./facades-sql";
export {
  type SourceRecord,
  type IngestStats,
  type MunicipalityIngest,
  type FacadeRunStats,
  ensureH3Schema,
  upsertSource,
  toMultiPolygonWkt,
  ingestMunicipality,
  computeFacades,
} from "./ingest";
