# Gate H1 — Truth · week 2

**Status: NOT CLOSED.** Four of five criteria are met, deferred, or pending live
verification. **Criterion (ii) is unmet** — see below. The merge was operator-authorised
and stands; the gate does not close on it.

| | |
|---|---|
| Block | H1 (`contracts/blocks/h1.md`) |
| Branch | `heatshield/h1` @ `c261620159a09ec95312a138d30fcff6f2c5e979` |
| Merge | `eb45faf06518a5cecd7e6ff5e8a98c1a4d18bfa2` — `--no-ff`, per G2 |
| `main` before | `0a9c24e61bf0e4d39291bbcd5489c3450474f051` |
| Ruled | 2026-09-10 (local, +0100) / 2026-09-09T23:58Z |
| Ruled by | Executor, under operator authorisation given in session. Merge and file deletion are operator-only under §14.2; both were authorised explicitly before execution. |
| Pushed | **No.** Local only. `main` is ahead of `origin/main` by 6 commits, unpushed. |

---

## Merge record

`git merge --no-ff heatshield/h1` into `main`. No conflicts. Parents `0a9c24e c261620`.

**30 files changed, 2631 insertions(+), 154 deletions(-).**

```
A  .github/workflows/ci.yml
M  HEATSHIELD_CONTRACT.md
A  artifacts/api-server/src/lib/carbon-intensity.ts
A  artifacts/api-server/src/lib/carbon-intensity.test.ts
M  artifacts/api-server/src/routes/calculate.fixtures.json
M  artifacts/api-server/src/routes/calculate.test.ts
M  artifacts/api-server/src/routes/health.ts
M  artifacts/api-server/src/routes/routes.ts
A  artifacts/api-server/src/routes/version.test.ts
M  artifacts/api-server/src/shared-routes.ts
M  artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx
M  artifacts/green-energy-calculator/src/lib/api.ts
A  artifacts/green-energy-calculator/src/locales/{README.md,ar.json,en.json,es.json}
M  artifacts/greencalc/static/lang/{ar,en,es}.json
M  artifacts/greencalc/templates/{base,index,model_info}.html
M  contracts/AMENDMENTS.md
M  contracts/blocks/h1.md
M  contracts/rulings/h-s-gate-h-s.md
A  contracts/rulings/h1-claims-inventory-in-repo.md
A  docs/VOLTURA-GROUND-TRUTH.md
M  gate-check.sh
M  lib/cte/src/cte-zones.ts
M  lib/db/src/schema/schema.ts
```

**Full suite green** at the merge commit, both packages that carry tests:

| Package | Result |
|---|---|
| `artifacts/api-server` (`pnpm test` → `vitest run`) | 7 files, **59 passed**, 0 failed |
| `lib/cte` (`pnpm test` → `vitest run`) | 2 files, **72 passed**, 0 failed |
| Total | **131 passed** |

---

## Task 1.3 — verified by absence

1.3 deletes four files that live in the **parent of the repository**, so completing it
produces no commit, no diff and nothing a later `git grep` can confirm. **This ruling is
the only record.** It is written as an observation the executor made, not as a claim
relayed from the operator.

The executor deleted the four files under explicit operator authorisation given in session
on 2026-09-10, having twice reported them present and declined to record them as deleted
while they were not. Recorded here as verified-by-absence on the date of observation.

**Before** — `ls -la --time-style=long-iso ~/Desktop/Desktopdev/`, observed
2026-09-09T23:57:54Z. All four present, all mtimes unchanged since June, i.e. untouched
since long before this block opened:

```
-rw-r--r-- 1 elmar 197609 2382 2026-06-21 17:53 NASA_CACHE_deploy.md
-rw-r--r-- 1 elmar 197609 2815 2026-06-21 17:53 POSTGRES_SWAP_deploy.md
-rw-r--r-- 1 elmar 197609 2345 2026-06-21 17:53 RATELIMIT_deploy.md
-rw-r--r-- 1 elmar 197609 5292 2026-06-21 17:51 VOLTURA_fix3b_fix6_patch.md
```

