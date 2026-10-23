BLOCK / GATE
H-D17B / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · branch base `0672150` (H-D17 live evidence) on `main` = `565a282`, live on both services

TASKS CLAIMED CLOSED
- B.1 per-client limit, 30/min, every `/api/screening` route, ES and EN refusal
- B.2 at most 2 screening queries in flight, from anyone
- B.3 queue of 20, then 503 `screening_busy` with `Retry-After: 10`, ES and EN
- B.4 municipality list and summary cached 5 min; concurrent misses share one query; failures not cached
- B.5 OPEN — live, after merge

DIFF SUMMARY
`artifacts/api-server/src/routes/screening.ts` (guards), `artifacts/api-server/src/i18n.ts` (2 entries × 2 languages), new `artifacts/api-server/src/routes/h-d17b-screening.test.ts` (7 tests), this ruling and `contracts/blocks/h-d17b.md`.

TEST EVIDENCE
- Typecheck: 0 errors, all packages.
- API suite: 609 passed / 5 failed / 614. The 5 are the container-local PDF euro-sign failures recorded in H-D17 (green in CI run `40024834278`).
- API build done; `screening_busy` present in `dist/index.mjs`.
- Mutations, each restored after: B1 limiter removed — KILLED; B2 limiter on default key — KILLED; B3 concurrency 10 — KILLED; B4 buildings bypass the gate — KILLED; B5 queue check removed — KILLED; B6 summary not cached — KILLED; B7 failures kept in cache — KILLED; B8 cache never expires — KILLED; B9 municipalities not cached — KILLED; B10 cache stores result, not promise (no shared query) — KILLED. 10/10.

LIVE EVIDENCE
Before (23 Oct 2026, `565a282`): `/summary` 2.668 s, `/buildings?limit=500&offset=0` 1.769 s, `offset=30000` 3.536 s, `/api/history` 0.486 s; no limit header on screening routes other than export.
After: OPEN until merge. Criteria, holding one connection (the cloud egress address rotates per request): screening responses carry `RateLimit: limit=30`, counting down per client; a second `/summary` returns far faster than the first.

ROLLBACK COMMAND
Pre-merge: demonstrated available — `main` unchanged at `565a282`, branch unmerged. After merge: `git revert -m 1 <merge>` (Tier B on a scratch ref before push; deploy path UNPROVEN).

RESIDUE
- After an `h3-load`, the previous summary can show for up to 5 minutes (cache window).
- The Assistant and Optimizer share Groq's free-tier quota; a few clients can exhaust it. Not addressable in code alone.

RULING
OPEN — pre-merge criteria met; merge is the operator's ruling (§14.2).
