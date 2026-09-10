# Gate H1 — Truth · week 2

**Status: NOT CLOSED — held open on (iii) and (iv) alone.**

Every criterion obtainable without a running server is met or properly deferred. (ii),
which failed its first re-verification, is now met on A20's evidence. What remains is live
proof, and nothing is serving the merged code: Render is unpaid. That is a billing state,
not a code state, and G12 does not let it be assumed away — evidence comes from the live
server, not from local assumption.

| | |
|---|---|
| Block | H1 (`contracts/blocks/h1.md`) |
| Branch | `heatshield/h1` @ `c261620159a09ec95312a138d30fcff6f2c5e979` |
| Code merge | `eb45faf06518a5cecd7e6ff5e8a98c1a4d18bfa2` — `--no-ff`, per G2 |
| `main` before | `0a9c24e61bf0e4d39291bbcd5489c3450474f051` |
| A20 + fixture test | `53ff2cb09949d969b3102ed20a24fd36382be6bf` on `heatshield/h1-gate-ruling` |
| Ruling merge | `5f08fba03d4fa8a16629c2b2ced2751149ae0c55` — `--no-ff`, carries A20's extraction into `main` |
| First ruled | 2026-09-10 (local, +0100) — NOT CLOSED, (ii) unmet |
| Re-ruled | 2026-09-10, after A20 |
| Ruled by | Executor, under operator authorisation given in session. Merge, file deletion and amendment are operator-only under §14.2; each was authorised explicitly before execution. |
| Pushed | **No.** Local only. |

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

**A20 lands on top of this merge, not inside it.** `53ff2cb` adds the fixture test and
factors two pure functions out of `routes.ts`; the deployed sha to check at (iii) is
therefore whatever `main` carries once the ruling branch is folded in, **not** `eb45faf`.

**Full suite green**, at `53ff2cb`:

| Package | Result |
|---|---|
| `artifacts/api-server` | 8 files, **64 passed**, 0 failed (59 before A20, +5) |
| `lib/cte` | 2 files, **72 passed**, 0 failed |
| Total | **136 passed** |
| `tsc -p tsconfig.json --noEmit` | clean |

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

## Gate H1 — five criteria (A18, as amended by A20)

### (i) Fill value rejected at the parse boundary, mutation-tested — **PASS**

The guard is `classifyNasaValue` in `artifacts/api-server/src/routes/routes.ts`, called by
`readNasaSeries` — the single parse boundary A11 required:

```ts
if (value === NASA_FILL_VALUE) return { kind: "fill" };   // NASA_FILL_VALUE = -999
```

Compared exactly, not by threshold, and reached by every value NASA sends — one site, not
per-call-site. A20 moved these three checks out of the loop body verbatim; `readNasaSeries`
now calls the function rather than inlining it, and the route tests that pin the old
behaviour by exact substring all still pass, which is what makes the extraction provably
behaviour-preserving rather than merely intended to be.

**Mutation executed (G9), twice — before A20 and after.**

| | Before A20 | After A20 |
|---|---|---|
| Baseline | 59 / 59 | 64 / 64 |
| Under mutation | **3 failed** — the A3.6 route cases | **4 failed** — the same three, plus `filters every -999 the response actually carries` |
| Restored | 59 / 59, file byte-identical | 64 / 64, guard line restored verbatim |

The third A3.6 case fails on
`expect(r.body.resolution.irradianceSource).not.toBe("nasa-live")` — with the guard
disabled, `-999` is consumed and presented to the user as live NASA data. That is the
defect, observed rather than asserted.

### (ii) The guard runs against a **real** NASA fill value — **PASS, on A20's terms**

**This criterion failed its first re-verification and was the sole reason the gate did not
close on 2026-09-10.** A18 recorded it satisfied on the stated fact that a test consumes
`contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json`. No test did: five
references to that path existed in the repository and all five were contract prose. The
`-999` A3.6 rejects is written by the test itself at run time — synthetic, which is the one
thing (ii) exists to exclude.

