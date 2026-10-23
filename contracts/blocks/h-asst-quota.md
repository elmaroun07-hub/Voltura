# Block H-ASST-QUOTA — the Assistant spends less of the shared quota

Opened 23 Oct 2026 from the cloud session. Branch `heatshield/h-asst-quota` off `main` = `c7f7117` (live).

## Rulings (operator, 23 Oct 2026)

- 22:45 — no Groq paid tier ("I can't afford it").
- ~22:47 — route **"Both"**: tighter per-visitor message limit (5 per 15 minutes, was 20) **and** a shorter prompt, with a live accuracy re-test.
- ~22:55 — re-chose **"Both as chosen"** after being told: Groq caches the fact list on `openai/gpt-oss-120b` (cached tokens do not count toward rate limits, per Groq's prompt-caching page), so a shorter prompt saves little; the binding ceiling is **1,000 requests a day** site-wide (Groq rate-limits page: gpt-oss-120b 30 RPM, 1K RPD, 8K TPM, 200K TPD). A per-visitor daily cap was offered and declined.

## Measured before the block (`c7f7117`)

- Prompt: en 6,851 characters, es 7,796.
- Production `messages` table (read-only): 126 assistant answers — mean 1,774 characters, median 2,048, p95 3,713, max 4,055; user questions mean 22 characters; a conversation is usually one exchange (median 2 messages). History costs almost nothing; the answer is most of each question's uncached tokens.
- Production model per `voltura-optimizer` records (10 Sept): `openai/gpt-oss-120b`; the app does not log it, so this is a record, not a live reading.

## Tasks

| # | Task | Done when |
|---|---|---|
| Q.1 | Message limit 5 per client per 15 minutes (`MESSAGES_PER_WINDOW`) | pinned at 5; 6th refused over HTTP; mutations "back to 20" and "literal 20" fail |
| Q.2 | Shorter prompt, both languages: remove the "Context" paragraph and the sentence repeating the no-invention rule. Every fact sentence and every pinned rule unchanged | removed text absent; every fact present; shorter than before; mutations restoring either passage or dropping a fact fail |
| Q.3 | Tests that sent more than 5 messages from one address give each request its own client (prompt-rule, feature-map); the two limit tests read the constant | suite green |
| Q.4 | Live accuracy re-test, as H-ASST-ACC4: L2 per language "What is Voltura?" ×8, feed-in tariffs, NPV, EU AI Act — zero misstatements of the 13 facts, no over-refusal, checker passes; L2-S three out-of-scope questions per language → exactly the refusal sentence | answers read against the facts and the checker; recorded in the ruling |

## Fence

`chat/routes.ts` (one constant, two passages per language, comments), five chat test files, one new test file. No fact sentence, no DDL, no data, no dependency. Not in scope: `reasoning_effort` and `max_tokens` (Groq's docs do not say whether reasoning tokens count, and a lower cap could cut a fact mid-sentence); the Optimizer's limit.

## Merge

Operator's ruling (§14.2). `--no-ff`. Rollback target: `c7f7117`.
