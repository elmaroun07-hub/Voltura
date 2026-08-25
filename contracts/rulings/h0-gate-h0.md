# H0 — Gate H0 (verification-only)

**BLOCK / GATE** — H0 (Stop the bleeding) / Gate H0
**DATE** — 2026-08-25
**COMMIT (before)** — `b9ce581`, which is what was deployed and probed
**RULING AUTHORITY** — self-ruled under §14.2. Both criteria mechanical: live HTTP responses and a grep.

**Run as a verification-only block by operator direction.** Gate R found all ten tasks
DONE in code. The operator declined to close H0 administratively: `file:line` proves the
code exists, it does not prove two browsers in different sessions cannot see each other's
data. That is the criterion, and it is the highest-stakes assertion in the contract — live
personal-data exposure on a public URL, in front of a buyer with public-sector
data-protection duties. **No code tasks. The gate still runs.**

---

## TASKS

None. Zero code changes. This block asserts nothing about the implementation that Gate R
did not already establish; it tests the claim.

## CRITERION 1 — two live sessions cannot see each other's data

All against `https://voltura-api.onrender.com`, deployed `b9ce581`. Two session ids,
generated for this probe:

```
A = aaaa1111-1111-4111-8111-aaaaaaaaaaaa
B = bbbb2222-2222-4222-8222-bbbbbbbbbbbb
```

### Each session creates its own conversation

```
POST /api/conversations as A → 201 {"id":28,"title":"A private chat","sessionId":"aaaa1111-…"}
POST /api/conversations as B → 201 {"id":29,"title":"B private chat","sessionId":"bbbb2222-…"}
```

### Listing is scoped

```
GET /api/conversations as A → [{"id":28,"title":"A private chat"}]
GET /api/conversations as B → [{"id":29,"title":"B private chat"}]
```

Neither list contains the other's row.

### Cross-session access is refused, and refused indistinguishably

```
GET    /api/conversations/28   as A (owner)        → 200  {"id":28,…}
GET    /api/conversations/28   as B (NOT owner)    → 404  {"error":"Conversation not found"}
GET    /api/conversations/999  as B (nonexistent)  → 404  {"error":"Conversation not found"}
DELETE /api/conversations/28   as B (NOT owner)    → 404  {"error":"Conversation not found"}
POST   /api/conversations/28/messages as B         → 404  {"error":"Conversation not found"}
```

"Not yours" and "does not exist" are **byte-identical**. A 403 would have confirmed the
conversation exists; it does not.

### Nothing was destroyed by the refused delete

```
GET /api/conversations/28 as A → 200 {"id":28,"title":"A private chat",…}
```

### Calculations are scoped too

```
POST /api/calculate as A (Madrid, Spain)     → 200
POST /api/calculate as B (Lisbon, Portugal)  → 200
GET  /api/history   as A → ["Madrid, Spain"]
GET  /api/history   as B → ["Lisbon, Portugal"]
```

### A request with no session header is rejected, never defaulted

```
GET  /api/conversations  no header → 400 {"error":"X-Session-Id header is required"}
GET  /api/history        no header → 400 {"message":"X-Session-Id header is required"}
POST /api/conversations  no header → 400 {"error":"X-Session-Id header is required"}
```

**Criterion 1 met.** Covers H0.1, 0.2, 0.3, 0.4.

## CRITERION 2 — no displayed number is a constant

### Grep over shipped source

`artifacts/green-energy-calculator/src`, `artifacts/api-server/src`, `lib/db/src`:

| Pattern | Result |
|---|---|
| `roiYears` | **0** |
| `Computation CO` | **0** |
| `carbonFootprint` | 2 — both `lib/db/src/schema/schema.ts:68,91`, the orphaned DB column and its `omit` entry. Not read, not written, not rendered. |
| `\|\| 4.0`, `\|\| 15.0` | 3 — **all in comments** (`routes.ts:105`, `calculate.test.ts:16`) describing the deleted defect |
| `lat \|\| 45` | 2 — **all in comments** (`routes.ts:180`, `calculate.test.ts:233`) |

Every hit was opened and read, not classified from grep context. That distinction is the
standing rule from the three R0 misclassifications.

### Rendered DOM, live site

`https://voltura-web.onrender.com`, `build-sha b9ce581`, Fuengirola submitted through the
real form:

```json
{
  "irradianceSourceCard": "NASA POWER satellite data, 2022",
  "co2Card": "903 kg",
  "savings": "3,702 kWh",
  "hasEstimatedROI": false,
  "hasComputationCO2": false,
  "has7point5Years": false,
  "hasRawEnum": false,
  "hasLiveNASAclaim": false
}
```

The ROI card, the 7.5-year constant, the Computation CO₂ card and the raw enum are all
absent from rendered output. **Criterion 2 met.** Covers H0.5, 0.10, and G7.

### The other four, by direct observation

| # | Evidence |
|---|---|
| 0.6 | The browser completed cross-origin requests from `voltura-web` to `voltura-api` with `X-Session-Id`, so the locked CORS origin and `allowedHeaders` are working in production. A wrong origin or a missing allowed header would have failed the preflight and produced no result at all. |
| 0.7 | Not exercised. Tripping a production rate limiter to prove it exists costs real users their quota for fifteen minutes. Verified in source at `routes.ts:276` and `chat/routes.ts:58`, and by the local 429 evidence at the Phase-0 Gate 3. **Named as not-live-verified rather than claimed.** |
| 0.8 | Prior gate: `{"location":"Madrid"}` → 400 `{"message":"Invalid input: expected array, received undefined","field":"energyPattern"}` |
| 0.9 | Prior gate: unresolvable location → 422 with `irradianceSource: "not-reached"` |

## OUT OF H0 SCOPE — named, not fixed

- `optimize-payload.ts:46-47` — `|| 5000`, `|| 10`. A displayed recommendation with a
  fabricated default. Real, and **not H0's** — architecture-v2 puts it at 4.7 via C7.
- `routes.ts:78` — `return 0.4; // global average fallback`. H1.9 / H1b.
- The `903 kg` CO₂ figure above is a *looked-up* constant (Spain 0.244 from
  `CARBON_INTENSITY_BY_COUNTRY`), not a computed one. H1b governs. Under H1b's standing
  order — *"until this gate closes, quote no CO₂ figure publicly"* — this figure is
  currently rendered in production and should be considered live-open.

## DIFF SUMMARY

This ruling file only. **Zero code changes.**

## TEST EVIDENCE

Not applicable — no code changed. Deliberately not pasting an unrelated green suite.

## LIVE EVIDENCE

Everything under Criterion 1 and the DOM dump under Criterion 2. Deployed API and deployed
web, not localhost. No local server booted (G3 — `index.ts:23` runs DDL before `listen`).

## ROLLBACK

```
git branch -D heatshield/h0
```

Not executed — unmerged at the time of writing, G8 as amended. No code to revert regardless.

## RESIDUE

- Test rows created on **production** by this probe: conversations `28` and `29`, and two
  calculations (Madrid, Lisbon) under the two probe session ids. They are inert and
  session-scoped — invisible to any real visitor — but they are real rows in the
  production database and no cleanup was performed, because deleting them is a DML write
  and G3 forbids it without a fence that grants it.
- 0.7 not exercised live, by choice. See above.
- The CO₂ figure rendered in production remains a looked-up constant pending H1b.

## RULING

**CLOSED (self-ruled)** under §14.2.

Both criteria met against the deployed system. H0's ten tasks were done in code before this
block opened; this gate establishes that they are **true in production**, which is what the
criterion actually asks.