The cause was structural, not neglect: the fixture is a **daily** response keyed
`20260821`, and production calls the **monthly** endpoint keyed `202608`. It cannot be fed
to the route unedited, and editing it to fit destroys the property being claimed.

A20 rules the criterion, not the task, and forbids the tempting fix. **Production stays
monthly-only** — a daily parse would add a surface the `-999` family can re-enter through.
The boundary is factored instead, so the guard itself can be pointed at the real bytes.

Evidence — `artifacts/api-server/src/routes/nasa-fillvalue-fixture.test.ts`, 5 cases, green:

| Assertion | Result |
|---|---|
| Fixture read as bytes and hash-pinned, `sha256 c526b22e…ce2706` | Passes. Reshaping the file into monthly keys, or trimming its `-999` days, now **fails the test** instead of silently making the claim false |
| NASA's own header declares the sentinel — `fill_value: -999.0`, `POWER Daily API` | Passes. The response says what `-999` means; the test does not assert it into being |
| Every key matches `^\d{8}$` | Passes — the daily/monthly shape conflict, pinned in code rather than only in prose |
| The four real fill values, located **independently of the guard** and pinned exactly: `ALLSKY_SFC_SW_DWN` at `20260821`, `20260822`, `20260823`; `T2M` at `20260823` | Passes |
| Each classifies as `fill`, and none carries a `value` | Passes — **every `-999` the response actually carries is filtered** |
| The 18 readings NASA did supply all classify as `value` | Passes — over-rejection, a working month discarded as a sentinel, would be its own defect |
| A `fill-value` failure built from the fixture's own parameter and keys → `nasaDataFailureToHttp` | **422**, `nasa_fill_value`, message naming `-999`, naming `20260821, 20260822, 20260823`, and stating no figure can be computed. A typed error, never a substitution |

**G10 holds absolutely.** The test reads one local file and calls two pure functions. No
server, no fetch, nothing to leak.

The synthetic injection at `calculate.test.ts:259` remains, as A20 directs — an additional
case, not (ii)'s evidence.

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

Passes when `shaFull` equals what `git rev-parse main` reports at push time — the merge of
`heatshield/h1-gate-ruling`, since A20's guard extraction sits there and not in `eb45faf` —
and `source` is `"render"`. Fails if `sha` is non-null but does not match: that is a stale
container, the exact condition A12 recorded as unprovable before this endpoint existed.

### (iv) Live multi-year 2019–2023 response — **static PASS, live PENDING-VERIFICATION**

The period is a parameter with a stated default (`NASA_PERIOD_START = 2019`,
`NASA_PERIOD_END = 2023`), reported in the response as `resolution.irradiancePeriod`, never
hardcoded at a call site.

Partial coverage is a typed 422 naming **months covered of months expected**, not a shorter
mean quietly relabelled. Since A20 the wording is built by `nasaDataFailureToHttp`:

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

Recorded as deferred, never as met. A19's blocking condition was re-checked and still
holds:

- `lib/db/src/schema/schema.ts` — the `calculations` row carries **no** provenance column.
  No source, no year, no period.
- The PDF footer prints no irradiance claim in either direction, and the comment in place
  states why: the row carries no provenance, so the PDF cannot know whether the figures
  came from NASA or the latitude fallback, and naming a year it cannot verify "would read
  as a verified fact on the artefact most likely to be forwarded onward."

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

### Second Tier-B proof — the ruling merge

**The ruling merge ships production code too**, and a ruling that proved only the first
merge would leave exactly the kind of hole A16 was written to close. `5f08fba` carries
A20's extraction of `classifyNasaValue` and `nasaDataFailureToHttp` out of `routes.ts`,
not only documents, so G8 binds it in its own right.

Proved the same way, on its own scratch ref, never pushed:

```bash
git branch scratch/h1-ruling-revert-proof 5f08fba
git checkout scratch/h1-ruling-revert-proof
git revert -m 1 5f08fba --no-edit      # -> 34c2e6017ea85e68411b49e32b2e9b5395009b6f
```

