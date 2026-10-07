import { describe, expect, it } from "vitest";
import { emptyEntries, p7Violations, placeholderMismatches } from "@workspace/i18n";
import { serverCatalog } from "./i18n";

/** What `tsc` cannot see in the server catalog (it checks keys, not the strings). */
describe("server catalog — H2b", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(serverCatalog.en).sort()).toEqual(Object.keys(serverCatalog.es).sort());
  });

  it("asks for the same parameters in Spanish and English", () => {
    expect(placeholderMismatches(serverCatalog)).toEqual([]);
  });

  it("has no empty entry", () => {
    expect(emptyEntries(serverCatalog)).toEqual([]);
  });

  it("P7: no Spanish entry calls anything a calificación or a compliance result", () => {
    expect(p7Violations(serverCatalog)).toEqual([]);
  });

  it("no multi-word Spanish entry is just the English", () => {
    const copied = Object.keys(serverCatalog.es).filter((key) => {
      const es = (serverCatalog.es as Record<string, string>)[key];
      const en = (serverCatalog.en as Record<string, string>)[key];
      return es === en && /\p{L}{2,}\s+\p{L}{2,}/u.test(es);
    });
    expect(copied).toEqual([]);
  });
});
