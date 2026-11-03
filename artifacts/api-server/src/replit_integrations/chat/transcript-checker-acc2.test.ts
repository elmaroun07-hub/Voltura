import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkTranscript } from "./transcript-checker";

/**
 * H-ASST-ACC2 TF6: the checker learns E1-E3, P1 and P2.
 *
 * failing-lines.json holds the 22 failing assistant lines from H-ASST-ACC's
 * live conversations 46-53 and 57, copied verbatim. corrected-lines.json holds
 * a corrected rewrite of each of the 19 distinct ones. The checker still only
 * knows errors already seen (A-e): the live read stays the gate.
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/", import.meta.url);
const json = (p: string) => JSON.parse(readFileSync(new URL(p, FIXTURES), "utf8"));
const failing: { conversation: number; id: string; line: string }[] = json("h-asst-acc2/failing-lines.json").lines;
const corrected: string[] = json("h-asst-acc2/corrected-lines.json").lines;
const ids = (text: string) => checkTranscript(text).map((f) => f.id);

describe("H-ASST-ACC2 TF6 — the checker flags E1-E3, P1, P2", () => {
  it("the fixture is the 22 recorded lines: E1 x8, E2 x9, E3 x3, P1 x1, P2 x1", () => {
    const count: Record<string, number> = {};
    for (const l of failing) count[l.id] = (count[l.id] ?? 0) + 1; // G5-ok: a counter
    expect(count).toEqual({ E1: 8, E2: 9, E3: 3, P1: 1, P2: 1 });
  });

  it.each(failing.map((l) => [l.conversation, l.id, l.line] as const))(
    "conversation %i: flags %s",
    (_conv, id, line) => {
      expect(ids(line)).toContain(id);
    },
  );

  it("flags each of E1, E2, E3, P1 and P2 at least once", () => {
    const seen = new Set(failing.flatMap((l) => ids(l.line)));
    for (const id of ["E1", "E2", "E3", "P1", "P2"]) expect(seen.has(id), id).toBe(true);
  });

  it("flags nothing in the corrected rewrite of those lines", () => {
    expect(corrected).toHaveLength(19);
    expect(corrected.map((line) => [line.slice(0, 50), checkTranscript(line)]).filter(([, f]) => (f as unknown[]).length)).toEqual([]);
  });

  it("still flags everything in A0, and nothing new there", () => {
    const a0 = readFileSync(new URL("h-asst-accuracy/a0.txt", FIXTURES), "utf8");
    expect(ids(a0).sort()).toEqual(["C11", "C12", "C13", "C6", "C9"]);
  });
});
