BLOCK / GATE
H-ASST-QUOTA / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `c7f7117` (main, live on both services)

TASKS CLAIMED CLOSED
- Q.1 message limit 5 per client per 15 minutes
- Q.2 prompt shorter in both languages; every fact sentence and pinned rule unchanged
- Q.3 tests adjusted to the new limit
- Q.4 live accuracy re-test — L2 **FAIL** (2 misstatements, both Spanish), L2-S PASS (below)

DIFF SUMMARY
`artifacts/api-server/src/replit_integrations/chat/routes.ts`; tests `feature-map`, `prompt-rule`, `rate-limit-locale`, `h-d17-limits` (client address per request or the limit constant only); new `h-asst-quota.test.ts` (7 tests); this ruling and `contracts/blocks/h-asst-quota.md`.

TEST EVIDENCE
- Prompt: en 6,851 → **6,478** characters (−373, −5.4 %); es 7,796 → **7,383** (−413, −5.3 %).
- Typecheck: 0 errors. API suite: 616 passed / 5 failed / 621 — the 5 are the container-local PDF euro-sign failures (green in CI since H-D17).
- Before the test changes, the new limit failed 21 chat tests, all `expected 429 to be 200` — none from the prompt cut.
- Mutations, each restored after: Q1 ruled value back to 20 — KILLED; Q2 limiter ignores the constant (literal 20) — KILLED; Q3 EN Context paragraph restored — KILLED; Q4 ES repeated sentence restored — KILLED; Q5 a fact sentence dropped — KILLED. 5/5.

LIVE EVIDENCE
Merge `36457ba` (`--no-ff`, parents `c7f7117` + `15ed024`), pushed 23:06:07Z from the cloud session on the operator's ruling ("Merge and re-test"). CI on the branch `40036934254` green, api-server 621/621.
- **L1 PASS** — `/api/version` = `36457ba` at 23:07:26Z; web `build-sha` = `36457ba`.
- **Probe:** session `probe-quota-2026-10-23-36457ba`, conversations **156–183**, 23:08–23:25Z, all HTTP 200, no stream errors, ~30 s apart. Questions as H-ASST-ACC4 (L2: "What is Voltura?" ×8, feed-in, NPV, EU AI Act, per language; L2-S: three out-of-scope per language). Answers verbatim in `contracts/evidence/h-asst-quota/l2-probe-36457ba.json`, script `probe.py`. Every answer read against the 13 facts; the repo's `checkTranscript` also run on all 28: **0 flags** (it has no pattern for either slip below).
- **L2 FAIL — 2 misstatements of 22:**
  - **162 (es, "¿Qué es Voltura?")** — closing summary: "…sin realizar cálculos propios fuera de la Calculadora." Contradicts the `optimizer` fact (the Optimizer computes PV and battery by formula), which the same answer states correctly above. New in kind; ACC4 had no such slip. Likely source: the unchanged guideline "You compute nothing yourself: for figures, the user runs a calculation in the Calculator", written for the Assistant and here applied to Voltura. One run cannot show whether the prompt cut played a part.
  - **166 (es, "¿Voltura cumple la Ley de IA de la UE?")** — "No, Voltura no lo hace." Says Voltura does not comply; it makes no claim either way. The same slip as ACC4's 135 at `d2e162e`, before this block.
- **Improved on ACC4:** 177 (en, EU AI Act) answers "Voltura makes no such claim." — ACC4's 141 was an over-refusal. Over-refusals **0 of 6** (ACC4: 1 of 6). Feed-in and NPV answered "no" in both languages (164, 165, 175, 176).
- **L2-S PASS** — 178–180 (es) and 181–183 (en), each exactly the catalog refusal sentence.
- **Recorded, not counted** (as in ACC3/ACC4): English answers 167–172 and 174 end "Voltura (only) answers questions about these features" — it is the Assistant that does; Spanish answers 156, 158, 159, 161–163 give only one of Case 1's three NASA conditions ("si NASA no contesta") rather than copying the sentence word for word, with Case 1's and Case 2's outcomes correct; 159, 170 omit that the UK DESNZ cost is not used with a battery; 161 "Solo los 27 países de esa lista obtienen un resultado completo con ese factor" is true only with its last three words.

ROLLBACK COMMAND
`git revert -m 1 36457ba` — Tier B: computed on scratch ref `scratch/h-asst-quota-revert-proof` before the push, revert `e0e425b`, its tree == `c7f7117`'s tree, 8 files / +21 / −161 against the merge. Cloud clone only, unpushed. **Deploy path UNPROVEN** (A13 debt stands). A revert restores the 20-message limit and the longer prompt; it does not touch 166's slip, which predates the block.

RESIDUE
- The saving is small by construction: the fact list is most of the prompt and is cached by Groq; answers (median 2,048 characters) are most of each question's uncached tokens.
- The binding ceiling is Groq's 1,000 requests a day site-wide; at 5 per 15 minutes one address can still send ~480 a day.

RULING
**FAIL on L2** (2 of 22, both Spanish: 162 new, 166 carried from ACC4). L2-S PASS, over-refusals down to 0 of 6. Next step is the operator's (ruled beforehand: on a misstatement he decides fix or revert to `c7f7117`).
