# Gate H-OPT — the Optimizer computes, the model explains

| | |
|---|---|
| **BLOCK / GATE** | H-OPT / Gate H-OPT |
| **DATE** | 2026-09-11 |
| **COMMIT (before)** | `c459b0d` — `main`, unchanged throughout |
| **BRANCH** | `heatshield/opt-grounded`, three commits, **not merged, not pushed to `main`** |
| **BLOCK FILE** | `contracts/blocks/h-opt.md` |
| **RULING** | **CLOSED (self-ruled, §14.2)** — every criterion mechanical. The merge is **not taken**: §14.2 reserves it to the operator. |

---

## TASKS CLAIMED CLOSED

| # | Task | State |
|---|---|---|
| O.1 | Geocode in the optimize handler through the same `geocode()` the calculate handler uses | **CLOSED** — both routes now enter through one `resolveLocationIrradiance()` |
| O.2 | Same `fetchNasaPower(lat, lon)`, same 2019–2023 mean, same parse boundary; `-999` is a 422 | **CLOSED** |
| O.3 | New pure function, deterministic and tested | **CLOSED** — `artifacts/api-server/src/lib/sizing.ts`, 17 tests |
| O.4 | Load from the user's annual usage, spread over the profile shape | **CLOSED** — `annualUsageKwh` required; the 24-entry pattern normalised to sum 1 |
| O.5 | The model receives figures and returns prose only | **CLOSED** — `optimalPv` / `optimalBattery` are `z.number()`, computed; the model's own keys are ignored |
| O.6 | Every numeral in the prose must appear in the input the model was given | **CLOSED** — else the existing `invalid_model_response` 502 |
| O.7 | The 200 carries the same `resolution` block, and the tab renders it | **CLOSED** — shared label map at `green-energy-calculator/src/lib/provenance.ts` |
| — | **Web change**, flagged before building per the fence's item 4 | **CLOSED** — see the finding below |

### The fence's item 4, answered before any code was written

**The web client sent no usage and had no field to send.** `Optimizer.tsx` posted
`{ location, energyPattern }` and nothing else, `energyPattern` being the module constant
`DEFAULT_PATTERN` — 24 numbers summing to 102, never edited by the user. Neither optimize
input schema (`shared-routes.ts`, and the mirror in `green-energy-calculator/src/lib/api.ts`)
had a usage field at all. Recorded in `contracts/blocks/h-opt.md` before the first source
edit, and the web change was taken: an annual-usage input on the Optimizer tab, bounds
100–100,000 kWh matching `calculationInputSchema.energyUsage`, **required and never
defaulted** — a missing usage is a 400, not a substituted 5,000.

### The coverage target — 1.00, applied to every location

Justified in full in the block file. Short form: the old output had no coverage target, it
had whatever the model felt — reconstructable from its own answers as 100% for Tétouan and
Paris, 88% for Fuengirola, 40% for London. 1.00 is the only value that needs no second
assumption; any other target implies a claim about tariffs or export pricing this route
does not compute and cannot cite (P1). It is **annual energy parity**, not 100%
self-consumption and not off-grid autonomy, it ships in the response as `coverageTarget`,
the UI states what it means, and it is never rendered as a grade or a rating (**P7**).

---

## DIFF SUMMARY

`git diff --shortstat c459b0d..heatshield/opt-grounded`

```
15 files changed, 2190 insertions(+), 285 deletions(-)
```

| File | + / − | What |
|---|---|---|
| `artifacts/api-server/src/lib/sizing.ts` | +300 | **new** — the pure function |
| `artifacts/api-server/src/lib/sizing.test.ts` | +253 | **new** — 17 tests |
| `artifacts/api-server/src/routes/optimize.test.ts` | +413 | **new** — 16 route tests |
| `artifacts/api-server/src/routes/routes.ts` | 366 | `resolveLocationIrradiance()` extracted and shared; the optimize handler rewritten |
| `artifacts/api-server/src/routes/optimize-payload.ts` | 238 | facts renderer + figure validator |
| `artifacts/api-server/src/routes/optimize-payload.test.ts` | 296 | 23 tests |
| `artifacts/api-server/src/shared-routes.ts` | 63 | optimize input/output contract |
| `artifacts/api-server/src/shared-routes.test.ts` | 86 | 10 tests |
| `green-energy-calculator/src/lib/api.ts` | 69 | the mirror, kept in sync |
| `green-energy-calculator/src/lib/provenance.ts` | +43 | **new** — the one label map (G7) |
| `green-energy-calculator/src/pages/Optimizer.tsx` | 132 | usage input, provenance line, assumptions panel |
| `green-energy-calculator/src/components/calculator/ResultsDisplay.tsx` | 35 | now imports the shared map |
| `green-energy-calculator/src/hooks/use-calculations.ts` | 8 | `annualUsageKwh` in the mutation type |
| `contracts/blocks/h-opt.md` | +162 | the block file |
| `gate-check.sh` | 11 | expected counts |