| Check | Result |
|---|---|
| Revert applies | Cleanly, exit 0, no conflict |
| Revert diffstat | **4 files changed, 28 insertions(+), 636 deletions(-)** — the exact mirror of the merge |
| Reverted tree vs `eb45faf` | **Identical.** `tree(eb45faf)` = `tree(34c2e60)` = `372125c94b5e58362451f4fcac087333168cc5a5`; `git diff eb45faf 34c2e60` is empty |
| Lands on | The H1 code merge, guard intact — reverting the ruling merge undoes A20's extraction and its test, and leaves the block's own `-999` rejection standing |

Scratch ref retained locally at `34c2e60`, **unpushed**, on the same terms as the first:
evidence, not a rollback anyone should run from.

**Ordering, because the two are not independent.** Reverting `eb45faf` alone would leave
`53ff2cb`'s test pointing at functions its parent no longer defines. A rollback of H1 as a
whole reverts the ruling merge **first**, then the code merge. Reverting only the ruling
merge is coherent on its own; reverting only the code merge is not.

**Both merges are UNPROVEN on the real deploy path.** Two Tier-B proofs are still two
halves of the same half. Neither `f69673f` nor `34c2e60` has been pushed, deployed, or
served, and the debt below covers both.

### The deploy path is UNPROVEN

**This is a Tier-B ruling and Tier B is not a pass.** What is proven here is git mechanics,
twice: that `git revert -m 1` targets exactly the code merge's 30 files and 2,785 changed
lines, and exactly the ruling merge's 4 files and 664 changed lines, each leaving
everything else standing. What is not proven, for **either** merge, is the half that
matters — **a production instance actually going back**. No deploy was performed, none was
authorised, and nothing is serving either merge tonight in any case.

**A13's standing debt is carried forward unchanged, not dissolved by this ruling.** A real
rollback is a push that deploys; that has never been exercised, on this block or any other.
The debt stands until one deploy-path rollback is executed deliberately under Tier C. Per
A16, a Tier-B ruling that omits this line is not closed at all — the omission is the
breach, not the missing drill.

**Rollback command, for the record**, to be run only against a pushed merge and declared as
a production deploy with its window stated (A13), never described as local:

```bash
git revert -m 1 5f08fba03d4fa8a16629c2b2ced2751149ae0c55   # ruling merge, first
git revert -m 1 eb45faf06518a5cecd7e6ff5e8a98c1a4d18bfa2   # code merge, only with the above
```

---

## Outcome

**Gate H1: NOT CLOSED. Held open on (iii) and (iv) only.**

| # | Criterion | Ruling |
|---|---|---|
| i | Parse-boundary rejection, mutation-tested | **PASS** — mutation kills 4 |
| ii | Real NASA fill value, not synthetic | **PASS**, on A20's amended terms |
| iii | `/api/version` proves the deployed code | Static PASS · **live PENDING-VERIFICATION** |
| iv | Live multi-year path | Static PASS · **live PENDING-VERIFICATION** |
| v | PDF half of 1.8 | **DEFERRED** (A19) |
| G8 | Rollback | **Tier B, both merges** — `eb45faf` → `f69673f`, `5f08fba` → `34c2e60`; each applies cleanly; deploy path **UNPROVEN** for both; A13 debt stands |
| 1.3 | Four files deleted | **Verified by absence**, 2026-09-09T23:58:14Z |

What changed since the first ruling is (ii), and it changed on evidence rather than on
argument: a test that reads the real bytes, pinned by hash, and dies if the guard does.
What has not changed is that two criteria demand a live server and there is none. Under
G12 that cannot be assumed away, and A18 wrote (iii) and (iv) precisely because live proof
was the thing missing before.

**Nothing is pushed.** The operator pushes after the Render bill is paid:

```bash
git push origin main
```

Then (iii) and (iv) become runnable, this ruling is amended with their results, and the
gate closes or does not on what the server actually returns.
