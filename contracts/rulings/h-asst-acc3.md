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

---

# Post-merge — live (8 October 2026)

**MERGE:** `221c018` = `git merge --no-ff heatshield/asst-accuracy-3` (`2208adb`) onto `306c4ab`,
pushed 00:30:20Z from the cloud session (operator's standing instruction, 7 Oct). Commits authored
`elmaroun07-hub@users.noreply.github.com`.

**CI on `main`:** run `37708117074` on `221c018` — success.

**Probe session:** `probe-acc3-2026-10-08-221c018`, run from the operator's built-in browser pane
(the cloud container cannot reach `onrender.com`). Each answer was run through the repo's
`checkTranscript`, bundled and injected into the page; the bundle's pattern sources hash to
`a78b892c…a7819b9e`, the same as the repo at `221c018`. Calls 27 s apart (Groq 8,000 TPM), 20 per
limiter window.

## LIVE EVIDENCE

| | Check | Result |
|---|---|---|
| **L1** | Both services serve the merge | Render: API `dep-db3e87nf3r2c73frlapg`, web `dep-db3e87nf3r2c73frlav0`, live 00:31:11Z. `/api/version` and web `build-sha` = `221c018`. **PASS** |
| **L2** | 11 questions per language, zero misstatements of the 13 facts, checker passes | **FAIL** — table below |
| **L2-S** | 3 out-of-scope questions per language → exactly the refusal sentence | *pending — the operator's computer dropped off the bridge at 00:50Z mid-run* |
| **L3** | One exchange on screen per language | *pending — same* |

### L2 — 20 of 22 answers read (00:33–00:42Z, all HTTP 200)

**What A.1 fixed:** the `nasa` fact. All 14 "What is Voltura?" answers state Case 1 and Case 2
correctly — 11 copy them word for word; 102 (es) and 104 (es) paraphrase without error. N1, N2
and E1 did not recur.

**What failed:**

| Conv | Lang | Question | Verbatim | Slip |
|---|---|---|---|---|
| 97 | es | ¿Qué es Voltura? | "con el factor de carbono oficial de la red según la ubicación (España: factor oficial de REE; Reino Unido: factor oficial de DESNZ)" | **C14, implicit** — every location's factor called official; the 27 listed countries' factor is not |
| 98 | es | ¿Qué es Voltura? | "En cualquier otro país el cálculo se rechaza." | **C15 (new)** — the 27 listed countries are dropped; France, Morocco, Germany… do get a result |
| 100 | es | ¿Qué es Voltura? | "En cualquier otro país el cálculo se rechaza." | C15 |
| 101 | es | ¿Qué es Voltura? | "(solo España y Reino Unido disponen de factor oficial; para otros países el cálculo se rechaza)" | C15 |
| 102 | es | ¿Qué es Voltura? | "estimación de CO₂ evitado con el factor oficial de la red (España: factor REE; Reino Unido: factor DESNZ). En cualquier otro país el cálculo se rechaza." | C15 |
| 103 | es | ¿Qué es Voltura? | "En cualquier otro país el cálculo se rechaza." | C15 |
| 103 | es | ¿Qué es Voltura? | "el historial es local al navegador y se pierde al borrar los datos del sitio" | **E2** — the history is on Voltura's server |
| 104 | es | ¿Qué es Voltura? | "Para cualquier otro país no hay factor y el cálculo se rechaza." | C15 |
| 113 | en | What is Voltura? | "Offers an AI Optimizer that returns … as numbers …; it only provides the explanation shown with those numbers." | **E3 — checker flagged.** "It" is the Optimizer, which the same sentence says returns the numbers; the fact says the *AI* writes only the explanation |
| 116 | en | What is Voltura? | "It only provides the explanation shown with those numbers and cannot change them." | E3 — checker flagged |
| 111 | en | What is Voltura? | "it only shows the explanation with those numbers" | E3 wording — **not** flagged (the pattern knows "only provides", not "only shows") |
| 106 | es | ¿Da el valor actual neto? | "No puedo responder a eso. Solo respondo preguntas sobre lo que hace Voltura." | **Over-refusal** — a question about Voltura; A.3 requires "Voltura no lo hace" |
| 107 | es | ¿Voltura cumple la Ley de IA de la UE? | the refusal sentence | Over-refusal — the prompt requires "Voltura no hace tal afirmación" |
| 110 | en | Is Voltura EU AI Act compliant? | the refusal sentence | Over-refusal — the prompt requires "Voltura makes no such claim" |

Answered correctly: 99 (es), 105 (es, feed-in), 108 (en, feed-in: "Voltura does not calculate
feed‑in tariffs."), 109 (en, NPV: "Voltura does not provide net present value."), 112, 114, 115
(en). 112, 113, 114 and 115 end "Voltura answers only questions about these features" — it is the
Assistant that does, not Voltura. Recorded, not counted.
99 (es), 111 and 116 (en: "For many other countries no factor is available and the calculation
is refused") leave the listed countries out without a false claim about them; recorded, not
counted. 105's "usando la tarifa que usted indique" leaves out Spain's Eurostat default;
recorded, not counted.

**Tally.** Spanish WiV: **7 of 8** misstate a fact (97, 98, 100–104), all on carbon, one also on
history. English WiV: **3 of 6** carry the E3 wording, 2 flagged. Over-refusal on **3 of 6**
"does Voltura do X" questions. The checker passed 18 of 20 answers; it flagged only the two E3
lines, and has no pattern for C15.

**Cause, as far as the run shows:** A.2 added "Only the Spanish (REE) and UK (DESNZ) factors are
official." and the word-for-word rule; the Spanish answers copied the official sentences and then
**dropped the list sentence** between them, so the closing "Any other country has no factor…"
lost its "other". The English answers mostly kept "All other listed countries use an older,
unsourced factor". The scope rule's "any question that is not about what Voltura does" was
applied to two questions the prompt answers elsewhere (NPV, EU AI Act).

## ROLLBACK — Tier B

Revert computed on scratch ref `scratch/acc3-revert-proof` as `9a33bb9` (cloud clone only,
unpushed): `git revert -m 1 221c018` applies cleanly, 15 files +53 / −539, the exact mirror of
the merge's 15 files +539 / −53; the reverted tree is **identical** to `306c4ab`'s.
**The deploy-path rollback is UNPROVEN.** A13's standing debt is carried unchanged, not
discharged: no deploy-path rollback has been executed on any block.

**Probe residue:** production conversation rows **97–116** (and those the pending rows create),
session `probe-acc3-2026-10-08-221c018`. Not deleted — G3's ban on DML stands.

## RULING — post-merge

**Gate H-ASST-ACC3 — FAIL on L2.** The `nasa` slip is gone; the carbon fact is now misstated a
new way in Spanish (C15), E3's wording recurs in English, and the scope rule refuses three
questions it must answer. L2-S and L3 are recorded when the operator's computer is back.
What to do next is the operator's ruling (§14.2).
