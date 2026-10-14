import { describe, expect, it } from "vitest";
import { DemError, extractAsciiGridPart, parseAsciiGrid, sampleCell } from "./ascii-grid";

/**
 * 3 × 2 grid, 25 m cells, lower-left at (1000, 2000):
 *   row 0 (north, y 2025–2050):  10  20  30
 *   row 1 (south, y 2000–2025):  40  50  60
 */
const GRID = [
  "ncols        3",
  "nrows        2",
  "xllcorner    1000.000000000000",
  "yllcorner    2000.000000000000",
  "cellsize     25.000000000000",
  " 10.000 20.000 30.000",
  " 40.000 50.000 60.000",
].join("\r\n");

/** Shape of the IGN WCS answer: grid part, then a .prj part. */
const MULTIPART = [
  "",
  "--wcs",
  "Content-Type: application/asc",
  "Content-Description: coverage data",
  "Content-Transfer-Encoding: binary",
  "Content-ID: coverage/out.asc",
  "Content-Disposition: INLINE; filename=out.asc",
  "",
  GRID,
  "--wcs",
  "Content-Type: application/octet-stream",
  "Content-Description: coverage data",
  "",
  'PROJCS["ETRS89_UTM_zone_30N",GEOGCS["GCS_ETRS_1989"]]',
  "--wcs--",
  "",
].join("\r\n");

describe("extractAsciiGridPart", () => {
  it("takes the grid out of the IGN's multipart answer and leaves the .prj", () => {
    const g = parseAsciiGrid(extractAsciiGridPart(MULTIPART));
    expect(g.ncols).toBe(3);
    expect(Array.from(g.values)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("accepts a bare grid", () => {
    expect(extractAsciiGridPart(GRID)).toBe(GRID);
  });

  it("refuses a multipart body with no grid part (e.g. an exception report)", () => {
    const noGrid = MULTIPART.replace("application/asc", "text/xml");
    expect(() => extractAsciiGridPart(noGrid)).toThrow(DemError);
  });

  it("refuses something that is neither", () => {
    expect(() => extractAsciiGridPart("<ExceptionReport/>")).toThrow(DemError);
  });
});

describe("parseAsciiGrid", () => {
  it("reads the header and the values in row order, north first", () => {
    const g = parseAsciiGrid(GRID);
    expect(g).toMatchObject({ ncols: 3, nrows: 2, xll: 1000, yll: 2000, cellSize: 25, nodata: null });
  });

  it("refuses a body shorter than the header promises", () => {
    expect(() => parseAsciiGrid(GRID.replace(" 40.000 50.000 60.000", " 40.000 50.000"))).toThrow(/holds 5 values/);
  });

  it("refuses a non-numeric cell", () => {
    expect(() => parseAsciiGrid(GRID.replace("50.000", "n/a"))).toThrow(DemError);
  });

  it("reads NODATA_value when present", () => {
    const g = parseAsciiGrid(GRID.replace("cellsize     25.000000000000", "cellsize     25.000000000000\r\nNODATA_value -9999"));
    expect(g.nodata).toBe(-9999);
  });
});

describe("sampleCell", () => {
  const g = parseAsciiGrid(GRID);

  it("returns the cell containing the point", () => {
    expect(sampleCell(g, 1001, 2049)).toBe(10); // north-west cell
    expect(sampleCell(g, 1074, 2001)).toBe(60); // south-east cell
    expect(sampleCell(g, 1030, 2010)).toBe(50); // south-middle
  });

  it("a point on a cell's south-west edge belongs to that cell", () => {
    expect(sampleCell(g, 1025, 2025)).toBe(20);
  });

  it("refuses a point outside the grid rather than clamping to the edge", () => {
    expect(() => sampleCell(g, 999.9, 2010)).toThrow(/outside/);
    expect(() => sampleCell(g, 1075, 2010)).toThrow(/outside/);
    expect(() => sampleCell(g, 1010, 2050)).toThrow(/outside/);
  });

  it("refuses a nodata cell", () => {
    const withHole = parseAsciiGrid(
      GRID.replace("cellsize     25.000000000000", "cellsize     25.000000000000\r\nNODATA_value -9999").replace("50.000", "-9999"),
    );
    expect(() => sampleCell(withHole, 1030, 2010)).toThrow(/nodata/);
  });
});
