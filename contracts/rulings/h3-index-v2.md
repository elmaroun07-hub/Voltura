# H3-INDEX-V2 — a lone certificate no longer replaces the age estimate · Gate H3-INDEX-V2

**BLOCK / GATE:** H3-INDEX-V2 / pre-merge — **OPEN**: every self-ruled criterion passes except two
that cannot run here (the PostGIS integration suite and the local Córdoba run). The merge is
the operator's.
**DATE:** 21 October 2026
**COMMIT (before):** `a5c3df2` (`main`, Merge heatshield/h3-load-pnpm — unchanged by this block)
**BRANCH:** `heatshield/h3-index-v2`. Unmerged, **unpushed**. Pushing is the operator's.
**Block file:** `contracts/blocks/h3-index-v2.md`. It arrived as an untracked file at the
repository root; it was copied into `contracts/blocks/` as §14.1 requires, byte for byte, and
committed with the block.

**Operator rulings carried (block file):** 21 Oct 2026 20:52 option **B**; 20:57 guessed weights
rejected; 21:06 the fix first, k **measured**.

---

## TASKS CLAIMED CLOSED

- **V.1** — `METHOD_V2` (`version: "h3-index-v2"`, `credibility: { estimator: "buhlmann-straub",
  source: … }`), `buhlmannStraub()`, and the new weight
  `w = min(1, entries/dwellings) × entries/(entries + k_band)` in `lib/screening/src/heat-index.ts`.
  The header comment now describes v1, why it failed, and v2. `References.coolingCredibility`
  records k, EPV, VHM, buildings and entries per band. An undefined k (VHM ≤ 0, or no building
  with ≥ 2 entries) throws `IndexInputError` naming the band. `METHOD_V1` is unchanged (deep-equal
  pin) and reproduces a5c3df2's scores bit for bit.
- **V.2** — `lib/screening/src/db/index-db.ts` reads each certificate of the summarised buildings
  (same `source_id` as their `h3_building_epc` row, file order) and turns them into entries with
  `entriesOf()`. That function is the one-per-unit rule, **extracted** from `summariseBuilding`
  rather than copied. It throws unless the entries read equal Σ `h3_building_epc.entries` of
  the scored buildings. The default method is `METHOD_V2`. The run stats add `entries`,
  `entriesWithValue` and `credibility` (k per band), so the `h3-load` log carries the k pins.
- **V.3** — tests, listed under TEST EVIDENCE.
- **V.4** — `docs/heatshield/h3-metodologia-cribado.md` (Spanish): §4.6 row, §4.7 (v1 / v2
  weight, the estimator, the refusal, coverage vs weight), §4.8 (why v1's ranking favoured lone
  certificates), new §5 bis (v2 run: **simulation figures, labelled as such, pending the load**),
  §9 (four rows, dated, who decided).
- **V.5** — this file; **A27** in `contracts/AMENDMENTS.md`.

## FENCE NOTES — read before ruling the merge

1. **`lib/screening/src/epc/summary.ts` was touched** (not on the IN list). The block requires the
   entry selection "reused, not re-implemented"; reuse needs an export. Change: `entriesOf()`
   extracted, `summariseBuilding` calls it, `unitsCertified` counted from its result. Behaviour
   unchanged — the 13 epc tests are green, and the integration test's `h3_building_epc`
   assertions are unchanged.
2. **`certificateCoverage` keeps its v1 meaning; the v2 weight is a new field
   `certificateWeight`.** Reason: the page renders `certificateCoverage` as
   "{pct} % de las viviendas" (`artifacts/green-energy-calculator/src/pages/Screening.tsx:53`,
   `i18n/catalog.ts:186`). Storing v2's w there would show "15 % de las viviendas" for a fully
   certified single house, which is false (G6). The web is OUT, so the field was kept and the
   weight added beside it. The portfolio's with/without-certificate filters (`> 0` / `= 0`)
   still read coverage.
3. **A band with no certified building gets `null` credibility, not a refusal.** No building can
   use that band's k: a certified building is always in a band that has a certified building.
   A band that **does** have certified buildings and an undefined k refuses, as written. Under a
   stricter reading of the block, any municipality missing one era's certificates would refuse.
   This ruling chose against that; the operator may rule otherwise.
4. **Entries vs values.** `w` uses `entries` (every entry, as v1 and `h3_building_epc` count
   them). The estimator uses the entries that carry a cooling demand. They are equal wherever
   every entry has a value. `entriesWithValue` is reported next to `entries`, so the load log
   shows any gap.
