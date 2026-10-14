import { describe, expect, it } from "vitest";
import { ClimateLookupError, julyExposure, zoneFor } from "./climate";
import { facadeProfile } from "./orientation";

describe("zoneFor — CTE DB-HE Anejo B through @workspace/cte", () => {
  it("Córdoba at 100 m is B4 and at 151 m is C4 (the band edge in climate-zones.json)", () => {
    expect(zoneFor("Córdoba", 100).zone).toBe("B4");
    expect(zoneFor("Córdoba", 150.9).zone).toBe("B4");
    expect(zoneFor("Córdoba", 151).zone).toBe("C4");
    expect(zoneFor("Córdoba", 600).zone).toBe("D3");
  });

  it("carries summer severity as a number", () => {
    const z = zoneFor("Córdoba", 120);
    expect(z.summer).toBe(4);
    expect(z.winter).toBe("B");
    expect(z.archipelago).toBe("peninsular");
  });

  it("refuses an unaccented or unknown province rather than guessing one", () => {
    expect(() => zoneFor("Cordoba", 100)).toThrow();
    expect(() => zoneFor("Narnia", 100)).toThrow();
  });

  it("refuses a non-finite altitude", () => {
    expect(() => zoneFor("Córdoba", NaN)).toThrow(ClimateLookupError);
  });
});

describe("julyExposure — DA DB-HE/1 tabla 20, by inferred orientation", () => {
  // 10 m square, west wall shared: exposed N, E, S 10 m each.
  const f = facadeProfile([
    { ring: 1, azimuthDeg: 0, lengthM: 10, sharedM: 10 },
    { ring: 1, azimuthDeg: 90, lengthM: 10, sharedM: 0 },
    { ring: 1, azimuthDeg: 180, lengthM: 10, sharedM: 0 },
    { ring: 1, azimuthDeg: 270, lengthM: 10, sharedM: 0 },
  ]);

  it("sums length × Hsol;jul of each exposed orientation (B4: N 61.0, E 135.64, S 94.13)", () => {
    const e = julyExposure(zoneFor("Córdoba", 120), f);
    expect(e.zone).toBe("B4");
    expect(e.streetKwhPerMetreHeight).toBeCloseTo(10 * 61.0 + 10 * 135.64 + 10 * 94.13, 6);
    expect(e.streetMeanHsolJul).toBeCloseTo((61.0 + 135.64 + 94.13) / 3, 6);
    expect(e.roofHsolJul).toBe(235.31);
    expect(e.courtyardKwhPerMetreHeight).toBe(0);
  });

  it("a building with no exposed street façade has zero exposure and no mean", () => {
    const enclosed = facadeProfile([{ ring: 1, azimuthDeg: 0, lengthM: 5, sharedM: 5 }]);
    const e = julyExposure(zoneFor("Córdoba", 120), enclosed);
    expect(e.streetKwhPerMetreHeight).toBe(0);
    expect(e.streetMeanHsolJul).toBeNull();
  });

  it("west façades in Córdoba collect more than south ones in July (O 131.14 vs S 94.13)", () => {
    const west = facadeProfile([{ ring: 1, azimuthDeg: 0, lengthM: 1, sharedM: 0 }]);
    const south = facadeProfile([{ ring: 1, azimuthDeg: 270, lengthM: 1, sharedM: 0 }]);
    const z = zoneFor("Córdoba", 120);
    expect(julyExposure(z, west).streetKwhPerMetreHeight).toBe(131.14);
    expect(julyExposure(z, south).streetKwhPerMetreHeight).toBe(94.13);
  });
});
