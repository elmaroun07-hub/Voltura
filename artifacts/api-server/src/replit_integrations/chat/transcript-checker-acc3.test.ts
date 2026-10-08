import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ACC3_CLAIMS, checkTranscript, normalise } from "./transcript-checker";
import { FACTS_BY_LOCALE } from "./facts";
import { serverCatalog } from "../../i18n";

/**
 * H-ASST-ACC3 A.5: the checker knows the slips H-ASST-ACC2's L2 found live,
 * 7-8 Oct 2026. Each pattern fires on the line it was learnt from, and stays
 * silent on the correct statements the same run produced, on the reworded
 * facts, on the refusal sentence and on every fixture the earlier blocks
 * recorded.
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/", import.meta.url);
const json = (p: string) => JSON.parse(readFileSync(new URL(p, FIXTURES), "utf8"));
type Line = { id?: string; lang: "es" | "en"; conv?: number; line: string };
const live: { lines: Line[]; renderings: Line[]; silent: Line[] } = json("h-asst-acc3/live-lines.json");

const acc3Ids = (text: string) =>
  [...new Set(ACC3_CLAIMS.filter(({ pattern }) => pattern.test(normalise(text))).map((c) => c.id))];

describe("H-ASST-ACC3 — the checker knows tonight's slips", () => {
  it("the fixture records 11 live lines from 9 conversations, and both languages", () => {
    expect(live.lines).toHaveLength(11);
    expect(new Set(live.lines.map((l) => l.conv))).toEqual(new Set([72, 73, 80, 87, 88, 89, 90, 91, 94]));
    expect(new Set(live.lines.map((l) => l.lang))).toEqual(new Set(["es", "en"]));
  });

  it.each(live.lines.map((l) => [l.id!, l.lang, l.conv!, l.line] as const))(
    "flags %s (%s, conversation %i) in the line it was learnt from",
    (id, _lang, _conv, line) => {
      expect(checkTranscript(line).map((f) => f.id)).toContain(id);
    },
  );

  it.each(live.renderings.map((l) => [l.id!, l.lang, l.line] as const))(
    "flags %s in its %s rendering",
    (id, _lang, line) => {
      expect(checkTranscript(line).map((f) => f.id)).toContain(id);
    },
  );

  it("every ACC3 pattern fires on something (none is dead)", () => {
    const all = [...live.lines, ...live.renderings];
    for (const claim of ACC3_CLAIMS) {
      expect(
        all.some((l) => claim.pattern.test(normalise(l.line))),
        `${claim.id} ${claim.pattern.source.slice(0, 40)}`,
      ).toBe(true);
    }
  });

  it.each(live.silent.map((l) => [l.lang, l.conv!, l.line] as const))(
    "flags nothing in a correct %s line from the same run (conversation %i)",
    (_lang, _conv, line) => {
      expect(checkTranscript(line)).toEqual([]);
    },
  );

  it.each(["es", "en"] as const)("flags nothing in the reworded %s facts or the refusal sentence", (lang) => {
    for (const f of FACTS_BY_LOCALE[lang]) expect(checkTranscript(f.text), f.id).toEqual([]);
    expect(checkTranscript(serverCatalog[lang]["chat.outOfScope"])).toEqual([]);
  });

  it("the ACC3 patterns stay silent on every earlier fixture", () => {
    const a0 = readFileSync(new URL("h-asst-accuracy/a0.txt", FIXTURES), "utf8");
    const a0c = readFileSync(new URL("h-asst-accuracy/a0-corrected.txt", FIXTURES), "utf8");
    const failing: { line: string }[] = json("h-asst-acc2/failing-lines.json").lines;
    const corrected: string[] = json("h-asst-acc2/corrected-lines.json").lines;
    const es: { lines: { line: string }[]; corrected: { line: string }[] } = json("h2b-5/es-claim-lines.json");
    for (const text of [a0, a0c, ...failing.map((l) => l.line), ...corrected, ...es.lines.map((l) => l.line), ...es.corrected.map((l) => l.line)]) {
      expect(acc3Ids(text), text.slice(0, 80)).toEqual([]);
    }
  });
});
