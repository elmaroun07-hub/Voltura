# Block H-OPT — merge to `main`

| | |
|---|---|
| **BLOCK / GATE** | H-OPT / merge |
| **DATE** | 2026-09-11 |
| **COMMIT (before)** | `c459b0d` |
| **MERGE COMMIT** | **`4afdf95`**, two parents (`c459b0d`, `8ccde3b`) — `--no-ff` per G2 |
| **AUTHORISED BY** | Operator, 2026-09-11, §14.2 (*"any merge to `main`"*) |
| **RULING** | **CLOSED** — merged, pushed, CI green, deployed and proven deployed, four live probes run. One **live finding**: a ~12-minute geocoder outage, not caused by this block's code, self-healed, cause never established. See below. |

---

## MERGE

```
git checkout main                                  # c459b0d
git merge --no-ff heatshield/opt-grounded          # 4afdf95
git push origin main                               # c459b0d..4afdf95
```

Two parents confirmed on the object, so `git revert -m 1 4afdf95` has a mainline to pick.
A fast-forward would have produced no merge commit and silently broken the rollback (G2).

Push window: **2026-09-11T10:39:14Z → 10:39:18Z**, one push, 6 commits.

**CI on `main`:** run
[34590269571](https://github.com/elmaroun07-hub/Green-Energy-Calc/actions/runs/34590269571),
head `4afdf95` — **success**, both jobs (`test`, `build`).

---

## DEPLOY — and the proof it is the deployed code

**§2 / A2 — auto-deploy state, re-confirmed at this merge gate as §2 requires.** Not taken
on assertion and not read off a dashboard, which a coding session cannot see. **Observed:**
both container shas moved to the merge commit within minutes of one push.

| Service | Marker | Before | After | Observed |
|---|---|---|---|---|
| `voltura-api` | `GET /api/version` → `RENDER_GIT_COMMIT` | `c459b0d` | **`4afdf95`** | 10:40:39Z, 81s after the push |
| `voltura-web` | `<meta name="build-sha">` | — | **`4afdf95`** | 10:42Z |

```
{"sha":"4afdf95","shaFull":"4afdf95d1c7a752b223cbae46f2f62c9566678f8","source":"render"}
<meta name="build-sha" content="4afdf95" />
```

**A20's rule applied: the sha alone is not the evidence.** 81 seconds is fast for a build,
so the deployed code was proven **behaviourally** as well. The byte-identical request that
returned `HTTP 200` and a fabricated recommendation 15 minutes before the merge:

| | Before (`c459b0d`, 10:2xZ) | After (`4afdf95`, 10:41Z) |
|---|---|---|
| `POST /api/optimize` `{"location":"Fuengirola, Spain","energyPattern":[1,2,3]}` | **200** — `optimalPv:1500`, *"about 5 kWh/m²/day"*, *"the 6 kWh daily demand"* | **400** — `{"message":"energyPattern must carry one weight per hour of the day","field":"energyPattern"}` |

The model-sourced figures are gone from that path, and the input contract rejects the body
that produced them. That is the deployed code changing behaviour, not a version string
changing value.

**This is A13 Tier-C territory in one direction only.** One push, one deploy per container,
declared here as **two production deploys** (`voltura-api` and `voltura-web`), window
10:39:18Z–10:42Z. Nothing was reverted, so the deploy *path* still has not carried a
rollback.

---

## ROLLBACK — still Tier B, still UNPROVEN

```
git revert -m 1 4afdf95
```

Proven at Gate H-OPT on `scratch/h-opt-revert-proof`: the revert applies cleanly, inverts
exactly this block's 15 files / 2190 insertions / 285 deletions, and leaves a tree
**byte-identical to the pre-merge `main`**. That proof was computed against merge `471ca09`
on the scratch ref; `4afdf95` is the same two-parent merge of the same branch onto the same
base, so the mainline and the diff are identical.

**The deploy path remains UNPROVEN.** No rollback of this block has been pushed, and a
revert on `main` is now demonstrably a production deploy — this merge just measured it at
81 seconds. A13's debt stands, carried forward unchanged, and A16 makes omitting this line
the breach rather than the missing drill. **No drill was authorised and none was run.**

---

## LIVE FINDING — the geocoder is failing in production, for every location, on both routes

The operator's requested probes (Tétouan, Fuengirola, Paris, London — 5,000 kWh/year, one
shared 24-hour pattern) **could not be completed**. All four return:

```
HTTP 422
{"message":"We could not locate that place...","code":"geocode_failed","field":"location",
 "resolution":{"geocodeStatus":"failed","lat":null,"lon":null,
               "irradianceSource":"not-reached","nasaHttpStatus":"not-called", ...}}
```

### It is not this block, and the evidence is not an assertion

