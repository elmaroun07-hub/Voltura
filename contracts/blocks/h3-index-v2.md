> Block file under §14.1. Invariants (§0–§8, §10–§14) live in the root contract.

# H3-INDEX-V2 — a lone certificate no longer replaces the age estimate

**Branch** `heatshield/h3-index-v2` off `main` at the tip at block open (`a5c3df2` on 21 Oct 2026).
Author every commit as `elmaroun07-hub@users.noreply.github.com` — never the private gmail (GH007).

## Why — measured on production, 21 Oct 2026

Run `h3-index-v1-14021-2026-10-14T17:20:17.578Z` (live, 32,431 buildings), read-only SQL against
`voltura-db`:

- `coolingRange` uses `w = min(1, entries / dwellings)`. One certificate on a one-dwelling building
  gives `w = 1`: the certificate **replaces** the age-band prior, band of zero width.
- Capped at p99 (60.2245 kWh/m²·yr), a certified building's sensitivity reaches **2.563**; an
  uncertified building's reaches at most **1.503** (pre-1980 p90 35.322 / reference 23.495).
- **All 20 top buildings sit above 1.503** — no uncertified building can reach them. 14 of the
  top 20 rest on one entry; 14 are single-dwelling; 8 were built 2000 or later. Rank 1 is one
  F-letter certificate on a 2007–2016 house.
- A certified building is twice as likely to land in the first tenth (14.8 %) as an uncertified
  one (7.3 %).

The page's first screen therefore shows new single houses to the reader the method is written for.

## Operator ruling

- 21 Oct 2026 20:52 — **option B**: one certificate must not replace the age estimate; fix before
  the MIT Solve application.
- 21 Oct 2026 20:57 — rejected guessed weights (blend k = 1 or 3; minimum 2 or 3 certificates) as
  weak.
- 21 Oct 2026 21:06 — the fix comes first; it is the precondition for showing the list to anyone
  in Córdoba. Taken as: the **measured** weight below.

## The method change (v2)

Credibility weighting, **Bühlmann–Straub** (Bühlmann 1967, *ASTIN Bulletin* 4(3); Bühlmann & Straub
1970, *Mitt. VSVM* 70). How much a building's own entries count is **measured from the
municipality's own certificates**, per age band — no constant is chosen by hand.

For each age band B (and `all`, for buildings with no year), over the certified scored buildings
of B, using **entries** (one per unit, the `summariseBuilding` rule in `epc/summary.ts`), each
value capped at the municipality's p99 **before** estimation:

```
EPV_B = Σ_i Σ_j (x_ij − x̄_i)²  /  Σ_i (n_i − 1)                 (within-building variance)
VHM_B = [ Σ_i n_i (x̄_i − x̄)² − (r − 1)·EPV_B ]  /  (N − Σ n_i² / N)   (between-building variance)
k_B   = EPV_B / VHM_B
```

`n_i` entries of building i, `r` buildings, `N = Σ n_i`, `x̄` the n-weighted mean.

```
w = min(1, entries / dwellings) × entries / (entries + k_band)
```

`low`, `mid` and `high` keep v1's form with this `w`. Everything else in v1 is unchanged: weights,
cap, band quantiles, ranking on the high end, factors, P7.

**Refuse, never default:** if a band's `VHM ≤ 0`, or no building in it has ≥ 2 entries, `k` is
undefined → `IndexInputError`. Not a fallback value.

## Fence

**IN**
- `lib/screening/src/heat-index.ts` — `METHOD_V2` (`version: "h3-index-v2"`, the credibility
  estimator named in the method object), the estimator, the new `w`, the header comment. `METHOD_V1`
  stays as it is and stays reproducible. `References` records `k`, `EPV`, `VHM`, buildings and
  entries per band, so every run carries its own weights.
- `lib/screening/src/db/index-db.ts` — read entry-level values (same selection as
  `summariseBuilding`, reused, not re-implemented in SQL); default method `METHOD_V2`.
- Tests: `heat-index.test.ts` and the PostGIS integration test.
- `docs/heatshield/h3-metodologia-cribado.md` (Spanish): §4.6, §4.7, §4.8, a new run section, §9
  (this decision, dated, and who took it).
