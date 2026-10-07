import { describe, expect, it } from "vitest";
import { P7_FORBIDDEN_ES } from "./index";
import { ENPE_2026_2030, VOCABULARY } from "./vocabulary";

describe("2b.3 (A24) — the vocabulary is official usage, cited by page", () => {
  it("holds exactly the five terms A24 rules, in the strategy's wording", () => {
    expect(VOCABULARY.map((v) => v.term)).toEqual([
      "pobreza energética",
      "pobreza energética en verano",
      "rehabilitación",
      "parque edificatorio",
      "cribado",
    ]);
  });

  it("does not carry the two terms the strategy does not use", () => {
    const terms = VOCABULARY.map((v) => v.term);
    expect(terms).not.toContain("viviendas difíciles de refrigerar");
    expect(terms).not.toContain("parque de viviendas");
  });

  it("every term appears verbatim in its own excerpt, on a real page", () => {
    for (const v of VOCABULARY) {
      expect(v.excerpt, v.term).toContain(v.term);
      expect(Number.isInteger(v.page) && v.page >= 1 && v.page <= 89, v.term).toBe(true);
      // A quotation, not a reproduction.
      expect(v.excerpt.split(/\s+/).length, v.term).toBeLessThan(15);
    }
  });

  it("names its source completely: document, authority, approval date, URL, read date, file hash", () => {
    const s = ENPE_2026_2030;
    expect(s.approved).toBe("2026-02-17");
    expect(s.url).toMatch(/^https:\/\/www\.miteco\.gob\.es\//);
    expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const v of VOCABULARY) expect(v.source).toBe(s);
  });

  it("says where the product's use is wider than the source's", () => {
    const cribado = VOCABULARY.find((v) => v.term === "cribado");
    expect(cribado?.note).toMatch(/BUILDING STOCK/);
  });

  it("P7: no term is a word a reader would take as a grade or a rating", () => {
    for (const v of VOCABULARY) for (const re of P7_FORBIDDEN_ES) expect(re.test(v.term), v.term).toBe(false);
  });
});
