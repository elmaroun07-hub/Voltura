import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkTranscript, KNOWN_FALSE_CLAIMS, LIVE_SLIP_CLAIMS, normalise, SPANISH_CLAIMS } from "./transcript-checker";

/**
 * H2b 2b.5: the checker reads Spanish.
 *
 * es-claim-lines.json holds one Spanish rendering of each recorded English
 * line a claim was learnt from, and a correct Spanish statement of the same
 * point. The renderings are the executor's, not model output - no Spanish
 * transcript exists yet - so this proves the patterns read Spanish, not that
 * they know every Spanish slip. The live read stays the gate (A-e).
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/", import.meta.url);
const json = (p: string) => JSON.parse(readFileSync(new URL(p, FIXTURES), "utf8"));
const es: { lines: { id: string; from: string; line: string }[]; corrected: { id: string; line: string }[] } = json(
  "h2b-5/es-claim-lines.json",
);
const spanishIds = (text: string) =>
  SPANISH_CLAIMS.filter(({ pattern }) => pattern.test(normalise(text))).map((c) => c.id);

describe("2b.5 — the transcript checker reads Spanish", () => {
  it("one Spanish row for every English claim, same ids, same truth", () => {
    const english = [...KNOWN_FALSE_CLAIMS, ...LIVE_SLIP_CLAIMS];
    expect(SPANISH_CLAIMS.map((c) => c.id)).toEqual(english.map((c) => c.id));
    for (const c of SPANISH_CLAIMS) expect(c.truth, c.id).toBe(english.find((e) => e.id === c.id)!.truth);
  });

  it("the fixture renders each claim once, and a correction for each", () => {
    expect(es.lines.map((l) => l.id)).toEqual(SPANISH_CLAIMS.map((c) => c.id));
    expect(es.corrected.map((l) => l.id)).toEqual(SPANISH_CLAIMS.map((c) => c.id));
  });

  it.each(es.lines.map((l) => [l.id, l.line] as const))("flags %s in its Spanish rendering", (id, line) => {
    expect(checkTranscript(line).map((f) => f.id)).toContain(id);
  });

  it("every Spanish pattern fires on its own rendering (none is dead)", () => {
    for (const { id, line } of es.lines) expect(spanishIds(line), id).toContain(id);
  });

  it("flags nothing in the corrected Spanish lines", () => {
    expect(es.corrected.map((l) => [l.id, checkTranscript(l.line)]).filter(([, f]) => (f as unknown[]).length)).toEqual([]);
  });

  it("the Spanish patterns stay silent on the English fixtures", () => {
    const a0 = readFileSync(new URL("h-asst-accuracy/a0.txt", FIXTURES), "utf8");
    const a0c = readFileSync(new URL("h-asst-accuracy/a0-corrected.txt", FIXTURES), "utf8");
    const failing: { line: string }[] = json("h-asst-acc2/failing-lines.json").lines;
    const corrected: string[] = json("h-asst-acc2/corrected-lines.json").lines;
    for (const text of [a0, a0c, ...failing.map((l) => l.line), ...corrected]) expect(spanishIds(text)).toEqual([]);
  });
});
