# H3-INDEX-V2 — a lone certificate no longer replaces the age estimate · Gate H3-INDEX-V2

**BLOCK / GATE:** H3-INDEX-V2 / Gate H3-INDEX-V2 — **CLOSED (self-ruled), 22 October 2026**.
Merged by the operator as `a15dd1d`, loaded, and every L2 pin is measured live. Pre-merge
record below, unchanged except where marked *closed 22 Oct*.
**DATE:** 21 October 2026 (pre-merge) · 22 October 2026 (close)
**COMMIT (before):** `a5c3df2` (`main`, Merge heatshield/h3-load-pnpm — unchanged by this block)
**BRANCH:** `heatshield/h3-index-v2`, tip `10de388`, merged `--no-ff` into `main` as `a15dd1d`.
Close-out evidence on `heatshield/h3-index-v2-live-evidence`, off `a15dd1d`; unmerged, it rides
the next code merge.
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

*Closed 22 Oct.* **The operator's merge (`a15dd1d`, 21 Oct 22:03Z) accepted fence notes 1–3.**
Note 4 measured on Córdoba: `entries` = `entriesWithValue` = 30,586, so there is no gap. Note 5:
the load log shows k defined in every band, `all` included (LIVE EVIDENCE).

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
  *Closed 22 Oct:* **ran in CI, 18 / 18 green**, including the offline-predicted v2 refusal.
  - Branch run `39682719319` on `10de388`: success, 21:56Z, before the merge.
  - `main` run `39683628382` on `a15dd1d`: build, test and `screening-postgis` all success,
    22:03:21Z → 22:04:54Z. Its `test` job logs the same 806: 17 · 72 · 104 · 23 · 590.
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

*Closed 22 Oct:* every pin was measured live at L2 below. No miss. 30,586 is both `entries` and
`entriesWithValue`.

## LIVE EVIDENCE

*Closed 22 Oct.* Each line was re-read by the executor. Sources: `git`, the GitHub Actions API
(`gh run view`, read-only), and GETs against production on 21 Oct 23:13:54Z–23:14:20Z. Lines
marked *operator* cannot be observed from a coding session (§2, §5) and are the operator's
statement.

| Check | Value | Verified by |
|---|---|---|
| Merge | `a15dd1d`, parents `a5c3df2` + `10de388` (a real `--no-ff` merge), author `elmaroun07-hub@users.noreply.github.com`, committed 22:03:14Z 21 Oct, by the operator in Git Bash | `git log`; `origin/main` = `a15dd1d` after fetch |
| CI on `main` | run `39683628382`, push to `main` at `a15dd1d`, created 22:03:21Z, **success** (build · test · screening-postgis) | Actions API |
| Deploy | API `dep-dbcjdaek1f9s73anikrg` live 22:04:34Z · web `dep-dbcjdaek1f9s73anilk0` live 22:03:55Z | *operator* (Render). Not read here: the Render connector has no workspace selected and choosing one is the operator's. L1 below corroborates both. |
| L1 | `GET /api/version` → `{"sha":"a15dd1d","shaFull":"a15dd1d3946523a82a4fd53bdd42ab0b178befb3","source":"render"}` · web `/` serves `<meta name="build-sha" content="a15dd1d" />` | GET, 200 / 200 |
| Load | `h3-load` run `39684085979`, `workflow_dispatch` on `main` at `a15dd1d`, created 22:06:56Z, job `load` 22:06:59Z → 22:29:34Z, **success** (`LOAD-14021` guard step passed) | Actions API and log |
| Run | `h3-index-v2-14021-2026-10-21T22:28:58.722Z`, method `h3-index-v2`, computed 22:28:58.771Z, scored **32,431** | `GET /api/screening/municipalities` |
| L2 entries | `entries` **30,586** · `entriesWithValue` **30,586** | load log, `index {…}` at 22:29:31Z |
| L2 k | pre-1980 **5.5860** (EPV 54.764, VHM 9.804; 5,520 buildings, 15,828 entries) · 1980–2006 **6.5691** (56.247, 8.562; 4,628, 11,110) · 2007-on **2.5834** (44.042, 17.048; 1,547, 3,648) · all **4.9446** (54.080, 10.937; 11,695, 30,586) | load log |
| L2 top 20 | **19 pre-1980** (rank 2 is 1994, 127 dwellings), **0** one-dwelling, **0** built ≥ 2000 | `GET /api/screening/14021/buildings?limit=100` |
| L2 top 100 pre-1980 | **82** | same response (ranks 1–100, one page: `MAX_LIMIT` is 500) |
| L2 first tenth | **3,244 buildings / 33,179 dwellings** (1,665 with a certificate) | `GET /api/screening/14021/summary`, decile 1 |
| L2 gap | **1,579 buildings / 3,827 dwellings** | `/summary` `gap` |
| L3 | `/cribado` read in the operator's browser 22:39 local; cards and top rows match | *operator* screenshot |