sha256, recorded before deletion so the files stay identifiable if a copy is ever found:

```
9e18e1fe93ce6ea21afd0825953ac16be8cacdba418f0e99bfc313a56ed375ca  NASA_CACHE_deploy.md
f5a965593d1dea0a02968283c7465c00e435ec1b3999c55d0ed5032914c3ab26  POSTGRES_SWAP_deploy.md
d1ff3ade51cba1a6bb86e786d08ba5ac6f25d0f6db342780199eaafc61573635  RATELIMIT_deploy.md
1741d24b2863049c3f1f750ec3696106057be70a4fef6b5db35413dffa42a689  VOLTURA_fix3b_fix6_patch.md
```

**After** — same directory, observed 2026-09-09T23:58:14Z. Each of the four probed
individually with `[ -e ]`; the pattern listing returns nothing:

```
ABSENT: NASA_CACHE_deploy.md
ABSENT: POSTGRES_SWAP_deploy.md
ABSENT: RATELIMIT_deploy.md
ABSENT: VOLTURA_fix3b_fix6_patch.md
```

None was tracked by this repository (`git ls-files` matched none of them before deletion),
so no commit carries their removal and none is recoverable from git.

**Also deleted, at operator instruction, not part of 1.3:**
`0001-feat-api-web-AI-Assistant-Optimizer-on-Mistral-chat-.patch` at the repo root —
10949 bytes, mtime 2026-07-20 19:33, sha256
`6398f4a58dbcb8e50ae92c32599df1e5eadedabfc4345e45a697d4479c18b7ab`. Untracked. The
operator's stated ground was that the Mistral swap is already in the tree and the patch is
spent; the executor did not independently verify that the patch's content is fully present
in the tree. It was the only thing standing between `git status` and clean.

---

## Gate H1 — five criteria (A18, as tabled in `contracts/blocks/h1.md`)

### (i) Fill value rejected at the parse boundary, mutation-tested — **PASS**

The guard is `artifacts/api-server/src/routes/routes.ts:248`, inside the single parse
boundary A11 required:

```ts
if (value === NASA_FILL_VALUE) { fillHits.push(key); continue; }   // NASA_FILL_VALUE = -999
```

Compared exactly, not by threshold, and reached by every value NASA sends — one site, not
per-call-site.

**Mutation executed (G9), not recalled.** Line 248 replaced by a comment, reintroducing
acceptance. One-line diff, confirmed by `git diff --shortstat`.

| | Result |
|---|---|
| Baseline | 59 passed / 59 |
| Under mutation | **3 failed** / 59 — all three of `A3.6 — the -999 fill value is rejected, never consumed` |
| Restored (`git checkout --`) | 59 passed / 59; file byte-identical to the pre-mutation copy |

The three killed tests are exactly the three A18 predicted, and the third fails on
`expect(r.body.resolution.irradianceSource).not.toBe("nasa-live")` — with the guard
disabled, `-999` is consumed and presented to the user as live NASA data. That is the
defect, observed rather than asserted.

### (ii) The guard runs against a **real** NASA fill value — **NOT MET**

A18 and `h1.md` both record this as provable because
`contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json` "is an unedited live
response carrying `-999`" and "the test consumes the fixture, never the network."

**The fixture exists and is real. No test consumes it.**

| Check | Result |
|---|---|
| Fixture present, 982 bytes | Yes — header `"fill_value":-999.0`, three real `-999.0` days in `ALLSKY_SFC_SW_DWN` (20260821–23) and one in `T2M` (20260823) |
| `git grep "contracts/fixtures"` across all tracked files | 5 hits, **all in `contracts/` prose** — AMENDMENTS.md, h1.md, h-r-gate-r.md. Zero in `artifacts/`, `lib/`, `scripts/` |
| `git grep -i "fillvalue\|20260813"` outside `contracts/` | **Zero hits** |
| `-999` inside `artifacts/api-server/src/routes/calculate.fixtures.json` | 4 hits, **all the declarative `"fill_value": -999` header field**. No data month in any of the four cities carries one |
| How A3.6 obtains its `-999` | Injected at runtime by the test: `nasa.properties.parameter.ALLSKY_SFC_SW_DWN["202108"] = -999` (`calculate.test.ts:259`, `:279`, `:293`) |