| # | Evidence |
|---|---|
| 1 | **`/api/calculate` fails identically.** `{"location":"Paris, France", ...}` → `422 geocode_failed`. That route's geocoding behaviour is untouched by H-OPT. |
| 2 | **`geocode()` is byte-for-byte unchanged across the merge.** `git show c459b0d:…routes.ts` and `git show 4afdf95:…routes.ts`, the function body diffed: **identical**. H-OPT moved the *call site* into `resolveLocationIrradiance()`; the URL, the User-Agent, the 6s timeout and the null-on-failure contract are the same bytes. |
| 3 | **Nominatim answers 200 for the same query from a different origin.** `GET nominatim.openstreetmap.org/search?q=Paris%2C%20France&…` with the same `User-Agent: GreenEnergyCalculator/1.0` → **HTTP 200** from the executor's machine, at the same minute the container was failing. |
| 4 | **It worked in production yesterday.** Gate H1 (`contracts/rulings/h1-gate-h1.md`, 2026-09-10) records two live 200s that each required a successful geocode at `c459b0d`: criterion (iv), Fuengirola → `nasa-live` / `{2019,2023}` / twelve months, and 1.5, Indianapolis → `carbonIntensity 0.386`. |
| 5 | **Every location fails, not a class of them.** `Paris`, `Madrid, Spain`, `Berlin, Germany`, `Almeria, Spain` — plain ASCII, no accents, no ambiguity — all `geocode_failed`. |

**The gap in that evidence, reported against the executor rather than discovered later.**
`/api/calculate` was **not probed immediately before the merge**. Yesterday's Gate H1
evidence is a day old and came from a different container instance. So the code is
exonerated by (2) and (3) — `geocode()` is the same bytes and the same query succeeds from
another origin — but one hypothesis survives that the merge would be the **trigger** for
without being the **cause**: the 10:39 deploy replaced the container, and the replacement
may sit behind an egress IP Nominatim refuses where its predecessor did not. That cannot be
settled from here, and it is the reason the next line is a hypothesis rather than a finding.

**What would settle it, and who can do it.** A plain redeploy of `voltura-api` with no code
change: if geocoding returns, the egress-IP hypothesis is confirmed and the fix is an IP
Nominatim will serve (or a geocoder that does not police by IP); if it does not, the cause
is elsewhere. That is an operator action on the Render dashboard, not a coding-session one.
Render's logs were not read: `geocode()` swallows the status with a bare `return null` and
logs nothing, so no log line exists to find, and the MCP requires an operator to name a
workspace before anything is queried.

Taken together: an **egress-side** failure between the Render container and Nominatim,
first observed 2026-09-11T10:41Z, whose **cause is not in this block's diff**. The leading
explanation is Nominatim's usage policy applied to a shared cloud egress IP (403/429),
which `geocode()` converts to `null` and the route converts to `geocode_failed`. **That is
a hypothesis, not a finding**, and the section above says exactly which observation is
missing to settle it.

### Why the cause cannot be named from the response — §6's trace rule, live

`geocode()` returns `null` for every failure mode it can meet:

```ts
if (!res.ok) return null;          // 403, 429, 500 — all the same null
if (!data.length) return null;     // a real "no such place" — also null
} catch { return null; }           // DNS, TLS, the 6s timeout — also null
```

and `resolution` carries `geocodeStatus: "failed"` with nothing else. So the provenance
record **cannot distinguish "Nominatim blocked us" from "that place does not exist"**, and
a user typing a real city sees copy telling them to check their spelling.

This is exactly the failure §6's trace rule predicts: *"Before adding a diagnostic field,
ask: what does this field look like when the thing it monitors is broken? If the answer is
'the same', the field is useless."* `geocodeStatus: "failed"` looks identical for a typo
and for an outage. The NASA path was given `nasaHttpStatus` and `nasaKeysPresent` for this
reason; the geocode path never was.

**Raised as a task, not fixed here** — it is outside H-OPT's fence, it touches the shared
`geocode()` both routes depend on, and inventing the fix inside a merge ruling is how
scope leaks. Proposed shape, for whichever block takes it: a `geocodeFailure` discriminant
on the resolution record — `http` (with status), `timeout`, `request-failed`, `no-match` —
and user copy that only says "check the spelling" for `no-match`. Same three-way split the
NASA boundary already makes between DATA and TRANSPORT defects.

### Resolved — it was transient, and it healed itself

A retry watch ran `/api/calculate` every 90 seconds from 10:42:58Z. Seven consecutive
failures, then:

```
10:43:00Z attempt 1 -> still geocode_failed
...
10:52:13Z attempt 7 -> still geocode_failed
10:53:45Z attempt 8 -> GEOCODE RECOVERED
```

**Outage window: roughly 10:41Z to 10:53Z, about twelve minutes, beginning minutes after
the deploy and ending with no intervention.** No redeploy was performed and no
configuration was touched.

That last fact re-weights the hypotheses rather than confirming the one offered above. A
new container permanently behind an egress IP Nominatim refuses would **not** heal on its
own; something that releases after ~12 minutes looks like a temporary upstream refusal or
rate-limit window, or a transient egress condition on a freshly started instance. **The
cause is still not determinable from outside the container**, for the reason in the next
section: the code records no status for it. The operator redeploy test proposed above is no
longer needed — the condition has cleared — but nothing has been learned about why, and it
will not announce itself next time either.

