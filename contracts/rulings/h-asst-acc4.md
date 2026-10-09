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
