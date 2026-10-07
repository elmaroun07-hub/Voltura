import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  defineCatalog,
  createTranslator,
  emptyEntries,
  formatNumber,
  localeFromAcceptLanguage,
  monthName,
  p7Violations,
  parseLocale,
  placeholderMismatches,
  translate,
} from "./index";

const catalog = defineCatalog(
  {
    greeting: "Hola",
    saving: "{n} kWh al año",
    two: "{a} y {b}",
  },
  {
    greeting: "Hello",
    saving: "{n} kWh a year",
    two: "{a} and {b}",
  },
);

describe("2b.1 — Spanish is the default", () => {
  it("defaults to es", () => {
    expect(DEFAULT_LOCALE).toBe("es");
  });

  it("reads the top Accept-Language tag; absent or unsupported falls to es", () => {
    expect(localeFromAcceptLanguage("en")).toBe("en");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("es-ES")).toBe("es");
    expect(localeFromAcceptLanguage("fr-FR,en;q=0.5")).toBe("es");
    expect(localeFromAcceptLanguage("de;q=0.4,en;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage(undefined)).toBe("es");
    expect(localeFromAcceptLanguage("")).toBe("es");
  });

  it("parseLocale answers null rather than guessing", () => {
    expect(parseLocale("es")).toBe("es");
    expect(parseLocale("EN")).toBeNull();
    expect(parseLocale("ar")).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });
});

describe("translate", () => {
  it("fills placeholders in the asked language", () => {
    const tEs = createTranslator(catalog, "es");
    const tEn = createTranslator(catalog, "en");
    expect(tEs("saving", { n: 3860 })).toBe("3860 kWh al año");
    expect(tEn("saving", { n: 3860 })).toBe("3860 kWh a year");
    expect(tEs("two", { a: "x", b: "y" })).toBe("x y y");
  });

  it("throws on a missing parameter instead of printing {n}", () => {
    expect(() => translate(catalog, "es", "saving", {})).toThrow(/needs \{n\}/);
  });

  it("throws on a missing key instead of printing the key or the other language", () => {
    expect(() => translate(catalog, "es", "nope")).toThrow(/no es entry/);
    // An inherited property is not an entry.
    expect(() => translate(catalog, "es", "toString")).toThrow(/no es entry/);
  });
});

describe("catalog checks the type system cannot make", () => {
  it("finds an English template whose placeholders differ from the Spanish", () => {
    const bad = { es: { k: "{n} kWh" }, en: { k: "{m} kWh" } };
    expect(placeholderMismatches(bad)).toEqual(["k: es {n} vs en {m}"]);
    expect(placeholderMismatches(catalog)).toEqual([]);
  });

  it("finds empty entries", () => {
    expect(emptyEntries({ es: { k: " " }, en: { k: "x" } })).toEqual(["es.k"]);
    expect(emptyEntries(catalog)).toEqual([]);
  });

  it("P7: flags the Spanish words a reader would take as a grade or a rating", () => {
    const bad = {
      es: { a: "Calificación del edificio", b: "Resultado de cumplimiento", c: "Índice de cribado" },
      en: { a: "x", b: "y", c: "z" },
    };
    expect(p7Violations(bad)).toEqual(["a", "b"]);
  });
});

describe("numbers and months follow the reader's language", () => {
  it("es-ES writes a decimal comma and groups from five digits", () => {
    expect(formatNumber("es", 12345.6)).toBe("12.345,6");
    expect(formatNumber("en", 12345.6)).toBe("12,345.6");
    expect(formatNumber("es", 3860)).toBe("3860");
  });

  it("month names come from the month number", () => {
    expect(monthName("es", 1, "long")).toBe("enero");
    expect(monthName("en", 1, "long")).toBe("January");
    expect(() => monthName("es", 13)).toThrow();
  });
});
