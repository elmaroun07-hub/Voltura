import { describe, expect, it } from "vitest";
import { emptyEntries, p7Violations, placeholderMismatches } from "@workspace/i18n";
import { catalog } from "./catalog";

/**
 * What `tsc` cannot see in the web catalog: it checks that both tables have
 * the same keys, not what is inside the strings.
 */
describe("web catalog", () => {
  it("has the same keys in both languages (and nothing extra at runtime)", () => {
    expect(Object.keys(catalog.en).sort()).toEqual(Object.keys(catalog.es).sort());
  });

  it("asks for the same parameters in Spanish and English", () => {
    expect(placeholderMismatches(catalog)).toEqual([]);
  });

  it("has no empty entry", () => {
    expect(emptyEntries(catalog)).toEqual([]);
  });

  it("P7: no Spanish entry calls anything a calificación or a compliance result", () => {
    expect(p7Violations(catalog)).toEqual([]);
  });

  /**
   * An English sentence copied into the Spanish table passes every check
   * above. Any entry of two or more words that is identical in both
   * languages is that defect — except the ones listed here, each for a
   * stated reason.
   */
  it("no multi-word Spanish entry is just the English", () => {
    const SAME_ON_PURPOSE: Record<string, string> = {
      "opt.defaultLocation": "a place name, prefilled as an example",
    };
    const copied = Object.keys(catalog.es).filter((key) => {
      const es = (catalog.es as Record<string, string>)[key];
      const en = (catalog.en as Record<string, string>)[key];
      return es === en && /\p{L}{2,}\s+\p{L}{2,}/u.test(es) && !(key in SAME_ON_PURPOSE);
    });
    expect(copied).toEqual([]);
  });
});