So the value the guard is proven against is **synthetic** — which is the precise thing
criterion (ii) exists to exclude.

**Why it was probably never wired.** The saved fixture is a **daily** response
(`temporal/daily`, keys `20260813`…). The parse boundary calls the **monthly** endpoint —
`routes.ts:314`, `https://power.larc.nasa.gov/api/temporal/monthly/point` — whose keys are
`YYYYMM`. The fixture cannot be dropped into the monthly path without reshaping it, and
reshaping it makes it edited, which is what (ii) forbids. This is a real shape conflict in
the criterion, not an oversight in the code.

**This does not weaken (i).** The guard is an exact `=== -999` comparison at a single
boundary; a real `-999.0` and an injected `-999` are the same double. What is missing is
the *evidence* the criterion demands, and A7's standing rule — do not present one kind of
proof as another — is why it is recorded unmet rather than argued past.

**Two honest routes, both operator-ruled, neither taken tonight:**

1. Wire a test that consumes the fixture unedited through a daily-shaped parse, if the code
   is ever given one.
2. Amend the criterion, as A18 amended its own predecessor, to state that the fixture
   proves the fill value's *reality and format* while the mutation test proves *rejection*
   — a task-defect ruling on a criterion whose evidence the code's shape cannot supply.

Until one of those happens, **Gate H1 does not close.**

### (iii) `/api/version` reports the deployed sha — **static PASS, live PENDING-VERIFICATION**

Implemented at `artifacts/api-server/src/routes/health.ts:29`. Reads
`process.env.RENDER_GIT_COMMIT` at request time rather than baked in at build, so it
reports the container and not the compile. Absent means absent: `sha: null`,
`source: "unknown"` — no placeholder, no zero sha. 4 tests in `version.test.ts`, green.

**Live half cannot run.** Render is unpaid; nothing is serving the merged code. Not a pass
and not a failure — the evidence is unobtainable tonight for a billing reason, not a
technical one.

Run once serving resumes, after the push:

```bash
curl -s https://voltura-api.onrender.com/api/version
```

Passes when `shaFull` equals the sha `origin/main` carries after the push
(`eb45faf06518a5cecd7e6ff5e8a98c1a4d18bfa2` if pushed unchanged) and `source` is
`"render"`. Fails if `sha` is non-null but does not match — that is a stale container, the
exact condition A12 recorded as unprovable before this endpoint existed.

### (iv) Live multi-year 2019–2023 response — **static PASS, live PENDING-VERIFICATION**

The period is a parameter with a stated default (`NASA_PERIOD_START = 2019`,
`NASA_PERIOD_END = 2023`, `routes.ts:146-147`), reported in the response as
`resolution.irradiancePeriod`, never hardcoded at a call site.

Partial coverage is a typed 422 naming **months covered of months expected**, not a shorter
mean quietly relabelled:

```
NASA POWER covered {monthsPresent} of {monthsExpected} months for {parameter}
over {yearsRequested} year(s) (missing {…}). A mean over fewer years than
requested would misstate the period.
```

Covered by `A3.7`, green: one month deleted → `"59 of 60 months"`; a whole year deleted →
`"48 of 60 months"`, with `savingsKwh` undefined. `code: "nasa_partial_coverage"`,
`irradiancePeriod: null`.

**Live half cannot run**, same reason as (iii). Run once serving resumes:

```bash
curl -s -X POST https://voltura-api.onrender.com/api/calculate -H "Content-Type: application/json; charset=utf-8" -H "X-Session-Id: a3a3a3a3-3333-4333-8333-a3a3a3a3a3a3" -d '{"location":"Fuengirola, Málaga, Spain","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
```

Passes on a 200 whose `resolution.irradianceSource` is `"nasa-live"`,
`resolution.irradiancePeriod` is `{"start":2019,"end":2023}`, and
`resolution.irradianceMonthly` has twelve entries.

