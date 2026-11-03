import { describe, expect, it } from "vitest";
import { PUBLISHED_MIN_DWELLINGS, isPublished } from "./portfolio";

/**
 * VPUB audit, 3 Nov 2026: single-dwelling buildings are scored but not
 * published one by one. The SQL side (list, trace, export) is checked in
 * facades.integration.test.ts against PostGIS.
 */
describe("VPUB: publication threshold", () => {
  it("does not publish a building with one dwelling, publishes two or more", () => {
    expect(PUBLISHED_MIN_DWELLINGS).toBe(2);
    expect(isPublished(1)).toBe(false);
    expect(isPublished(2)).toBe(true);
    expect(isPublished(127)).toBe(true);
  });
});
