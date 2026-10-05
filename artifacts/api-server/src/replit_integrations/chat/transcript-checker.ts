/**
 * H-ASST-ACC TF3: flags claims about Voltura that are known to be false.
 *
 * A test utility, imported by no route. Every pattern is one row of A.1's claim
 * table (contracts/evidence/h-asst-accuracy/a1-claims.md): the FALSE claims, the
 * three slips from H-ASST-D16-N3's live transcripts (K1-K3), and the PARTIALs,
 * which the operator ruled count as misstatements too (5 Oct 2026).
 *
 * It only knows the errors already seen, so it never closes a gate on its own
 * (A-e): the live transcripts are read claim by claim as well.
 */

export interface KnownFalseClaim {
  id: string;
  /** What the code actually does, for the report. */
  truth: string;
  pattern: RegExp;
}

export const KNOWN_FALSE_CLAIMS: KnownFalseClaim[] = [
  {
    id: "C9",
    truth: "outside Spain, the UK and the legacy table the whole calculation is refused; nothing notes 'no figure' beside a result",
    pattern: /\b(elsewhere|otherwise|other countries|everywhere else)\b[^.;*]{0,60}\b(notes?|states?|shows?|gives?|gets?|get)\b[^.;*]{0,30}\b(no figure|no factor)\b/,
  },
  {
    id: "K2",
    truth: "other countries get a legacy unsourced factor, or the calculation is refused - never 'a generic statement'",
    pattern: /\bgeneric statement\b/,
  },
  {
    id: "C11",
    truth: "Spain has no sourced installation cost; only the UK does",
    pattern: /\b(sourced|official|national)\b[^.;*]{0,40}\bcosts?\b[^.;*]{0,30}\bspain\b/,
  },
  {
    id: "C13",
    truth: "the Optimizer uses a fixed standard daily profile, never the user's own load pattern",
    pattern: /(\b(your|the user'?s) (own )?(daily )?(load|usage) (pattern|profile)\b|(?<!(standard|fixed) )\bdaily load pattern\b)/,
  },
  {
    id: "K1",
    truth: "NASA POWER data is a 2019-2023 monthly mean, not hourly",
    pattern: /\bhourly[- ]averaged\b|\bhourly (solar )?(irradiance|radiation) data\b/,
  },
  {
    id: "K3",
    truth: "the monthly chart has no battery series; battery energy is only in the annual mix",
    pattern: /\bmonth[^.;*]{0,60}\bbattery[- ](supplied|delivered|discharged?)\b/,
  },
  {
    id: "C6",
    truth: "round-trip efficiency is the user's input, 50-100%, 90% only by default",
    pattern: /(≈|~|about |around |roughly )\s*90\s*%\s*round[- ]trip|\bround[- ]trip\b[^.;*]{0,20}(≈|~)\s*90\s*%/,
  },
  {
    id: "C10",
    truth: "the UK has no sourced national tariff; only Spain does",
    pattern: /\b(national|sourced)\b[^.;*]{0,20}\b(tariff|default)\b[^.;*]{0,30}\b(spain\s*(\/|and|or)\s*(the )?uk|for (the )?uk)\b/,
  },
  {
    id: "C12",
    truth: "the PDF holds the inputs, the result rows and the monthly table - no charts",
    pattern: /\bpdf\b[^.;*]{0,40}\bwhole calculation\b/,
  },
];

/**
 * Models write non-breaking hyphens, narrow and no-break spaces and curly
 * quotes (A0 has all four). Fold them so a pattern written with ASCII matches.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

export function checkTranscript(text: string): { id: string; match: string }[] {
  const t = normalise(text);
  return KNOWN_FALSE_CLAIMS.flatMap(({ id, pattern }) => {
    const m = pattern.exec(t);
    return m ? [{ id, match: m[0] }] : [];
  });
}