### (v) 1.8's PDF half shown as DEFERRED — **DEFERRED, per A19**

Recorded as deferred, never as met. A19's blocking condition was re-checked at the merge
commit and still holds:

- `lib/db/src/schema/schema.ts` — the `calculations` row carries **no** provenance column.
  No source, no year, no period.
- `routes.ts:622-630` — the PDF footer prints no irradiance claim in either direction, and
  the comment in place states why: the row carries no provenance, so the PDF cannot know
  whether the figures came from NASA or the latitude fallback, and naming a year it cannot
  verify "would read as a verified fact on the artefact most likely to be forwarded
  onward."

Carried to the first fence granting a migration. **The column, not the renderer, is the
work.** Silence is the honest state until then.

---

## G8 — Tier B (A16)

This block ships code to production and the merge was authorised; **no drill was
authorised**. Tier B applies.

**Revert proven to apply, not executed against anything serving.** Computed on a scratch
ref, never pushed:

```bash
git branch scratch/h1-revert-proof eb45faf
git checkout scratch/h1-revert-proof
git revert -m 1 eb45faf --no-edit      # -> f69673fc7e6972138da9c2645d2cab9d08add4a7
```

| Check | Result |
|---|---|
| Revert applies | Cleanly, exit 0, no conflict |
| Revert diffstat | **30 files changed, 154 insertions(+), 2631 deletions(-)** — the exact mirror of the merge |
| Files touched | 30 — `diff` of the merge's file list against the revert's file list is **empty**. It targets exactly the block's diff and nothing else |
| Reverted tree vs pre-merge `main` | **Identical.** `tree(0a9c24e)` = `tree(f69673f)` = `a9009c0e82de7b816c4d576e1980804cbdcd7909`; `git diff 0a9c24e f69673f` is empty |
| `contracts/` after revert | Standing — 19 files |

Scratch ref retained locally at `f69673f`, **unpushed**. It must not be pushed: it exists
as evidence, not as a rollback anyone should run from.

### The deploy path is UNPROVEN

**This is a Tier-B ruling and Tier B is not a pass.** What is proven here is git mechanics:
that `git revert -m 1` targets exactly this block's 30 files and 2,785 changed lines and
leaves everything else standing. What is not proven is the half that matters — **a
production instance actually going back**. No deploy was performed, none was authorised,
and nothing is serving the merged code tonight in any case.

**A13's standing debt is carried forward unchanged, not dissolved by this ruling.** A real
rollback is a push that deploys; that has never been exercised, on this block or any other.
The debt stands until one deploy-path rollback is executed deliberately under Tier C. Per
A16, a Tier-B ruling that omits this line is not closed at all — the omission is the
breach, not the missing drill.

**Rollback command, for the record**, to be run only against a pushed merge and declared as
a production deploy with its window stated (A13), never described as local:

```bash
git revert -m 1 eb45faf06518a5cecd7e6ff5e8a98c1a4d18bfa2
```

---

## Outcome

**Gate H1: NOT CLOSED.**

| # | Criterion | Ruling |
|---|---|---|
| i | Parse-boundary rejection, mutation-tested | **PASS** |
| ii | Real NASA fill value, not synthetic | **NOT MET** — the fixture is consumed by no test |
| iii | `/api/version` proves the deployed code | Static PASS · **live PENDING-VERIFICATION** |
| iv | Live multi-year path | Static PASS · **live PENDING-VERIFICATION** |
| v | PDF half of 1.8 | **DEFERRED** (A19) |
| G8 | Rollback | **Tier B** — applies; deploy path **UNPROVEN**; A13 debt stands |
| 1.3 | Four files deleted | **Verified by absence**, 2026-09-09T23:58:14Z |

The merge stands — it was authorised in its own right and G2 was satisfied. The gate is a
separate judgement, and it does not close while (ii) is unmet and (iii)/(iv) are unrun.

**Nothing is pushed.** `main` is 6 commits ahead of `origin/main`. The operator pushes
after the Render bill is paid:

```bash
git push origin main
```

Then (iii) and (iv) become runnable, and this ruling is amended with their results.