**Concentration:** 19 of the top 20 are in census section **1402109012**; the 20th (rank 2) is
in 1402106012.

Other load-log figures: 5,075 not residential, 344 without dwellings, 11,695 with a
certificate, 5 without census input, cap 60.2245, 215 capped buildings.

**Outside check** (operator, 21–22 Oct, read-only): `contracts/evidence/h3-index-v2/`
- `h3-outside-check-2026-10-21.md` — sha256
  `d822dc2687726e792f3e3a60cf33f14e6ef618d55ef1cfa3f72407da27887731`
- `ine-adrh-30980-cordoba-2024-renta-persona.csv` — sha256
  `fc8f18190ce53c1df0a0c550db1a1500e3cb561123f4a28a9fe3a52714ac246f`, re-hashed after the move:
  matches.

Its findings are in the methodology, §5 ter. It is context, not a criterion of this gate.

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

*Closed 22 Oct* — **Tier B re-run on the real merge** (scratch worktree detached at `a15dd1d`,
removed afterwards, nothing pushed):

```
git revert --no-edit -m 1 a15dd1d
```

| | |
|---|---|
| scratch revert | `bfc51cd`, parent `a15dd1d`: 9 files, +32 / −853 (853 = 845 + the ruling fill-in commit) |
| tree after revert | `60a5453` = `a5c3df2^{tree}` — **`a5c3df2`'s tree restored exactly** |
| afterwards | worktree removed; `origin/main` still `a15dd1d` |

Production rollback is `git revert -m 1 a15dd1d` on `main`, then `h3-load`. **It is a deploy**
(A16), so it is never run as a check. **Deploy path UNPROVEN — A13 debt stands.**

## RESIDUE

*Updated 22 Oct.*
- §5 bis and §6 of the methodology were rewritten on the live-evidence branch from the measured
  run. A new §5 ter, "Contraste externo", was added. Closed.
- The root `h3-index-v2.md` original is gone from the working tree; the committed copy is
  `contracts/blocks/h3-index-v2.md`.
- The close-out prompt (`docs/heatshield/claude-code-h3-index-v2-closeout.md`) is left
  untracked, as it instructs. An earlier draft of it is in the nested `Green-Energy-Calc/` copy.
- Untracked and not this block's, left alone: `Green-Energy-Calc/` (a nested copy of the
  repository) and `contracts/blocks/voltura-h3-e0c1f4b.bundle`.
- The outside-check file names one building's street address (Catastro, public). It was
  committed byte for byte, as instructed; the methodology does not repeat it.
- `gate-check.sh --live` cannot read the web build-sha. Its regex stops at the hex letters of
  `content=` in `<meta name="build-sha" content="…">`, so it prints SKIP. L1 was read directly.
  Not fixed here: no code change.
- `lib/screening/src/index.ts` (not in the fence) still exports `METHOD_V1` only. Nothing outside
  `lib/screening` needs `METHOD_V2`; the load uses the default.
- Year field (`year_end`) recorded, not touched — OUT.

## STILL TO DO (operator)

*Closed 22 Oct:* merge, load and L1–L3 are done (LIVE EVIDENCE). Remaining:
- Push `heatshield/h3-index-v2-live-evidence`. It is docs and evidence only and stays off `main`
  (A13); it rides the next code merge.

**What this gate cannot prove:** that the ranking matches real summer energy poverty in Córdoba.
The check against an independent official list does that; it is the next step, not this block.
*22 Oct:* the operator's income check (§5 ter of the methodology) is a first outside contrast.
On its own terms it does not prove this either: income is not summer energy poverty, and part
of the agreement is shared census input.

## RULING

~~**OPEN** — pre-merge.~~ (21 Oct: suite green (806), typecheck 0, check-i18n clean, G9 6/6
caught, dry-run merge and Tier B revert proven; integration suite and Córdoba run pending.)

**CLOSED (self-ruled), 22 October 2026.**
- Merged by the operator: `a15dd1d`, `--no-ff`.
- CI on `main` green, including the PostGIS integration suite (18 / 18).
- Load succeeded.
- L1 = `a15dd1d` on both services.
- L2: method `h3-index-v2`, scored 32,431, every pin measured and matching.
- L3: operator.
- Tier B re-run on the real merge restores `a5c3df2`'s tree exactly.
- **Deploy path UNPROVEN — A13 debt stands.**
