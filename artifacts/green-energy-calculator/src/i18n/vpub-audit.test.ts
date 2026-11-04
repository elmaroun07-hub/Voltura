import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "./catalog";

/**
 * VPUB audit, 3 Nov 2026: what the public pages must say, in both languages.
 * Attribution (OpenStreetMap), the privacy notice, the AI-written analysis,
 * the calculator's assumptions and the single-house rule.
 */
const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe.each(["es", "en"] as const)("VPUB audit copy, %s", (lang) => {
  const c = catalog[lang] as Record<string, string>;

  it("credits OpenStreetMap under its licence, and links privacy and sources", () => {
    expect(c["footer.osm"]).toMatch(/OpenStreetMap/);
    expect(c["footer.osm"]).toMatch(/ODbL/);
    expect(c["footer.privacy"]).toBeTruthy();
    expect(c["footer.sources"]).toBeTruthy();
  });

  it("says the Optimizer's analysis is written by an AI model and the figures by the code", () => {
    expect(c["opt.analysis"]).toMatch(lang === "es" ? /modelo de IA/ : /AI model/);
  });

  it("names the calculator's modelling assumptions, including the 78 % system efficiency", () => {
    expect(c["results.assumptions"]).toMatch(/78/);
  });

  it("explains why a single-family house is not shown", () => {
    expect(c["building.notPublished"]).toMatch(lang === "es" ? /unifamiliar/ : /single-family/);
    expect(c["screening.singleHidden"]).toMatch(lang === "es" ? /unifamiliares/ : /Single-family/);
  });

  it("says orientation depends on the hemisphere", () => {
    // Said in the help line under the select, so the short labels fit the box.
    expect(c["calc.orientationHelp"]).toMatch(lang === "es" ? /sur/ : /southern/);
    expect(c["calc.orientationHelp"]).toMatch(lang === "es" ? /norte/ : /northern/);
    expect(src("../components/calculator/CalculatorForm.tsx")).toContain('t("calc.orientationHelp")');
  });
});

describe("VPUB audit pages and markup", () => {
  it("ships a privacy notice that names every outside service the app sends data to", () => {
    const html = src("../../public/privacy.html");
    for (const name of ["Render", "Groq", "Nominatim", "NASA POWER", "elmaroun07@gmail.com", "voltura.sessionId"]) {
      expect(html).toContain(name);
    }
  });

  it("links the privacy notice and the OpenStreetMap copyright page from every page", () => {
    const shell = src("../components/layout/Shell.tsx");
    expect(shell).toContain('href="/privacy.html"');
    expect(shell).toContain("https://www.openstreetmap.org/copyright");
  });

  it("marks AI-written text in the page itself (Article 50(2))", () => {
    expect(src("../components/chat/ChatInterface.tsx")).toContain('"machine-generated"');
    expect(src("../pages/Optimizer.tsx")).toContain('data-ai-disclosure="machine-generated"');
  });
});

describe("Agency access keys (3 Nov 2026)", () => {
  it.each(["es", "en"] as const)("the %s page explains the key and says each use is logged", (lang) => {
    const c = catalog[lang] as Record<string, string>;
    for (const k of ["title", "help", "use", "remove", "checking", "active", "allShown", "invalid", "invalidBody"]) {
      expect(c[`screening.agency.${k}`], k).toBeTruthy();
    }
    expect(c["screening.agency.active"]).toMatch(lang === "es" ? /registrado/ : /logged/);
  });

  it("sends the key as X-Agency-Key on every screening read and on the export", () => {
    const hooks = src("../hooks/use-screening.ts");
    expect(hooks).toContain('"X-Agency-Key"');
    expect(hooks).toContain("sessionFetch(path, { headers: agencyHeaders() })");
    expect(hooks).toContain("export.csv`, { headers: agencyHeaders() })");
  });

  it("the privacy notice says agencies with a key see single-family houses and that uses are logged", () => {
    const html = src("../../public/privacy.html");
    expect(html).toContain("clave de acceso");
    expect(html).toContain("access key");
  });
});
