# H-R — Gate R (Reconcile)

**BLOCK / GATE** — H-R / Gate R
**DATE** — 2026-08-25
**COMMIT (before)** — `b9ce581` (production `main`); branch `heatshield/h-r` cut from `heatshield/h-groundwork`
**RULING AUTHORITY** — self-ruled under §14.2. Every R-task criterion is mechanical: a diff, a grep, a live HTTP response, an import count.

---

## R.1 — Which architecture-v2 tasks `78c26d5..b9ce581` already satisfies

15 commits, 28 files, +1,488 / −182.

| Commit | Satisfies |
|---|---|
| `c1eeccf`, `a9e8379` | none of H0/H1 — dependency install and 25 pre-existing typecheck errors → 0 |
| `231a35e` | **H0.5** |
| `613b8a8` | **H0.10** |
| `e8fcacc` | **H0.1**, **H0.3** |
| `7693a58` | **H0.8** |
| `7cc6e88`, `962d8b8`, `da110a2` | **H0.2**, **H0.4** (schema, wrapper, scoping) |
| `0ed0167` | **H0.6** |
| `60e1f01` | **H0.7** |
| `7ec9671` | **H0.9** |
| `d743dab`, `45da79c`, `b9ce581` | none of H0/H1 as listed — the NASA key-format defect and the copy that described it |

**All ten H0 tasks are satisfied by work already in production.**

## R.2 — Reconciliation table

### H0 — all DONE

| # | Status | Evidence |
|---|---|---|
| 0.1 | **DONE** | `ChatInterface.tsx:12` `useChat(conversationId)`; `:30` `createConversation.mutateAsync()` behind an `id === null` guard |
| 0.2 | **DONE** | `chat/routes.ts:38` `requireSessionId`; `:90` `notFound(res)` — 404 on mismatch, not 403 |
| 0.3 | **DONE** | `ChatInterface.tsx:30` — creation on first send; no mount effect |
| 0.4 | **DONE** | `routes/routes.ts:643` `storage.getHistory(sessionId)`; no unscoped overload exists |
| 0.5 | **DONE** | `grep roiYears` over `artifacts/*/src` + `lib/*/src` → **0 hits** |
| 0.6 | **DONE** | `app.ts:46` `origin: webOrigin`; `:50` `allowedHeaders: ["Content-Type","X-Session-Id"]` |
| 0.7 | **DONE** | `routes/routes.ts:276` `optimizeLimiter`; `chat/routes.ts:58` `messageLimiter` |
| 0.8 | **DONE** | `routes/routes.ts:649` `api.calculations.optimize.input.parse(req.body)` |
| 0.9 | **DONE** | `routes/routes.ts:461` `code: "geocode_failed"` → 422; `lat \|\| 45` gone |
| 0.10 | **DONE** | `grep carbonFootprint\|Computation CO` over `artifacts/*/src` → **0 hits** |

**H0 is closed by prior work. The block opens with nothing in it.** Per its own fence — *"In: 0.1–0.10, minus whatever Gate R marked DONE"* — H0's scope is empty. C4 anticipated 0.9; the reconciliation finds all ten.

### H1 — one DONE, one PARTIAL, seven OPEN

| # | Status | Evidence |
|---|---|---|
| 1.0 | **OPEN** | `routes/routes.ts:154-161` — `Number(irr[k])` then `.every(Number.isFinite)`. `Number.isFinite(-999) === true`. No `-999` rejection anywhere. |
| 1.8 | **OPEN** | `routes/routes.ts:112` `const NASA_YEAR = 2022` — single hardcoded year |
| 1.1 | **PARTIAL** | Gates B0–B1a covered the four NASA/irradiance claim sites only. Not covered: `artifacts/greencalc/templates/*.html` (8 files incl. `base.html`, `compliance.html`, `index.html`), `static/lang/{en,es,ar}.json`, `docs/VOLTURA-GROUND-TRUTH.md`, and any LinkedIn / ENISA / Rising UP draft — which are not in this repository and cannot be inventoried from a coding session. |
| 1.3 | **DONE — by relocation, not deletion** | All four `*_deploy.md` files are **outside the repository**, in `Desktopdev/` alongside it. `ls` at repo root → absent. They are not tracked, not shipped, and not deletable from inside the fence. See RESIDUE. |
| 1.5 | **OPEN** | `routes/routes.ts:76` `if (loc.includes(country))` — substring match |
| 1.6 | **OPEN** | `lib/cte/src/cte-zones.ts:78` comment; `:145` the const |
| 1.7 | **OPEN** | no `.github/workflows/` directory |
| 1.9 | **OPEN** | `lib/db/src/schema/schema.ts:7` defines it; `routes/routes.ts:11` imports it |
| 1.x | **OPEN** | `artifacts/greencalc/static/lang/es.json` present, 1,384 bytes, unsalvaged |

## R.3 — `phase1/block-r-replit`

| | |
|---|---|
| Tip | `84f94a1` |
| Merged into `main` | **no** (`git branch --merged main` → 0) |
| On remote | **no** |
| Commits | `913e76d` (R1), `84f94a1` (R2) |
| Diff vs `b9ce581` | **21 files, +1 / −6,967** |

