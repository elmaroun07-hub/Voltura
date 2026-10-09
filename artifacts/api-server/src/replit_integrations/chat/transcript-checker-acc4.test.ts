import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ACC4_CLAIMS, checkTranscript, normalise } from "./transcript-checker";
import { FACTS_BY_LOCALE } from "./facts";
import { serverCatalog } from "../../i18n";

/**
 * H-ASST-ACC4 A.5: the checker knows the slips H-ASST-ACC3's L2 found live,
 * 8 Oct 2026. Each pattern fires on the line it was learnt from, and stays
 * silent on the correct lines of the same run, on the reworded facts, on the
 * refusal sentence and on every fixture the earlier blocks recorded.
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/", import.meta.url);
const json = (p: string) => JSON.parse(readFileSync(new URL(p, FIXTURES), "utf8"));
type Line = { id?: string; lang: "es" | "en"; conv?: number; line: string };
const live: { lines: Line[]; renderings: Line[]; silent: Line[]; refusals: Line[]; reclassified: Line[] } =
  json("h-asst-acc4/live-lines.json");

const acc4Ids = (text: string) =>
  [...new Set(ACC4_CLAIMS.filter(({ pattern }) => pattern.test(normalise(text))).map((c) => c.id))];

describe("H-ASST-ACC4 — the checker knows ACC3's live slips", () => {
  it("the fixture records the live lines of 10 conversations, in both languages", () => {
    expect(new Set(live.lines.map((l) => l.conv))).toEqual(new Set([97, 98, 100, 101, 102, 103, 104, 111, 113, 116]));
    expect(new Set(live.lines.map((l) => l.lang))).toEqual(new Set(["es", "en"]));
  });

  it.each(live.lines.map((l) => [l.id!, l.lang, l.conv!, l.line] as const))(
    "flags %s (%s, conversation %i) in the line it was learnt from",
    (id, _lang, _conv, line) => {
      expect(checkTranscript(line).map((f) => f.id)).toContain(id);
    },
  );

  it.each(live.renderings.map((l) => [l.id!, l.lang, l.line] as const))("flags %s in its %s rendering", (id, _lang, line) => {
    expect(checkTranscript(line).map((f) => f.id)).toContain(id);
  });

  it.each(live.reclassified.map((l) => [l.id!, l.conv!, l.line] as const))(
    "flags %s in conversation %i, a line an earlier block recorded as clean",
    (id, _conv, line) => {
      expect(checkTranscript(line).map((f) => f.id)).toContain(id);
    },
  );

  it("every ACC4 pattern fires on something (none is dead)", () => {
    const all = [...live.lines, ...live.renderings, ...live.reclassified];
    for (const claim of ACC4_CLAIMS) {
      expect(
        all.some((l) => claim.pattern.test(normalise(l.line))),
        `${claim.id} ${claim.pattern.source.slice(0, 50)}`,
      ).toBe(true);
    }
  });

  it.each(live.silent.map((l) => [l.lang, l.conv!, l.line] as const))(
    "flags nothing in a correct %s line from the same run (conversation %i)",
    (_lang, _conv, line) => {
      expect(checkTranscript(line)).toEqual([]);
    },
  );

  it.each(["es", "en"] as const)("flags nothing in the reworded %s facts, nor in the refusal sentence", (lang) => {
    for (const f of FACTS_BY_LOCALE[lang]) expect(checkTranscript(f.text), f.id).toEqual([]);
    expect(checkTranscript(serverCatalog[lang]["chat.outOfScope"])).toEqual([]);
  });

  it("ACC4's patterns stay silent on every earlier fixture's correct lines", () => {
    const corrected: string[] = json("h-asst-acc2/corrected-lines.json").lines;
    const a0c = readFileSync(new URL("h-asst-accuracy/a0-corrected.txt", FIXTURES), "utf8");
    const esCorrected: { line: string }[] = json("h2b-5/es-claim-lines.json").corrected;
    const acc3Silent: Line[] = json("h-asst-acc3/live-lines.json").silent;
    const reclassified = live.reclassified.map((r) => r.line);
    for (const text of [a0c, ...corrected, ...esCorrected.map((l) => l.line)]) expect(acc4Ids(text), text.slice(0, 60)).toEqual([]);
    for (const l of acc3Silent) {
      if (reclassified.some((r) => l.line.includes(r))) continue;
      expect(acc4Ids(l.line), l.line.slice(0, 60)).toEqual([]);
    }
  });

  it("the three over-refusals are recorded: each was the refusal sentence, given to a question about Voltura", () => {
    expect(live.refusals.map((r) => r.conv)).toEqual([106, 107, 110]);
    for (const r of live.refusals) expect(r.line).toBe(serverCatalog[r.lang]["chat.outOfScope"]);
  });
});
