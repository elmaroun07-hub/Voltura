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
export { ALTITUDE_BASIS, IRRADIATION_SOURCE, computeClimate, type ClimateRunStats } from "./climate-db";
export {
  SECTION_METHOD,
  assignBuildingsToSections,
  loadCensusSections,
  type CensusLoadStats,
  type SectionAssignStats,
} from "./census-db";
export { loadEpcRegister, type EpcLoadStats } from "./epc-db";
export { computeIndex, type IndexRunStats } from "./index-db";
