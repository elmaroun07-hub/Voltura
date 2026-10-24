BLOCK / GATE
H-ASST-ACC5 / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `b4f7667` (main, live on both services)

TASKS CLAIMED CLOSED
- A5.1 law answer = one catalog sentence, quoted in both prompts
- A5.2 compute guideline scoped to the Assistant
- A5.3 checker C16, C17
- A5.4 live — **L2 PASS, L2-S PASS** (below)

DIFF SUMMARY
`artifacts/api-server/src/i18n.ts` (1 entry × 2 languages), `chat/routes.ts` (two guidelines per language, `LAW_ANSWER`), `chat/transcript-checker.ts` (`ACC5_CLAIMS`), `chat/prompt-rule.test.ts` (the pinned law sentence), new `chat/h-asst-acc5.test.ts` (13 tests); this ruling and `contracts/blocks/h-asst-acc5.md`. Carries `contracts/evidence/h-asst-quota/` and the H-ASST-QUOTA ruling close-out (`f37e93e`).

TEST EVIDENCE
- Typecheck 0. Chat tests 304/304. API suite 631 passed / 5 failed / 636 (the container-local PDF euro-sign failures, green in CI).
- First Spanish wording used "cumple"; two standing guards rejected it (3 tests). Reworded with "se ajusta", the word the previous guideline used.
- Checker regression over the 28 live answers at `36457ba`: flags exactly [162].
- Mutations, each restored after: A1 EN law rule back to a paraphrase — KILLED; A2 ES law rule back to a paraphrase — KILLED; A3 EN compute guideline reverted — KILLED; A4 ES compute guideline reverted — KILLED; A5 round-5 patterns not consulted — KILLED; A6 C17 Spanish pattern dropped — KILLED. 6/6.
- Self-report: the first C16 pattern was written with a backspace character where `\b` belonged (a Python escaping slip); found by grep before any test run and fixed.

LIVE EVIDENCE
Merge `9b6d5c1` (`--no-ff`, parents `b4f7667` + `ced341c`), pushed 01:41:12Z from the cloud session on the operator's ruling ("Merge and test now", 24 Oct ~01:45 local). CI on the branch `40050353160` green. Render re-read before push: autoDeploy yes, trigger commit, branch main.
- **L1 PASS** — `/api/version` = `9b6d5c1` at 01:42:19Z.
- **Probe:** session `probe-acc5-2026-10-24-9b6d5c1`, conversations **184–211**, all HTTP 200, no stream errors, ~30 s apart, the H-ASST-ACC4 question set. Answers verbatim in `contracts/evidence/h-asst-acc5/l2-probe-9b6d5c1.json`, script `probe.py`. Every answer read against the 13 facts.
- **L2 PASS — 0 misstatements of 22.**
  - The law question, both languages, answers **the catalog sentence character for character**: 194 (es) "Voltura no hace ninguna afirmación sobre si se ajusta o no a alguna ley, reglamento o norma."; 205 (en) "Voltura makes no claim about whether it meets any law, regulation or standard." H-ASST-QUOTA's 166 slip and ACC4's 135/141 do not recur.
  - No "What is Voltura?" answer (184–191 es, 195–202 en) denies that Voltura computes outside the Calculator; 162's slip does not recur. Optimizer described as computing PV and battery by formula in all 16.
  - Feed-in and NPV answered "no" in both languages (192, 193, 203, 204). Over-refusals **0 of 6**.
- **L2-S PASS** — 206–208 (es), 209–211 (en): each exactly the catalog refusal sentence.
- **Checker** (`checkTranscript` with ACC5 patterns) over all 28: one flag, **190 C15 — a false positive** of the kind ACC4 recorded: 190 names the 27 countries in the sentence before "Cualquier otro país no tiene factor y el cálculo se rechaza", and the guard looks back only within the sentence. 27 answers clean.
- **Recorded, not counted** (as in earlier rounds): 190 (es) and 196–199, 202 (en) end "Voltura (only) answers questions about…" — it is the Assistant; 191 (es) and 201 (en) omit that the UK DESNZ cost is PV-only and not used with a battery; 184, 187, 189, 191 omit NASA's failure cases (omission, not misstatement); 195 adds the law sentence unasked (true).

ROLLBACK COMMAND
`git revert -m 1 9b6d5c1` — Tier B: computed on scratch ref `scratch/h-asst-acc5-revert-proof` before the push, revert `d1c2c99`, its tree == `b4f7667`'s tree, 10 files / +13 / −566 against the merge (the block plus the H-ASST-QUOTA evidence it carried). Cloud clone only, unpushed. **Deploy path UNPROVEN** (A13 debt stands).

RESIDUE
- What this gate cannot prove: that the model never misstates a fact. One run of 22 is a sample, not a guarantee.
- The checker's C15 guard still flags a correct answer when the 27-country list sits in the previous sentence (190 here; 125, 130, 153 in ACC4).

RULING
**CLOSED (self-ruled under §14.2)** — 24 Oct 2026, `9b6d5c1`. L1, L2 (0 of 22), L2-S (6 of 6) pass. With H-ASST-ACC5 closed, H-ASST-QUOTA's L2 failure (162, 166) is answered by the fix the operator chose.