Contract §2 says "R2 … committed 24 Aug, never pushed" — confirmed. Gate R3 **self-ruled CLOSED** this session (`contracts/rulings/block-r-gate-r3.md`). The merge is operator-only under §14.2 and is **not taken**.

## R.4 — `-999`

### (i) Static proof of the missing guard

`artifacts/api-server/src/routes/routes.ts:154-161`

```ts
const irrArr  = monthKeys.map((k) => Number(irr[k]));
const tempArr = monthKeys.map((k) => Number(temp[k]));
if (!irrArr.every(Number.isFinite) || !tempArr.every(Number.isFinite)) {
  return miss(res.status, keysPresent);
}
```

`Number.isFinite(-999) === true` — verified by execution. The only validation is finiteness. **There is no `-999` rejection at this parse site or anywhere else in the file.** A fill value passes straight into `irradianceMonthly`.

### (ii) Live proof the array reaches the user unfiltered

`POST https://voltura-api.onrender.com/api/calculate`, Fuengirola:

```
irradianceMonthly: [2.6544,3.5544,3.5868,5.8231,7.4213,7.8293,7.5842,6.8023,5.3477,3.6223,2.963,2.1646]
source/year      : nasa-live 2022
savingsKwh       : 3702
```

Twelve values pass from NASA through the parse site into the response body with no filtering beyond finiteness. **This is a reachability proof, not a `-999` sighting** — every value here is real.

### (iii) Reachability condition

`-999` enters when a requested period contains a month NASA has not populated. It cannot happen today: `routes/routes.ts:112` pins `NASA_YEAR = 2022`, fully processed, and the year is not user-controlled — no request parameter reaches it.

Probed directly, monthly endpoint, Fuengirola coordinates:

| Range | Result |
|---|---|
| 2024 | 13 keys, **0** fill values |
| 2025 | 13 keys, **0** fill values |
| 2020–2025 | 78 keys, **0** fill values |
| 2026 | **rejected** — *"Your end date out of range. The data is available to 2025/12/31."* |
| 2023–2026 | **rejected**, same message |

So the monthly endpoint **rejects** an out-of-range period rather than filling it. That narrows the H1.8 risk but does not remove it: the boundary moves each year, and a range ending in the current partial year is the case to guard. The guard must exist before the year becomes a parameter — C6's ordering holds.

### The fixture — found

The **daily** endpoint returns fill values for recent dates at the same coordinates:

```
GET .../temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M
      &longitude=-4.6234&latitude=36.5388&start=20260813&end=20260823

ALLSKY_SFC_SW_DWN  -999 on: 20260821, 20260822, 20260823
T2M                -999 on: 20260823
```

Saved to **`contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json`** (982 bytes, real NASA response, unedited). This is H1.0's regression fixture. G10 holds — the test consumes the file, never the network.

**Caveat, stated not buried:** the app calls the **monthly** endpoint; this fixture is **daily**. It proves `-999` is NASA's real fill value and gives H1.0 authentic bytes to test against, but it is not a monthly-endpoint sighting and no monthly `-999` was obtained. H1.0's guard must be written against the value, not the endpoint shape.

## R.5 — `lib/cte` imports

Four modules: `cte-zones.ts`, `solar-irradiation.ts`, `qsol-jul.ts`, `cte-u-limits.ts` (plus `index.ts`).

**Importers outside `lib/cte`: 0 for all four.** No file under `artifacts/**` references `@workspace/cte` or any of the four module names. C5 confirmed — 72 passing tests wired to nothing.

---

## DIFF SUMMARY

`contracts/rulings/h-r-gate-r.md` (this file) and `contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json`. **No source, schema, config or dependency touched.** H-R's fence permits its own ruling file; the fixture is new data under `contracts/`, not a modification to anything the fence protects.

## TEST EVIDENCE

Not applicable and not claimed — H-R changes no code. Suite not run.

## LIVE EVIDENCE

The `POST /api/calculate` above, against the deployed Render URL. **No server was booted locally** — `index.ts:23` calls `ensureChatTables()` before `listen()`, which is DDL under G3.

## ROLLBACK

```
git branch -D heatshield/h-r
```

Not executed — unmerged block, G8 as amended. `main` unchanged at `b9ce581`.

## RESIDUE

- **H0's scope is empty.** All ten tasks DONE. The block should be closed administratively rather than opened.
- **1.3 cannot be done from inside the fence.** The four `*_deploy.md` files live in `Desktopdev/`, the parent directory, not in the repository. Deleting them is a filesystem action outside every fence this contract defines. Operator call.
- **1.1 cannot be completed from a coding session.** LinkedIn, ENISA and Rising UP drafts are not in this repository. The in-repo half — `artifacts/greencalc/templates/*`, `static/lang/*`, `docs/` — is inventoriable and is not yet inventoried.
- No monthly-endpoint `-999` obtained; see the caveat under R.4.
- `0001-…patch`, `docs/` — untracked, never in scope.
- `heatshield/h-groundwork` and `phase1/block-r-replit` both unmerged.

## RULING

**CLOSED (self-ruled)** under §14.2.

All twenty tasks reconciled with evidence. **The contract's task lists are amended by this table**: H0 is empty, H1 carries seven OPEN plus one PARTIAL plus one DONE-by-relocation.

**Next: H1** — and it opens on 1.0 + 1.8 together, per C6.
