BLOCK / GATE
H-D17B / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · branch base `0672150` (H-D17 live evidence) on `main` = `565a282`, live on both services

TASKS CLAIMED CLOSED
- B.1 per-client limit, 30/min, every `/api/screening` route, ES and EN refusal
- B.2 at most 2 screening queries in flight, from anyone
- B.3 queue of 20, then 503 `screening_busy` with `Retry-After: 10`, ES and EN
- B.4 municipality list and summary cached 5 min; concurrent misses share one query; failures not cached
- B.5 live — PASS (below)

DIFF SUMMARY
`artifacts/api-server/src/routes/screening.ts` (guards), `artifacts/api-server/src/i18n.ts` (2 entries × 2 languages), new `artifacts/api-server/src/routes/h-d17b-screening.test.ts` (7 tests), this ruling and `contracts/blocks/h-d17b.md`.

TEST EVIDENCE
- Typecheck: 0 errors, all packages.
- API suite: 609 passed / 5 failed / 614. The 5 are the container-local PDF euro-sign failures recorded in H-D17. **CI on the branch: run `40027445200` green, api-server 614/614 (40 files)**, build and screening-postgis green.
- API build done; `screening_busy` present in `dist/index.mjs`.
- Mutations, each restored after: B1 limiter removed — KILLED; B2 limiter on default key — KILLED; B3 concurrency 10 — KILLED; B4 buildings bypass the gate — KILLED; B5 queue check removed — KILLED; B6 summary not cached — KILLED; B7 failures kept in cache — KILLED; B8 cache never expires — KILLED; B9 municipalities not cached — KILLED; B10 cache stores result, not promise (no shared query) — KILLED. 10/10.

LIVE EVIDENCE
Before (23 Oct 2026, `565a282`): `/summary` 2.668 s, `/buildings?limit=500&offset=0` 1.769 s, `offset=30000` 3.536 s, `/api/history` 0.486 s; no limit header on screening routes other than export.
After: merge `c7f7117` (`--no-ff`, parents `565a282` + `9515f12`), pushed 21:39:41Z from the cloud session on the operator's ruling ("Merge now"). Render re-read before push: both services autoDeploy yes, trigger commit, branch main. Probes hold one connection where a single client matters (the cloud egress address rotates per request).
- L1 PASS — `/api/version` = `c7f7117` at 21:41:16Z; web `build-sha` = `c7f7117`.
- L2 PASS — the limit counts one client: one connection (160.79.106.129) across summary ×3, municipalities, buildings read `RateLimit: limit=30`, remaining 29 → 28 → 27 → 26 → 25.
- L3 PASS — the cache: `/summary` 2.754 s on the first call, 0.163 s and 0.162 s on the next two.
- L4 PASS — a burst cannot stall the site: 26 parallel `GET /buildings?limit=500&offset=30000` (the slowest query measured) → **22 × 200** (2 in flight + 20 queued, all served) and **4 × 503** answered at once. During the burst, `/api/history` answered in 0.706 s, 0.501 s, 0.383 s and `/api/healthz` in 0.478 s. The last queued screening request took 59.8 s: under a burst, screening slows and refuses while every other route stays responsive.
Probe footprint: reads only; zero rows written; zero geocoder, NASA or model calls.

ROLLBACK COMMAND
`git revert -m 1 c7f7117` — Tier B: computed on scratch ref `scratch/h-d17b-revert-proof` before the push, revert `f4d2c90`, its tree == `565a282`'s tree, 11 files / +34 / −363 against the merge (the block plus the H-D17 evidence it carried). Cloud clone only, unpushed. **Deploy path UNPROVEN** (A13 debt stands).

RESIDUE
- After an `h3-load`, the previous summary can show for up to 5 minutes (cache window).
- Under a sustained burst, real screening visitors wait (up to ~60 s measured) or get the typed 503; the rest of the site is unaffected.
- The Assistant and Optimizer share Groq's free-tier quota; a few clients can exhaust it. Not addressable in code alone.

RULING
CLOSED (self-ruled under §14.2: every live criterion is a mechanical check) — 23 Oct 2026, `c7f7117`.
