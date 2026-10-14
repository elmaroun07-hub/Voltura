/**
 * H3.2 — façade segments from footprint geometry (PostGIS).
 *
 * For every building of one municipality, every edge of its footprint, with:
 *   - the edge's own azimuth (clockwise from grid north, degrees),
 *   - whether it lies on the outer ring or on a courtyard ring,
 *   - its length, and how much of that length is shared with a neighbouring
 *     building (a party wall, medianera) rather than exposed to the sky.
 *
 * Method, so the reader can check it:
 *   1. Patches of one building are merged by ST_MakeValid: two patches that
 *      share an edge make an invalid MultiPolygon, and making it valid
 *      dissolves the seam, so an internal edge between two patches of the
 *      same building is not a façade. (An ST_UnaryUnion here was removed on
 *      14 Oct 2026: mutation testing showed it changed nothing once
 *      ST_MakeValid had run — the integration test that splits a building
 *      in two is what pins this.)
 *   2. Rings are forced clockwise (ST_ForcePolygonCW): outer rings clockwise,
 *      courtyard rings counter-clockwise. With that orientation the building
 *      is always on the RIGHT of an edge walked from start to end, so the
 *      outward normal is the edge azimuth minus 90° (see orientation.ts).
 *   3. Neighbours are the other buildings within `tolerance` metres; their
 *      footprints are merged and buffered by the same tolerance. The part of
 *      an edge inside that zone is a party wall; the rest is exposed.
 *
 * Parameters: $1 INE municipality code, $2 tolerance in metres, $3 the refs
 * of this batch (the caller pages through a municipality so no single result
 * set holds every edge of 37,850 buildings).
 *
 * The tolerance is a parameter, not a constant buried in the query, because
 * it decides how much façade a dense historic block has. The Catastro states
 * a horizontal accuracy of 0.1 m on these footprints.
 *
 * This is inferred, not sourced (H3.2): no public register publishes which
 * walls of a building are exposed.
 */
export const FACADE_SEGMENTS_SQL = `
WITH target AS (
  SELECT ref, footprint
    FROM h3_buildings
   WHERE ine_municipality = $1
     AND ref = ANY($3::text[])
),
outline AS (
  SELECT ref,
         ST_ForcePolygonCW(
           ST_Multi(ST_CollectionExtract(ST_MakeValid(footprint), 3))
         ) AS g
    FROM target
),
neighbour_zone AS (
  SELECT o.ref,
         (SELECT ST_Buffer(ST_Union(n.footprint), $2)
            FROM h3_buildings n
           WHERE n.ref <> o.ref
             AND ST_DWithin(n.footprint, o.g, $2)) AS zone
    FROM outline o
),
segments AS (
  SELECT o.ref, d.path, d.geom AS s
    FROM outline o
   CROSS JOIN LATERAL ST_DumpSegments(o.g) AS d
)
SELECT s.ref,
       s.path[2] AS ring,
       degrees(ST_Azimuth(ST_StartPoint(s.s), ST_EndPoint(s.s))) AS azimuth_deg,
       ST_Length(s.s) AS length_m,
       -- No neighbour within tolerance is a measured fact (zone IS NULL), and
       -- its shared length is zero by definition — not a default standing in
       -- for a value that failed to compute.
       CASE WHEN z.zone IS NULL THEN 0
            ELSE ST_Length(ST_Intersection(s.s, z.zone)) END AS shared_m
  FROM segments s
  JOIN neighbour_zone z USING (ref)
 WHERE ST_Length(s.s) > 0
 ORDER BY s.ref, s.path
`;