**The merge was not implicated and was not reverted.** Reverting would have restored an
optimizer that fabricates irradiance and would not have restored geocoding — during the
window `/api/calculate` was 422ing too, on code this block did not change.

---

## RESIDUE

| # | Item |
|---|---|
| 1 | **The geocoder outage cleared on its own and its cause was never established.** It will recur without warning and, until residue 2 is fixed, will present to users as "check the spelling". |
| 2 | **`geocodeStatus` cannot express the failure it exists to detect.** §6 trace-rule violation on a path that predates this block. Needs a home in a future block's fence. |
| 3 | **Nominatim has no rate-limit handling, no retry, no cache and no second source.** P5 says "one geocoder", which this honours, but one geocoder with no fallback is also a single point of failure for every number the product computes. An architectural question for the operator, not a code task to slip into a ruling. |
| 4 | **A13's deploy-path rollback debt is carried, not discharged.** This merge proved the deploy path is 81 seconds long in the forward direction and still never exercised it backwards. |
| 5 | The Gate H-OPT residue list (`contracts/rulings/h-opt-gate.md`) carries forward unchanged: three pre-existing G5 `\|\|` defaults, no web test runner, `gate-check.sh` not completing locally, the strict figure validator's false-502 trade, and the out-of-scope LLM transport-path error handling. |

---

## RULING

**Block H-OPT: MERGED. `main` is `4afdf95`.**

| Criterion | Ruling |
|---|---|
| `--no-ff`, two parents, revert has a mainline | **PASS** |
| CI green on `main` | **PASS** — run 34590269571, both jobs |
| Deployed, and proven to be the deployed code | **PASS** — both shas at `4afdf95`; the pre-merge request that returned a fabricated 200 now returns a typed 400 |
| §2 auto-deploy re-confirmed at the merge gate | **PASS, observed** — both containers moved on one push; not asserted from a dashboard |
| G8 rollback | **Tier B** — applies, tree byte-identical to pre-merge `main`; deploy path **UNPROVEN**; A13 debt carried |
| Operator's four live probes | **DONE** — run at 10:55Z once the geocoder recovered; numbers below |

---

## LIVE PROBES — four locations, 5,000 kWh/year, one identical 24-hour pattern

Run 2026-09-11T10:55Z against `4afdf95`. `POST /api/optimize`,
`annualUsageKwh: 5000`, `energyPattern` = the web client's standard profile
(`[2,2,2,2,3,5,8,8,6,4,3,3,3,3,4,5,7,10,8,5,3,2,2,2]`) every time. Full raw bodies were
captured; the figures:

| Location | PV kWp | Battery kWh | Irradiance used | coverageTarget | Source / period |
|---|---|---|---|---|---|
| Tétouan, Morocco | **3.371** | 4.1 | **5.08** | **1** | `nasa-live` / 2019–2023 |
| Fuengirola, Málaga, Spain | **3.391** | 4.1 | **5.05** | **1** | `nasa-live` / 2019–2023 |
| Paris, France | **4.935** | 4.1 | **3.47** | **1** | `nasa-live` / 2019–2023 |
| London, United Kingdom | **5.651** | 4.1 | **3.03** | **1** | `nasa-live` / 2019–2023 |

All four: `HTTP 200`, `geocodeStatus: "resolved"`, `nasaHttpStatus: 200`,
`nasaKeysPresent` equal to `nasaKeysRequested`, twelve monthly values,
`irradiancePeriod {2019, 2023}`.

**Against the defect this block was opened for:**

| | Model, before | Computed, now |
|---|---|---|
| Tétouan irradiance | ~5.5 | **5.08** |
| Fuengirola irradiance | ~4.5 | **5.05** |
| Coverage target | 100 / 100 / 88 / 40 % — varying silently by location | **1.00 everywhere** |
| PV size | 20,000–30,000 W | **3,371–5,651 W** |

**London is the sharpest result.** The old output gave it the *smallest* coverage, 40%. The
honest answer is that London needs a **67% larger array than Fuengirola** for the identical
household — 5.651 kWp against 3.391 — because its irradiance is 3.03 against 5.05. The
model was shrinking precisely the array that most needed growing.

The battery is 4.1 kWh at all four sites, which is correct and worth stating so it is not
read as a stuck value: it is sized from the night load, and the load, the profile and the
dark-hour count are identical across the four runs. Only the array moves with location.

**The strict figure validator produced no false 502s across four calls.** Every explanation
quoted only figures from its own input — including the ratios in both renderings, e.g.
*"performance ratio of 80% (0.8)"* and *"coverage target of 1 (100%)"*, which is what the
dual percent/ratio line in the facts was for. Four calls is not a rate; it is one
encouraging data point against the known trade recorded at Gate H-OPT.

---

**The rollback target moves: `4afdf95`, not `c459b0d`.** §2's table and A12's supersession
both need this folding in when §2 is next revised.
