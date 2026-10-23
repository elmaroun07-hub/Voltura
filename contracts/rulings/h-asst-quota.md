BLOCK / GATE
H-ASST-QUOTA / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `c7f7117` (main, live on both services)

TASKS CLAIMED CLOSED
- Q.1 message limit 5 per client per 15 minutes
- Q.2 prompt shorter in both languages; every fact sentence and pinned rule unchanged
- Q.3 tests adjusted to the new limit
- Q.4 OPEN — live accuracy re-test, after merge

DIFF SUMMARY
`artifacts/api-server/src/replit_integrations/chat/routes.ts`; tests `feature-map`, `prompt-rule`, `rate-limit-locale`, `h-d17-limits` (client address per request or the limit constant only); new `h-asst-quota.test.ts` (7 tests); this ruling and `contracts/blocks/h-asst-quota.md`.

TEST EVIDENCE
- Prompt: en 6,851 → **6,478** characters (−373, −5.4 %); es 7,796 → **7,383** (−413, −5.3 %).
- Typecheck: 0 errors. API suite: 616 passed / 5 failed / 621 — the 5 are the container-local PDF euro-sign failures (green in CI since H-D17).
- Before the test changes, the new limit failed 21 chat tests, all `expected 429 to be 200` — none from the prompt cut.
- Mutations, each restored after: Q1 ruled value back to 20 — KILLED; Q2 limiter ignores the constant (literal 20) — KILLED; Q3 EN Context paragraph restored — KILLED; Q4 ES repeated sentence restored — KILLED; Q5 a fact sentence dropped — KILLED. 5/5.

LIVE EVIDENCE
OPEN until merge. L1: `/api/version` = merge sha. L2/L2-S as the block states.

ROLLBACK COMMAND
Pre-merge: demonstrated available — `main` unchanged at `c7f7117`, branch unmerged.

RESIDUE
- The saving is small by construction: the fact list is most of the prompt and is cached by Groq; answers (median 2,048 characters) are most of each question's uncached tokens.
- The binding ceiling is Groq's 1,000 requests a day site-wide; at 5 per 15 minutes one address can still send ~480 a day.

RULING
OPEN — pre-merge criteria met; merge is the operator's ruling (§14.2).
