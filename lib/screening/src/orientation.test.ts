import { describe, expect, it } from "vitest";
import {
  FacadeGeometryError,
  exposedTotalM,
  facadeProfile,
  outwardNormalDeg,
  type FacadeSegment,
} from "./orientation";

/**
 * A 10 m square walked clockwise from its south-west corner:
 * (0,0)→(0,10) west wall, (0,10)→(10,10) north wall,
 * (10,10)→(10,0) east wall, (10,0)→(0,0) south wall.
 * Edge azimuths 0°, 90°, 180°, 270°.
 */
const square = (shared: Partial<Record<0 | 90 | 180 | 270, number>> = {}): FacadeSegment[] =>
  ([0, 90, 180, 270] as const).map((az) => ({
    ring: 1,
    azimuthDeg: az,
    lengthM: 10,
    sharedM: shared[az] ?? 0,
  }));

describe("outwardNormalDeg — the building is on the right of a clockwise edge", () => {
  it("maps each wall of a clockwise square to the direction it faces", () => {
    expect(outwardNormalDeg(0)).toBe(270); // west wall faces west
    expect(outwardNormalDeg(90)).toBe(0); // north wall faces north
    expect(outwardNormalDeg(180)).toBe(90); // east wall faces east
    expect(outwardNormalDeg(270)).toBe(180); // south wall faces south
  });

  it("wraps into [0, 360)", () => {
    expect(outwardNormalDeg(45)).toBe(315);
    expect(outwardNormalDeg(360)).toBe(270);
    expect(outwardNormalDeg(-10)).toBe(260);
  });
});

describe("facadeProfile", () => {
  it("a free-standing square exposes 10 m to each of N, E, S, O", () => {
    const p = facadeProfile(square());
    expect(p.basis).toBe("inferred-from-footprint");
    expect(p.perimeterM).toBe(40);
    expect(p.partyWallM).toBe(0);
    expect(p.street).toEqual({ N: 10, NE: 0, E: 10, SE: 0, S: 10, SO: 0, O: 10, NO: 0 });
    expect(exposedTotalM(p)).toBe(40);
  });

  it("a party wall on the west removes the west façade, not another one", () => {
    const p = facadeProfile(square({ 0: 10 }));
    expect(p.partyWallM).toBe(10);
    expect(p.street.O).toBe(0);
    expect(p.street.N).toBe(10);
    expect(p.street.S).toBe(10);
    expect(exposedTotalM(p)).toBe(30);
  });

  it("a terrace house with both side walls shared exposes only front and back", () => {
    const p = facadeProfile(square({ 0: 10, 180: 10 }));
    expect(p.street).toEqual({ N: 10, NE: 0, E: 0, SE: 0, S: 10, SO: 0, O: 0, NO: 0 });
  });

  it("partial sharing leaves the remainder exposed", () => {
    const p = facadeProfile(square({ 270: 4 }));
    expect(p.street.S).toBe(6);
  });

  it("courtyard edges are counted apart from street façades", () => {
    const p = facadeProfile([
      ...square(),
      { ring: 2, azimuthDeg: 270, lengthM: 3, sharedM: 0 }, // ring walked CCW: faces into the patio
    ]);
    expect(p.courtyard.S).toBe(3);
    expect(p.street.S).toBe(10);
  });

  it("uses the CTE's non-uniform sectors: S spans 162–198°, so 197.9° is S and 198° is SO", () => {
    const at = (normal: number) =>
      facadeProfile([{ ring: 1, azimuthDeg: normal + 90, lengthM: 1, sharedM: 0 }]).street;
    expect(at(197.9).S).toBe(1);
    expect(at(198).SO).toBe(1);
    expect(at(60).E).toBe(1); // Este starts at 60°, not 67.5°
  });

  it("caps a shared length that overshoots the edge by rounding", () => {
    const p = facadeProfile([{ ring: 1, azimuthDeg: 0, lengthM: 5, sharedM: 5.0000001 }]);
    expect(p.street.O).toBe(0);
    expect(p.partyWallM).toBe(5);
  });

  it("refuses inputs no geometry can produce instead of returning zeros", () => {
    expect(() => facadeProfile([])).toThrow(FacadeGeometryError);
    expect(() => facadeProfile([{ ring: 1, azimuthDeg: NaN, lengthM: 1, sharedM: 0 }])).toThrow(
      FacadeGeometryError,
    );
    expect(() => facadeProfile([{ ring: 1, azimuthDeg: 0, lengthM: 0, sharedM: 0 }])).toThrow(
      FacadeGeometryError,
    );
    expect(() => facadeProfile([{ ring: 1, azimuthDeg: 0, lengthM: 1, sharedM: -1 }])).toThrow(
      FacadeGeometryError,
    );
    expect(() => facadeProfile([{ ring: 0, azimuthDeg: 0, lengthM: 1, sharedM: 0 }])).toThrow(
      FacadeGeometryError,
    );
  });
});
