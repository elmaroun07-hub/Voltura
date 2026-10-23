# Block H-D17B — the screening routes cannot stall the site

Opened 23 Oct 2026 21:25 from the cloud session on the operator's ruling "Fix them", after H-D17 closed. Branch `heatshield/h-d17b`, based on `heatshield/h-d17-live-evidence` @ `0672150` (so this merge also carries H-D17's live evidence and comment corrections), which sits on `main` = `565a282`.

## Why

Measured live 23 Oct 2026 on `565a282`, one request each: `/api/screening/14021/summary` 2.7 s; `/buildings?limit=500` 1.8 s at offset 0, 3.5 s at offset 30000; `/api/history` 0.5 s. The screening routes had no limit except export (10/min), and they share pg's default pool (10 connections) with calculations and chat. One client firing them in parallel could stall every route.

## Tasks

| # | Task | Done when |
|---|---|---|
| B.1 | Per-client limit on every `/api/screening` route, 30 per minute, keyed by `clientKey`, refusal in ES and EN | 31st refused; another client not; mutations "no limiter" and "default key" fail |
| B.2 | At most 2 screening queries use the database at once, from anyone | 6 parallel → never more than 2 in flight; mutations "concurrency 10" and "bypass" fail |
| B.3 | With 20 waiting, the next is answered at once: 503 `screening_busy`, `Retry-After: 10`, ES and EN | 23rd → 503; the 22 accepted all succeed; mutation "no queue check" fails |
| B.4 | Municipality list and summary kept 5 minutes; concurrent misses share one query; failures not kept | DB call counts; mutations on each property fail |
| B.5 | Live: limit header on screening routes, summary served from memory after the first call | one-connection probes, recorded in the ruling |

## Fence

`routes/screening.ts`, two catalogue entries per language, one new test file. No DDL, no data, no dependency change (`p-limit` 4.0.0 is already a dependency). Known trade-off: after an `h3-load`, the old summary can show for up to 5 minutes. Out of scope: the Assistant/Optimizer quota (Groq free tier, shared) — no code fix exists without more quota.

## Merge

Operator's ruling (§14.2). `--no-ff`. Rollback target: the tip at block open, `565a282`.
