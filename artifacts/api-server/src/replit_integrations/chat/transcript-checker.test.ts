import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { checkTranscript, KNOWN_FALSE_CLAIMS } from "./transcript-checker";

/**
 * H-ASST-ACC TF3: the checker flags every known false claim in A0, and nothing
 * in a corrected rewrite of it.
 *
 * A0 is the operator's live answer of 5 Oct 2026, copied byte-for-byte from the
 * block file's Appendix A0 into contracts/fixtures (`-text`, so no line-ending
 * filter touches it) and hash-pinned here. The K samples are verbatim lines
 * from H-ASST-D16-N3's recorded transcripts (conversations 36-38).
 */

const FIXTURES = new URL("../../../../../contracts/fixtures/h-asst-accuracy/", import.meta.url);
const bytes = (name: string) => readFileSync(new URL(name, FIXTURES));

const A0 = bytes("a0.txt");
const ids = (text: string) => checkTranscript(text).map((f) => f.id).sort();

describe("H-ASST-ACC TF3 — the transcript checker", () => {
  it("A0 is the operator's answer, unedited", () => {
    expect(A0.length).toBe(1834);
    expect(createHash("sha256").update(A0).digest("hex")).toBe(
      "6d3aa0ea26eaf18b9d19879954d846bfb99b20d271175b176c6e8abad7cec0ee",
    );
  });

  it("flags every claim in A0 that A.1 classed FALSE (C9, C11, C13), and its PARTIALs (C6, C12)", () => {
    expect(ids(A0.toString("utf8"))).toEqual(["C11", "C12", "C13", "C6", "C9"]);
  });

  it("flags nothing in the corrected rewrite of A0", () => {
    expect(checkTranscript(bytes("a0-corrected.txt").toString("utf8"))).toEqual([]);
  });

  it.each([
    ["K1", "* **Solar resource data** – it pulls hourly‑averaged solar irradiance and temperature for that point from NASA POWER (or, if NASA is unavailable, a latitude‑based estimate).  "],
    ["K2", "* Estimates CO₂ avoided using location‑specific grid carbon factors (official figures for Spain and the UK; otherwise a generic statement).  "],
    ["K3", "* Shows you the annual kWh saved, a month‑by‑month breakdown of direct solar use, battery‑supplied energy, grid imports and “surplus not used,” plus a pie chart of the overall energy mix.  "],
    ["C10", "* Values the savings using your electricity tariff (or a national default for Spain/UK); otherwise it just shows the energy saved.  "],
  ])("flags %s in the live line it came from", (id, line) => {
    expect(ids(line)).toContain(id);
  });

  it("every pattern is exercised by a sample above (none is dead)", () => {
    const covered = new Set([...ids(A0.toString("utf8")), "K1", "K2", "K3", "C10"]);
    expect(KNOWN_FALSE_CLAIMS.map((c) => c.id).filter((id) => !covered.has(id))).toEqual([]);
  });
});
