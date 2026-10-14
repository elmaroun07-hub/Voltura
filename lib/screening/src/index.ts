/**
 * @workspace/screening — HeatShield Layer 1 (H3): a portfolio-scale summer-heat
 * screening index built only from data obtainable without entering a building.
 *
 * P7: what this package produces is a screening index with an uncertainty
 * band. It is never a grade, a rating or a compliance result.
 */
export {
  CatastroParseError,
  SUPPORTED_EPSG,
  featureBlocks,
  parseBuildingFeature,
  parseBuildingPartFeature,
  type CatastroBuilding,
  type CatastroBuildingPart,
  type Polygon,
  type Position,
  type Ring,
  type SupportedEpsg,
} from "./catastro/gml";
export {
  CTE_ORIENTATIONS,
  FacadeGeometryError,
  exposedTotalM,
  facadeProfile,
  outwardNormalDeg,
  type FacadeProfile,
  type FacadeSegment,
  type MetresByOrientation,
  type Orientation,
} from "./orientation";
