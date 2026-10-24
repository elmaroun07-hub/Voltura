BLOCK / GATE
H-ASST-ACC5 / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `b4f7667` (main, live on both services)

TASKS CLAIMED CLOSED
- A5.1 law answer = one catalog sentence, quoted in both prompts
- A5.2 compute guideline scoped to the Assistant
- A5.3 checker C16, C17
- A5.4 OPEN — live, after merge

DIFF SUMMARY
`artifacts/api-server/src/i18n.ts` (1 entry × 2 languages), `chat/routes.ts` (two guidelines per language, `LAW_ANSWER`), `chat/transcript-checker.ts` (`ACC5_CLAIMS`), `chat/prompt-rule.test.ts` (the pinned law sentence), new `chat/h-asst-acc5.test.ts` (13 tests); this ruling and `contracts/blocks/h-asst-acc5.md`. Carries `contracts/evidence/h-asst-quota/` and the H-ASST-QUOTA ruling close-out (`f37e93e`).

TEST EVIDENCE
- Typecheck 0. Chat tests 304/304. API suite 631 passed / 5 failed / 636 (the container-local PDF euro-sign failures, green in CI).
- First Spanish wording used "cumple"; two standing guards rejected it (3 tests). Reworded with "se ajusta", the word the previous guideline used.
- Checker regression over the 28 live answers at `36457ba`: flags exactly [162].
- Mutations, each restored after: A1 EN law rule back to a paraphrase — KILLED; A2 ES law rule back to a paraphrase — KILLED; A3 EN compute guideline reverted — KILLED; A4 ES compute guideline reverted — KILLED; A5 round-5 patterns not consulted — KILLED; A6 C17 Spanish pattern dropped — KILLED. 6/6.
- Self-report: the first C16 pattern was written with a backspace character where `\b` belonged (a Python escaping slip); found by grep before any test run and fixed.

LIVE EVIDENCE
OPEN until merge.

ROLLBACK COMMAND
Pre-merge: demonstrated available — `main` unchanged at `b4f7667`, branch unmerged.

RESIDUE
- What this gate cannot prove: that the model never misstates a fact.

RULING
OPEN — pre-merge criteria met.
