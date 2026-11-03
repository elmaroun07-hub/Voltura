import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { RETIRED_BY_VPUB, checkTranscriptNow } from "./transcript-checker";
import { FACTS_BY_LOCALE } from "./facts";
import { serverCatalog } from "../../i18n";

// The prompts live in ./routes, which imports storage (a database) and the
// model client: both are stubbed, as ai-disclosure.test.ts does.
vi.mock("./storage", () => ({ chatStorage: {} }));
vi.mock("../../lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/llm")>()), getLlmClient: () => ({}) }));
const { SYSTEM_PROMPTS } = await import("./routes");

/**
 * VPUB, 3 Nov 2026 ("NASA unavailable"): the latitude estimate is gone, so the
 * checker for live runs flips two judgements. Lines the earlier rounds called
 * false for saying "NASA unavailable -> the calculation stops" (N1) are now
 * true; lines that called the latitude estimate correct are now false (V1).
 * The earlier suites keep judging their own rounds with `checkTranscript`.
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/", import.meta.url);
const json = (p: string) => JSON.parse(readFileSync(new URL(p, FIXTURES), "utf8"));
type Line = { id?: string; lang: "es" | "en"; line: string };
const acc3: { lines: Line[]; renderings: Line[]; silent: Line[] } = json("h-asst-acc3/live-lines.json");
const acc2: { lines: Line[] } = json("h-asst-acc2/failing-lines.json");

const ids = (text: string) => checkTranscriptNow(text).map((f) => f.id);

describe("VPUB - the live checker after the latitude estimate was removed", () => {
  it("retires N1 only", () => {
    expect([...RETIRED_BY_VPUB]).toEqual(["N1"]);
  });

  it.each(acc3.lines.filter((l) => l.id === "N1").map((l) => [l.lang, l.line] as const))(
    "no longer flags an N1 line as false (%s): stopping is now what happens",
    (_lang, line) => {
      expect(ids(line)).not.toContain("N1");
    },
  );

  it.each([
    ["en", "If NASA data are unavailable, falls back to a latitude-based estimate."],
    ["en", "When NASA does not answer, Voltura estimates irradiance from the latitude and labels it."],
    ["es", "Si la API no responde, usa una estimación basada en la latitud."],
    ["es", "si NASA no responde, Voltura estima la irradiancia a partir de la latitud."],
  ] as const)("flags a latitude-estimate claim as V1 (%s)", (_lang, line) => {
    expect(ids(line)).toContain("V1");
  });

  it("flags every latitude line the earlier rounds recorded, as V1 or as E1/N2", () => {
    const latitudeLines = [...acc3.lines, ...acc3.silent, ...acc2.lines].filter((l) => /latitud/i.test(l.line));
    expect(latitudeLines.length).toBeGreaterThan(5);
    for (const l of latitudeLines) {
      const found = ids(l.line);
      expect(found.some((id) => id === "V1" || id === "E1" || id === "N2"), l.line.slice(0, 80)).toBe(true);
    }
  });

  it.each(["en", "es"] as const)("flags nothing in the %s facts, prompt or catalog answers", (lang) => {
    for (const f of FACTS_BY_LOCALE[lang]) expect(ids(f.text), f.id).toEqual([]);
    expect(ids(serverCatalog[lang]["chat.outOfScope"])).toEqual([]);
    expect(ids(serverCatalog[lang]["chat.aiAnswer"])).toEqual([]);
    expect(ids(serverCatalog[lang]["error.nasaUnavailable"])).toEqual([]);
    expect(ids(SYSTEM_PROMPTS[lang])).not.toContain("V1");
  });

  it("does not flag the true statement of what happens now", () => {
    expect(ids("If NASA does not answer, the calculation stops with an error and gives no result.")).toEqual([]);
    expect(ids("Si la NASA no contesta, el cálculo se detiene con un error y no hay resultado.")).toEqual([]);
    // Latitude named as an input, not as an estimate.
    expect(ids("NASA POWER is queried at the latitude and longitude of the place you type.")).toEqual([]);
  });
});