5. **v2 refuses on small, uniform sets — measured, not hypothetical.** The integration fixture
   (one city block: 19 certified 1958–1967 buildings, 44 entry values) has
   **VHM = −4.1548 → k undefined**, computed offline from the same fixture files through the
   same code. The integration test asserts that refusal, and that nothing is written. It now
   runs v1 explicitly for the H3.7/3.8 assertions. Córdoba's simulation found k defined in all
   three bands. **Any other municipality** (OUT here) could refuse, and the refusal message
   names the band.

## DIFF SUMMARY

At `28b23bc`: **9 files, +845 / −32** (plus this file's own fill-in commit). Files: `lib/screening/src/heat-index.ts`,
`heat-index.test.ts`, `db/index-db.ts`, `db/facades.integration.test.ts`, `epc/summary.ts`,
`docs/heatshield/h3-metodologia-cribado.md`, `contracts/blocks/h3-index-v2.md`,
`contracts/rulings/h3-index-v2.md`, `contracts/AMENDMENTS.md`. No file in `artifacts/`, `scripts/`
or `.github/`.

## TEST EVIDENCE

- `pnpm -r --no-bail test`: lib/i18n 17 · lib/cte 72 · **lib/screening 104** (89 → 104: +15) ·
  api-server 590 · green-energy-calculator **23** — **806 green**.
  - Environmental, not this block: in this Windows checkout (`core.autocrlf=true`)
    `artifacts/green-energy-calculator/scripts/check-i18n.mjs` is checked out with a CR after its
    `#!` line, and Node rejects the import (`SyntaxError: Invalid or unexpected token`). The
    committed blob is LF, and `artifacts/` is identical to a5c3df2. Run from the committed bytes,
    that package is 3 files / 23 tests green; the working copy was put back as it was. CI (Linux)
    does not see this.
- `pnpm run typecheck` (root: libs + artifacts + scripts): **exit 0**. `check-i18n: clean`.
- **Fail-first against a5c3df2:** the new test file run on a5c3df2's sources fails at collection
  (`TypeError: Cannot read properties of undefined (reading 'pre-1980')` — no
  `coolingCredibility`, no `METHOD_V2` / `buhlmannStraub` / `entryValues`). That failure is at
  file level, so the per-test proof is G9:
- **G9 mutations — 6 of 6 caught** (each applied alone, suite run, sources restored and
  byte-compared):

  | Mutant | Change | Caught by |
  |---|---|---|
  | M1 | `k = 0` in the weight | one entry on one dwelling weighs 1/(1+k); weight is coverage × e/(e+k) |
  | M2 | `e/(e+k)` factor removed | same two |
  | M3 | raw certificates instead of entries (`entriesOf` skipped) | a unit certified twice counts once; parcel-wide certificates count as one more entry |
  | M4a | VHM ≤ 0 → `k = 1` instead of throwing | refuses VHM ≤ 0; caps each entry before estimation; refuses a band where k is undefined |
  | M4b | no ≥ 2-entry building → `k = 1` instead of throwing | refuses a band in which no building has two entries; refuses a band where k is undefined |
  | M5 | cap removed before estimation | caps each entry before estimation |

- Tests required by the block, each present: hand-computed three-building example (EPV 250/3,
  VHM 4000/11, k 11/48, exact to 1e-12) · one entry on one dwelling → `w = 1/(1+k)` · `k → 0`
  reproduces v1 exactly · `METHOD_V1` results pinned (six buildings, low/mid/high to full float
  precision, computed by a5c3df2's code before any edit) · repeat certificates of one unit count
  once · cap before estimation · VHM ≤ 0 and "no building with ≥ 2 entries" each throw ·
  low ≤ mid ≤ high · P7.
- **NOT RUN — PostGIS integration suite** (18 tests, +1 for v2). This machine has no PostGIS
  server: no Docker; WSL Ubuntu has the `psql` 18 client only, no server and no sudo. The
  `screening-postgis` CI job runs it on the branch's first push, which is the operator's. Its
  new v2 assertion (refusal at VHM ≈ −4.15) was predicted offline as above.
- **Not mutation-tested:** the "entries read = Σ `h3_building_epc.entries`" assertion inside
  `computeIndex`. It needs a database. The integration test exercises it on the pass path only.

## CÓRDOBA RUN (local PostGIS)

**NOT RUN — cannot be loaded here** (no PostGIS server, as above). Under the block's own
rule, the pins **move to L2**:

| Pin | Expected | Tolerance | Where to read it after the load |
|---|---|---|---|
| Entries used | 30,586 | exact | `h3-load` log: `index {… "entries", "entriesWithValue" …}` |
| k pre-1980 / 1980–2006 / 2007-on | 5.586 / 6.569 / 2.583 | ± 0.01 | `h3-load` log: `credibility` (also `h3_index_runs.refs.coolingCredibility`) |
| Top 20 | 19 pre-1980, 0 single-dwelling, 0 built ≥ 2000 | exact | `/api/screening/14021/buildings` |
| Top 100 pre-1980 | 82 | ± 1 | same |
| First tenth dwellings | 33,179 | ± 0.5 % | `/summary` |
| Gap (first tenth, no certificate) | 1,579 buildings / 3,827 dwellings | ± 0.5 % | `/summary` |

Which of `entries` / `entriesWithValue` the simulation's 30,586 counted is not stated in the
block. Both are logged; a pin match on either one is recorded as that one.
**A miss is a STOP: report, do not tune.**

## LIVE EVIDENCE

None — pre-merge. Nothing reached production.

## ROLLBACK COMMAND

Pre-merge, **Tier B** (G8 / A16) — proven to apply, not pushed. Dry run on a scratch worktree
(detached at `main`, removed afterwards):

```
git merge --no-ff heatshield/h3-index-v2        # scratch merge, parents main + tip
git revert -m 1 <scratch merge>                  # scratch revert
```

DRY-RUN RESULT at tip `28b23bc` (the commit after it changes only this file):

| | |
|---|---|
| scratch merge | `20d69ed`, parents `a5c3df2` + `28b23bc` (a real merge commit, so `-m 1` applies) |
| merge diff vs `main` | 9 files, +845 / −32, identical to the block diff `main...tip` |
| scratch revert | `402ff43`: 9 files, +32 / −845, exactly the block's diff inverted |
| tree after revert | **identical to `main`** (`git diff --quiet a5c3df2 402ff43`) |
| afterwards | scratch worktree removed; `main` still `a5c3df2`; 0 remote refs for the block branch |

After the real merge the rollback is `git revert -m 1 <merge>`, then `h3-load` again: `h3_index`
is overwritten, so a re-score is needed. The v1 run row stays in `h3_index_runs`.
**Deploy path UNPROVEN — A13 debt stands.**

## RESIDUE

- Root `h3-index-v2.md`: the untracked original of the block file, left where the operator put
  it. The committed copy is `contracts/blocks/h3-index-v2.md`.
- Untracked and not this block's, left alone: `Green-Energy-Calc/` (a nested copy of the
  repository) and `contracts/blocks/voltura-h3-e0c1f4b.bundle`.
- §6 of the methodology ("Concentración de certificados en la cabeza") still describes v1. It is
  outside the doc sections the fence names; §5 bis says so. Rewrite it once the load measures v2.
- §5 bis carries simulation figures, labelled. Replace them with the real run and its id after
  the load.
- `lib/screening/src/index.ts` (not in the fence) still exports `METHOD_V1` only. Nothing outside
  `lib/screening` needs `METHOD_V2`; the load uses the default.
- Year field (`year_end`) recorded, not touched — OUT.

## STILL TO DO (operator)

1. **Merge ruling** — `--no-ff`, by hand in Git Bash or from the session named. Re-confirm Render
   Auto-Deploy state at the merge (§2: the operator is the sensor). Pushing the branch first runs
   `screening-postgis` (the integration suite this session could not run).
2. **Load** — dispatch `h3-load` from `main`, confirm `LOAD-14021`, about 23 min. If the runner
   image (`ubuntu-latest` → Ubuntu 26 since 19 Oct) breaks it: STOP, report.
3. **Live** — L1 `/api/version` and web `build-sha` = merge sha · L2 method `h3-index-v2`, scored
   32,431, pins above · L3 `/cribado` in the operator's browser.

**What this gate cannot prove:** that the ranking matches real summer energy poverty in Córdoba.
The check against an independent official list does that; it is the next step, not this block.

## RULING

**OPEN** — pre-merge. Self-ruled criteria: suite green (806), typecheck 0, check-i18n clean,
G9 6/6 caught, dry-run merge and Tier B revert proven. Not run here: the PostGIS integration
suite (CI, on push) and the local Córdoba run (pins moved to L2). Merge: **operator's ruling.**