- `contracts/rulings/h3-index-v2.md`; amendment **A27** in `contracts/AMENDMENTS.md`.

**OUT** — the web and API code (they read whatever run is latest); the year field (the Year column
and the age band use Catastro's `year_end`, e.g. a 1995–2025 range shows 2025 — recorded, not
touched); the `h3-load` workflow; weights; cap; any other municipality.

## Tasks

| # | Task |
|---|---|
| V.1 | Estimator + `METHOD_V2` + new `w` in `heat-index.ts`; refusal on undefined `k`. |
| V.2 | `index-db.ts`: entry-level values per building; assert Σ entries read = Σ `h3_building_epc.entries` of scored buildings; default `METHOD_V2`. |
| V.3 | Tests (below). |
| V.4 | Methodology doc, Spanish, written with the code. |
| V.5 | Ruling file + A27. |

**Tests that must exist and fail first against `a5c3df2`:**
- the estimator on a hand-computed three-building example (EPV, VHM, k exact);
- one entry on one dwelling: `w = 1/(1+k)`, not 1;
- `k → 0` reproduces v1 exactly; `METHOD_V1` results unchanged (pin);
- repeat certificates of one unit count once (entries, not certificates);
- cap applied before estimation;
- `VHM ≤ 0` and "no building with ≥ 2 entries" each throw;
- low ≤ mid ≤ high still holds; P7 test still passes.

## Expected on Córdoba — from the read-only simulation, 21 Oct 2026

SQL replicating `coolingRange` reproduced v1's live ranking exactly (0 rank mismatches; first tenth
32,564 dwellings; gap 1,518 / 3,729). With v2:

| Pin | Value | Tolerance |
|---|---|---|
| Entries used | 30,586 | exact |
| k pre-1980 / 1980–2006 / 2007-on | 5.586 / 6.569 / 2.583 | ± 0.01 |
| Top 20 | 19 pre-1980, 0 single-dwelling, 0 built ≥ 2000 | exact |
| Top 100 pre-1980 | 82 | ± 1 |
| First tenth dwellings | 33,179 | ± 0.5 % |
| Gap (first tenth, no certificate) | 1,579 buildings / 3,827 dwellings | ± 0.5 % |

The simulation held the reference median at 23.495; v2 moves it, which rescales every index
equally and changes no rank. **A miss is a STOP: report the numbers, do not tune.**

## Gate H3-INDEX-V2

**Pre-merge (self-ruled where mechanical):** suite green, typecheck 0, check-i18n clean. G9
mutations, each caught: M1 `k = 0`; M2 the `e/(e+k)` factor removed; M3 raw certificates instead of
entries; M4 undefined `k` defaulted instead of refused; M5 cap after estimation. Córdoba run on a
local PostGIS (`h3:ingest … --index`, as in H3) if it can be loaded; if not, say so and the pins
move to L2. Dry-run merge + Tier B revert on scratch.

**Merge:** his ruling — `--no-ff`, by hand in Git Bash or from the session he names.

**Load:** dispatch `h3-load` from `main` (confirm `LOAD-14021`). Ingest is idempotent (upserts); the
run writes a new `h3_index_runs` row and upserts `h3_index`; the portfolio reads the latest run.
~23 min. If the runner image (`ubuntu-latest` → Ubuntu 26 from 19 Oct 2026) breaks it: STOP, report.

**Live:**
- L1 `/api/version` and web `build-sha` = the merge sha.
- L2 `/api/screening/municipalities` → method `h3-index-v2`, scored 32,431; the pins above, from
  `/api/screening/14021/buildings` and `/summary`.
- L3 `/cribado` on screen in his browser, top rows.

**Rollback:** `git revert -m 1 <merge>`, then `h3-load` again (the v1 run row stays in
`h3_index_runs`, but `h3_index` is overwritten, so a re-score is needed). Deploy path UNPROVEN —
A13 debt stands.

**What this gate cannot prove:** that the ranking matches real summer energy poverty in Córdoba.
That is the next step — the check against an independent official list — not this block.