---

## TEST EVIDENCE

`pnpm -r test` — **199 passed, 0 failed.** `lib/cte` 72 unchanged; api-server **78 → 127**.

`pnpm run typecheck` (the root script) — clean, 4 packages.
`pnpm --filter @workspace/api-server build` — Done. `pnpm --filter @workspace/green-energy-calculator build` — built in 24.20s.

### Mutation results — G9

Each mutation was applied to the shipped source, the whole api-server suite run, and the
source restored with `git checkout --`. Final state re-run: **127/127 green.**

| # | Mutation | Tests killed | Which |
|---|---|---|---|
| **A** | **Re-hardcode the irradiance** — `irradianceKwhM2Day: 5.5` (the model's own Tétouan prior) instead of `resolved.avgIrradiance` | **8** | 4 in *"the optimizer calls NASA, not the model's memory"*, 1 in O.4, 3 in O.5/O.6 |
| **B** | **Drop the NASA call** — `fetchNasaPower` never invoked, probe forced to `request-failed` | **17** | 9 optimize + **8 pre-existing calculate tests** (A3.1, A3.2, A3.4, A3.6 ×3, A3.7 ×2) |
| **C** | **Remove the figure validator** — `unsupportedFigures` result replaced with `[]` | **5** | 4 in O.6, 1 route test |
| **D** | **Read the pattern as kWh again** — `annualUsageKwh` replaced by `sum(energyPattern) × 365` | **5** | the 3.4 kWp lock, the doubling test, 3 prompt/route tests |

Mutation B is the one worth reading twice. It kills **eight tests that existed before this
block**, because the calculate handler and the optimize handler now enter through the same
function. That is the mechanical proof of the P5 claim: there is one NASA path, not two
that happen to agree today.

Mutation A is the fence's *"re-hardcoding the irradiance must kill tests"* and B is its
*"dropping the NASA call must kill tests"*. Both do.

### G10 — network-free

The CI check (*a test file naming a live host must stub fetch*) run locally:

```
ok   artifacts/api-server/src/routes/calculate.test.ts
ok   artifacts/api-server/src/routes/optimize.test.ts
exit 0
```

`optimize.test.ts` serves Nominatim and NASA POWER from `calculate.fixtures.json` — the
same live capture of 22 Aug 2026 the calculate suite uses — and mocks the model provider,
the rate limiter, the DB and storage. `sizing.test.ts` and `optimize-payload.test.ts` are
pure-function tests with no stub needed: the modules they exercise import nothing that can
open a socket.

### Other mechanical checks

| Check | Result |
|---|---|
| **G5 — numeric `\|\|` defaults** in shipped source | `optimize-payload.ts:46–47` (`rec["optimal_pv_watts"] \|\| 5000`, `\|\| 10`) **deleted**. Three pre-existing hits remain and are **outside this fence**: `routes.ts:637` (`totalPredicted \|\| 1`, a divide-by-zero guard inside `simulate8760`, calculate path) and the two shadcn `progress.tsx` components (`value \|\| 0`). Carried as residue. |
| **P7 vocabulary** | clean |
| **Retired figures** (4,203 / €1,050.70) | absent |
| **G4** — `replit_integrations/chat/` present, 9 tests | unchanged |
| **G3** — no DDL, no migration, no schema change | the optimize route persists nothing and still does not |
| **G1** — `main` | `c459b0d` before and after; zero commits |

---

## LIVE EVIDENCE

**What is live is the defect, and it was caught verbatim.** The block itself cannot be
proven live at this gate: proving it would require a merge and a deploy, and §14.2 reserves
the merge to the operator. Stated rather than glossed, per A18's precedent — a criterion
requiring evidence that cannot yet exist is not evidence.

Deployed sha, `GET /api/version`, 2026-09-11:

```
{"sha":"c459b0d","shaFull":"c459b0d96aff90db808abfaeee51f42a8c125d47","source":"render"}
```

`c459b0d` is `main` and is this branch's parent, so production is running exactly the code
this block replaces. `GET /api/healthz` → 200.

One request to the deployed route, chosen to cost one model call and prove three things at
once — a **three-entry** `energyPattern` and **no usage field at all**:

```
POST https://voltura-api.onrender.com/api/optimize
{"location":"Fuengirola, Spain","energyPattern":[1,2,3]}

HTTP 200
{"optimalPv":1500,"optimalBattery":4,
 "explanation":"Based on Fuengirola's average solar irradiation of about 5 kWh/m²/day,
  a 1.5 kW PV array will produce roughly 7-8 kWh per day, comfortably covering the
  6 kWh daily demand while allowing for system losses; a 4 kWh battery provides enough
  stored energy to meet evening and early-morning loads and offers a safe
  depth-of-discharge margin, maximizing return on investment."}
```

What that one response proves, and what each part becomes on this branch:

| Live, today | On this branch |
|---|---|
| A 3-entry pattern and a missing usage return **200** | **400** — `energyPattern` must carry 24 weights; `annualUsageKwh` is required and never defaulted |
| *"about 5 kWh/m²/day"* — the model's prior. NASA was never called; the computed 2019–2023 mean for Fuengirola is **5.05** | the figure comes from `fetchNasaPower`, and `sizing.irradianceKwhM2Day` is asserted equal to the `avgIrradiance` `/api/calculate` reports for the same town |
| *"the 6 kWh daily demand"* — the model **summed `[1,2,3]` as kWh**. This is the 102 kWh/day defect in one sentence, with a different array | the pattern is normalised to sum 1 and carries no magnitude; the load is `annualUsageKwh / 365` |
| `optimalPv: 1500`, `optimalBattery: 4`, *"7-8 kWh per day"* — every figure model-chosen | all computed; and prose containing `5`, `1.5`, `7`, `8`, `6`, `4` where none is in the input is a **502 `invalid_model_response`** |
| No source, no period, no coordinates anywhere in the response | the same `resolution` block `/api/calculate` ships, rendered on the tab |

**Carried as a post-merge obligation, not as a closed item:** after the operator merges,
re-probe `/api/version` for the new sha and re-run the request above against it, expecting
a 400 for the malformed body and a 200 carrying `resolution` + `sizing` for a well-formed
one. Until that runs, "it works in production" is an assertion. A20's rule applies:
*a criterion is met when its evidence has run.*

---

## ROLLBACK COMMAND

**Tier B under G8 / A16.** The block has not merged and nothing has been pushed to `main`,
so there is no production state to revert. The revert is **proven to apply** on a scratch
ref instead of executed.

```
git checkout -b scratch/h-opt-revert-proof main
git merge --no-ff --no-edit heatshield/opt-grounded     # 471ca09
git revert -m 1 --no-edit HEAD                          # 20ab290
```

Output:

```
merge 471ca09:   15 files changed, 2190 insertions(+), 285 deletions(-)
revert 20ab290:  15 files changed,  285 insertions(+), 2190 deletions(-)
tree identical to main?  YES — tree byte-identical to main
main untouched?          c459b0d
```

The revert targets exactly this block's diff, inverts it precisely, and leaves everything
else standing — the resulting tree hashes identically to `main`. The scratch ref is kept,
unpushed, so the proof is inspectable.

**The deploy path is UNPROVEN.** A13's finding stands: a revert on an auto-deploying branch
is a deploy, and no rollback of this block has ever been through one. This line is required
by A16 and its omission would itself be the breach. The debt is carried, not discharged.

**Auto-deploy state (§2, A2).** `voltura-api` and `voltura-web` Auto-Deploy settings are
**not observable from a coding session** and are not asserted here. The operator is the
sensor and must re-confirm both at the merge gate, per §2.

---

## RESIDUE

| # | Item |
|---|---|
| 1 | **`gate-check.sh` was 19 tests stale on arrival.** `EXPECTED_TOTAL_TESTS=131` / `EXPECTED_API_TESTS=59` against an actual 150 / 78 at `c459b0d`, so that row had been failing since some change after H1.5 landed without touching the constants. Corrected to 199 / 127 in this block with the discrepancy stated in the file, not silently. |
| 2 | **`gate-check.sh` does not complete in this environment.** Killed after 13 minutes with no output. Its §3 runs `pnpm -r exec tsc --noEmit` — the naive form CI replaced because it fails TS6305 on unbuilt project references — and its §9 runs `pnpm -r build`, which includes `artifacts/mockup-sandbox`, the package CI excludes for a missing `lightningcss` native binary. Not this block's fence; the individual checks it wraps were run directly and are recorded above. |
| 3 | **Three pre-existing G5 `\|\|` numeric defaults survive**, listed above. `routes.ts:637` belongs to the calculate path; the two `progress.tsx` are vendored shadcn components. |
| 4 | **The web package has no test runner.** The Optimizer tab's rendering, the shared label map and the usage input are covered by `tsc --noEmit` and a production `vite build` only. Standing one up is a new track (G11) and was not taken. The label map's *logic* is exercised server-side by `shared-routes.test.ts`'s enum rejection; its *render sites* are evidence by inspection: `ResultsDisplay.tsx:88` and `Optimizer.tsx:157`. |
| 5 | **`/api/optimize` still reads no `X-Session-Id`.** Unchanged by this block and untouched deliberately — it is C8/F1 territory, access control rather than provenance. |
| 6 | **The figure validator is strict and will produce occasional false 502s** — prose saying "24 hours" is rejected when 24 is not among the figures. Deliberate, documented in the module header and in the block file's failure modes, and the correct direction to fail. If the observed 502 rate is material after merge, the fix is a wider *input* (state more figures), never a looser check. |
| 7 | **Out of scope, untouched, separate ticket:** the typed 502/503 transport-path error handling for the LLM call and its missing tests. A provider outage still lands in the generic `catch` and returns a 500. |
| 8 | **C7 should be marked closed by this block in H1c's inventory.** The collision reads *"do not fix it early; it needs `simulate8760()` extracted (2.11) first"*; that premise did not hold for a closed-form sizing that consumes the existing NASA path and extracts nothing. C7's deferral stands as written for the 8760-based optimizer it describes. |

---

## RULING

**Gate H-OPT: CLOSED (self-ruled, §14.2).**

| # | Criterion | Ruling |
|---|---|---|
| i | Optimize calls NASA; its figure equals calculate's for the same place | **PASS** — asserted equal in one test, both from one fixture |
| ii | `-999` is a typed 422 on the optimize path, never a number | **PASS** — 422 `nasa_fill_value`, no `optimalPv`, and **no model call** |
| iii | Mutation: re-hardcoding irradiance and dropping the NASA call must kill tests | **PASS** — 8 and 17 killed; two further mutations killed 5 each |
| iv | Sizing is a pure function; the numbers are the fence's formulas | **PASS** — 17 hand-computed unit tests |
| v | Load from `annualUsageKwh`, not 102 | **PASS** — scaling the shape ×100 changes nothing; a missing usage is a 400 |
| vi | No figure in the prose that was not in its input | **PASS** — both directions, plus a route 502 |
| vii | The 200 carries `resolution` and the tab renders it | **PASS** — asserted in the route test; render site read for G7 |
| viii | Full suite green, root typecheck clean, CI green on the pushed branch | **PASS locally** — 199/199, typecheck clean, both shipped artifacts build. CI result appended below. |
| G8 | Rollback | **Tier B** — applies cleanly, tree byte-identical to `main`; deploy path **UNPROVEN**, A13's debt carried |

**What closes it.** The optimizer's figures now come from the same satellite data, through
the same parse boundary, as the calculator's — proven by a mutation that kills eight tests
written before this block, which is a stronger statement than any assertion that the two
agree. The model's contribution is a string, and a string containing a number nobody gave
it is refused.

**What it does not close.** Nothing is deployed, so nothing about this is live; (viii)'s
live half and every row above are true of the branch, not of production. The merge is the
operator's under §14.2, and the deploy-path rollback debt from A13 is carried into it
unchanged.

---

## CI

`heatshield/opt-grounded` pushed to `origin`. Run and result appended below on completion.
