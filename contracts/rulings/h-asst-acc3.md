# H-ASST-ACC3 — gate

**BLOCK / GATE:** H-ASST-ACC3 / pre-merge, then live
**DATE:** 8 October 2026 · **COMMIT (before):** `306c4ab` (`main`)
**BRANCH:** `heatshield/asst-accuracy-3`

## TASKS CLAIMED CLOSED (pre-merge)

- **A.1** `nasa` (es, en): the two NASA failures as Case 1 / Case 2 with opposite outcomes, and a
  closing sentence "Only Case 1 gives a latitude estimate; only Case 2 stops the calculation." No
  "unavailable", no "missing" (pinned).
- **A.2** `carbon` (es, en): the listed countries' factor is "not an official figure"; "Only the
  Spanish (REE) and UK (DESNZ) factors are official."
- **A.3** `assistant` fact and both prompts: only questions about what Voltura does; anything else
  gets exactly `chat.outOfScope` — en "I can't answer that. I only answer questions about what
  Voltura does." / es "No puedo responder a eso. Solo respondo preguntas sobre lo que hace
  Voltura." — quoted into the prompt from the server catalog. Removed: "expert advisor", "General
  solar and battery advice is fine", "Prefer concrete numbers and ranges", sizing reasoning of its
  own, "ask for [data] briefly", "Stay on energy topics". Added: "You compute nothing yourself".
- **A.4** both prompts: the NASA case sentences and the carbon sentences are copied word for word.
- **A.5** checker `ACC3_CLAIMS`: N1 (en, learnt 87–91, 94), N1 (es, learnt 72 + a rendering), N2
  (es, learnt 72), C14 (es, learnt 72, 73, 80), C14 (en, rendering). Fixture
  `contracts/fixtures/h-asst-acc3/live-lines.json`: 11 live lines, 2 renderings, 8 correct lines
  from the same run (incl. L3's 95 and 96 in full).
- **A.6** web catalog: the Assistant page's intro, subtitle, greeting and example question now
  invite questions about Voltura only (es, en); the old example "Is solar worth it in Seattle?" is
  one the Assistant now refuses.

## TEST EVIDENCE

Typecheck exit 0; check-i18n clean. `lib/i18n` 17 + `lib/cte` 72 + web **23** + api-server
**542** = **654 passed, 0 failed** (was 614).

**G9 — 12 of 12 killed:** M1 nasa EN reverted → 12 failed; M2 Spanish closing sentence dropped →
2; M3 "no es una cifra oficial" dropped → 1; M4 refusal sentence drifts from the catalog → 1; M5
scope rule dropped (en) → 1; M6 general-advice permission restored (es) → 1; M7 dead N1 (en) → 7;
M8 dead C14 (es) → 4; M9 N2 too broad → 17; M10 page example back to Seattle → 1; M11
word-for-word rule dropped (es) → 1; M12 "unavailable" written into the EN fact → 9.

## RESIDUE (pre-merge)

- The refusal is a prompt instruction, not code: nothing on the server checks the answer before
  it streams. Whether the model keeps to it is what L2-S measures.
- The Spanish is a first draft (no native review), as across H2b.
- The two rendering rows (N1 es, C14 en) were not seen live.

## RULING (pre-merge)

**OPEN — pre-merge criteria met.** Merge per the operator's standing instruction (7 Oct: merge with
git from the cloud session). The gate closes only on the live L2, L2-S and L3.
