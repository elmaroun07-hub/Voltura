# H-ASST-ACC4 — pre-merge

**BLOCK / GATE:** H-ASST-ACC4 / pre-merge
**DATE:** 9 October 2026
**COMMIT (before):** `221c018` (`main`, H-ASST-ACC3 merge, live)
**BRANCH:** `heatshield/asst-accuracy-4`

**Session open:** last ruling `h-asst-acc3.md` — post-merge **FAIL on L2** (on
`heatshield/asst-accuracy-3-live-evidence`, unmerged). Operator ruling re-sent 9 Oct 02:04:
reword again, add checks, retest; out-of-scope questions get "I can't answer". No ACC4 branch
existed on `origin` at that time.

## TASKS CLAIMED CLOSED

| # | Change |
|---|---|
| A.1 | `carbon` es/en: new sentence "The 27 countries in that list do get a full result, with that older factor." / "Los 27 países de esa lista sí obtienen un resultado completo, con ese factor más antiguo."; the refusal names whom it covers — "A country that is not Spain, the UK or one of those 27 countries has no factor…" / "Un país que no sea España, el Reino Unido ni uno de esos 27 países…". 27 is `LEGACY_CARBON_COUNTRIES.length`; pinned to the route, which refuses only `unknown_country` and `pending`. |
| A.2 | `history` es/en: "stored on Voltura's server, not in the browser" / "en el servidor de Voltura, no en el navegador". |
| A.3 | `optimizer` es/en: "The AI Optimizer's numbers come from that formula; a language model then writes the explanation text shown beside them, and cannot change the numbers." — the writer named apart from the Optimizer. |
| A.4 | Both prompts: "A question asking whether Voltura does, computes, shows, offers or claims something is always a question about what Voltura does: answer it, even when the answer is no. It never gets the out-of-scope answer below." — placed before the scope rule, which now begins "Any other question"; the law guideline adds "that question is about Voltura, so it never gets the out-of-scope answer"; the carbon copy rule covers "the whole carbon entry … the list of countries included". |
| A.5 | Checker `ACC4_CLAIMS`: C15 es (+ en rendering), C14 es (97/101's words; en rendering), E2 es (103; en rendering), E3 en ("it only shows/provides the explanation", 111/113/116), E3 es. Fixture `contracts/fixtures/h-asst-acc4/live-lines.json`, lines read back from production rows 97–116 on 9 Oct. |

**C15's guard.** The Spanish pattern does not fire when the same sentence has already named the
list (negative lookbehind on "lista"): the 2b.5 corrected C9 line ("… un factor antiguo sin
fuente para una lista de países; en cualquier otro país se rechaza …") is right in context.

**Self-reported: answer 95 reclassified.** H-ASST-ACC2's L3 answer 95 (es), recorded clean on
8 Oct and kept as a `silent` line by ACC3, says "El optimizador solo muestra la explicación de
esos valores; no permite modificarlos." — the E3 wording ACC3 counted in English (111). The new
Spanish E3 pattern flags it. ACC3's silent test now skips exactly that one line, and ACC4's test
asserts it is flagged.

## DIFF / TESTS

`221c018..726d437`; suite **685 green** (`lib/i18n` 17, `lib/cte` 72, web 23, api-server 573;
was 654 at `221c018`), typecheck exit 0, check-i18n clean.

**G9 — 12 of 12 killed:** M1 en listed-countries sentence dropped → 7 failed; M2 es back to
"Cualquier otro país" → 6; M3 es "no en el navegador" dropped → 1; M4 en back to "The AI writes
only" → 6; M5 en in-scope rule removed → 1; M6 es carbon copy rule back to "official sentences"
→ 1; M7 es law line loses its in-scope clause → 1; M8 C15 es pattern dead → 5; M9 C15 lookbehind
removed → 2; M10 E2 es dead → 2; M11 E3 en "only shows" dropped → 1; M12 ACC4 claims not run → 15.

## ROLLBACK

Pre-merge: available — `main` unchanged at `221c018`. After the merge: `git revert -m 1
<merge>`, proved on a scratch ref (Tier B). **Deploy-path rollback UNPROVEN** (A13's debt).

## RESIDUE

- Out of fence, unchanged: every other fact, the out-of-scope sentence, the Optimizer prompt,
  model, temperature, limiter, Groq tier (8,000 TPM).
- Recorded in ACC3, not counted, not fixed: "Voltura answers only questions about these
  features" (it is the Assistant that does); 105 omits Spain's Eurostat default.
- L2-S and L3 of ACC3 were never run (bridge dropped); ACC4's live run covers both.

## RULING

**OPEN — pre-merge criteria met.** Merge per the operator's standing instruction (git, from the
cloud session), then L1, L2 (22), L2-S (6), L3 (2).

# Post-merge — live (9 October 2026)

**MERGE:** `d2e162e` = `git merge --no-ff heatshield/asst-accuracy-4` (`c1793ac`) onto `221c018`,
pushed 02:17:10Z from the cloud session (operator's standing instruction, 7 Oct). Commits authored
`elmaroun07-hub@users.noreply.github.com`.

**CI on `main`:** run `37873846469` on `d2e162e`: success.

**Probe session:** `probe-acc4-2026-10-09-d2e162e`, run from the operator's built-in browser pane
(the cloud container cannot reach `onrender.com`). Each answer was run through the repo's
`checkTranscript`, bundled and injected into the page. The bundle's 41 patterns hash to
`27ef8d1d…f530744d` (sha256 of `id:source/flags` joined by newlines), the same as the repo at
`d2e162e`. Calls ~32 s apart (Groq 8,000 TPM), at most 20 per limiter window.

## LIVE EVIDENCE

| | Check | Result |
|---|---|---|
| **L1** | Both services serve the merge | Render: API `dep-db44ta6q1p3s739mbeig` live 02:18:10Z, web `dep-db44taeq1p3s739mbeo0` live 02:17:45Z. `/api/version` and web `build-sha` = `d2e162e`. **PASS** |
| **L2** | 11 questions per language, zero misstatements of the 13 facts, checker passes | **FAIL** (1 wrong claim, 1 over-refusal, both on the EU AI Act question; table below) |
| **L2-S** | 3 out-of-scope questions per language → exactly the refusal sentence | **PASS**: 136–138 (es), 142–144 (en), all exactly the sentence |
| **L3** | One exchange on screen per language | **PASS**: 153 (es), 154 (en), operator's own browser session, read in full |

### L2: 22 of 22 answers read (02:20–02:40Z, all HTTP 200)

**What ACC4 fixed:**
- **C15:** none of the 16 "What is Voltura?" answers drops the 27 listed countries. All 8
  Spanish ones name the list or "Los 27 países de esa lista" before the refusal.
- **C14:** no answer calls every location's factor official.
- **E2:** no answer puts the history in the browser.
- **E3:** no answer says the Optimizer only provides or shows the explanation.
- **Scope:** NPV (134, 140) and feed-in (133, 139) are answered with "no", not refused.

**What failed:**

| Conv | Lang | Question | Verbatim | Slip |
|---|---|---|---|---|
| 135 | es | ¿Voltura cumple la Ley de IA de la UE? | "Voltura no cumple la Ley de IA de la UE." | **Wrong claim.** Voltura makes no claim either way; the prompt requires "Voltura no hace tal afirmación". The checker has no pattern for it (not flagged) |
| 141 | en | Is Voltura EU AI Act compliant? | "I can't answer that. I only answer questions about what Voltura does." | **Over-refusal.** A question about Voltura; the prompt requires "Voltura makes no such claim" |

Answered correctly:
- 126–129, 131, 132 (es WiV).
- 133 (es, feed-in): "No, Voltura no calcula tarifas de inyección a la red."
- 134 (es, NPV): "Voltura no calcula el valor actual neto. …"
- 139 (en, feed-in): "Voltura does not calculate feed‑in tariffs."
- 140 (en, NPV): "Voltura does not provide a net present value calculation. …"
- 145–152 (en WiV). Checker clean on all 8.

**Checker residue: C15 false positives.** The checker flagged 125 and 130, both correct in
context, because the guard looks back for the word "lista"/"list" within the same sentence:
- **125:** "…y un factor más antiguo para 27 países específicos (Alemania, … y Turquía); en
  cualquier otro país el cálculo se rechaza." The list is named without the word "lista".
- **130:** "Los 27 países de esa lista sí obtienen un resultado completo con ese factor. Cualquier
  otro país no tiene factor y el cálculo se rechaza." The period ends the lookbehind.

L3's 153 is flagged the same way: the "Los 27 países de esa lista…" bullet sits on the line
before. Counted as checker error, not as slips.

**Recorded, not counted:** 125, 127 and 131 say the Optimizer's explanation text "no puede
modificarse". The fact says the language model cannot change the *numbers*. The sentence says
nothing false about the numbers. The ACC3 residue ("Voltura answers only questions…", 105's
Eurostat default) did not recur.

**Tally.**
- Fact misstatements: **1 of 22** (135).
- Over-refusals: **1 of 6** "does Voltura do X" questions (141); it was 3 of 6 in ACC3.
- Both failures are the same question, the EU AI Act.
- Checker: 2 false flags of 22, 0 true flags; 135's wrong claim is outside its patterns.

**Cause, as far as the run shows:** the law guideline is the only in-scope answer the prompt gives
as a sentence to adapt rather than a fact to copy. In Spanish the model turned "makes no such
claim" into "no cumple" (does not comply); in English it still let the scope rule win.

## L3

- **153 (es), "¿Qué es Voltura?":** all 12 items consistent with the facts; carbon entry copied
  with the 27 countries; history "en el servidor; el navegador solo conserva un identificador
  aleatorio". Omits detail (UK no default tariff, the 10 kW cap, the explanation writer), with no
  false claim.
- **154 (en), "What is Voltura?":** all facts consistent; carbon entry copied whole; Optimizer:
  "The numbers are fixed by the formula; a language model only writes the explanatory text."
  Checker clean.

## ROLLBACK — Tier B

Revert computed on scratch ref `scratch/acc4-revert-proof` as `5b23ef6` (cloud clone only,
unpushed). `git revert -m 1 d2e162e` applies cleanly: 13 files +30 / −520, the exact mirror of
the merge's 13 files +520 / −30. The reverted tree is **identical** to `221c018`'s.
**The deploy-path rollback is UNPROVEN.** A13's standing debt is carried unchanged, not
discharged: no deploy-path rollback has been executed on any block.

**Probe residue:** production conversation rows **125–152** (session
`probe-acc4-2026-10-09-d2e162e`) and **153–154** (the operator's browser session). Not deleted:
G3's ban on DML stands.

## RULING — post-merge

**Gate H-ASST-ACC4: FAIL on L2**, on one question in both languages (the EU AI Act):
- 135 (es) makes a wrong claim.
- 141 (en) over-refuses.

Everything else passed. Carbon, history, Optimizer and scope slips from ACC3 did not recur.
L2-S and L3 pass. The checker's C15 guard needs a wider look-back (2 false flags + L3).
What to do next is the operator's ruling (§14.2).
