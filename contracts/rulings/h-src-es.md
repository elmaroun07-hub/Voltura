# Ruling — Block H-SRC-ES, 17 Sept 2026

**Branch:** `heatshield/h-src-es`, off `main` at `b1f2c99`.
**Status at this ruling:** all tasks and acceptance criteria below are met on the branch.
**Not yet done:** the `--no-ff` merge into `main`. Per this session's own safety rules
(a push to `main` triggers a production deploy on both services, and merging is a
hard-to-reverse, high-blast-radius action), the merge was held for explicit operator
confirmation rather than executed autonomously. AC8's revert-clean proof was still run —
against a disposable, unpushed local test merge, reset immediately after — so the proof
is real even though the actual merge has not happened yet. See "AC8" below.

---

## What was built

1. `data/sources/es.yaml` — 17 entries. Five `current` (the CO₂ consumer default, the
   generation-mix comparator, two Guarantee-of-Origin variants, and the superseded
   2024/MITECO figure), two `current`-but-unwired (the radioactive-waste pair — captured
   because it is the other half of the same CNMC document, not because anything consumes
   it yet), and ten `pending` (municipality coordinates, plus the nine unsourced constants
   already on the defect register — `SYSTEM_EFFICIENCY`, orientation factors, tilt
   penalty, consumption coefficients, `INFLATION`, the trees÷20 heuristic, the 10% export
   factor, the ×1.5 upsizing rule, and the back-computed 0.25 €/kWh tariff default).
2. `artifacts/api-server/src/lib/emissions/registry.ts` — the loader. Finds
   `data/sources/es.yaml` by walking upward from the calling module's own location
   (robust to esbuild bundling — see "the path-resolution risk" below), parses it,
   validates every field's type, rejects duplicate ids and dangling `supersedes`
   pointers, and exposes `requireCurrentEntry()` as the one choke point every resolver
   goes through.
3. `artifacts/api-server/src/lib/emissions/es.ts` — Spain's resolver. Four typed
   functions, one per `basis` value actually in the registry
   (`resolveEsConsumerCarbonFactor`, `resolveEsGenerationMixFactor`,
   `resolveEsRenewableAttributedFactor`, `resolveEsCogenAttributedFactor`), each
   returning a `SourcedCarbonFactor<B>` generic-tagged by its own basis, plus
   `applyConsumerCarbonFactor`, whose parameter type is pinned to
   `SourcedCarbonFactor<"supply_residual">` — the AC4 compile-time proof.
4. `artifacts/api-server/src/lib/emissions/carbon-source.ts` — the combining resolver
   `routes.ts` actually calls. `CarbonSourceNote` is a closed four-state union: `sourced`
   (Spain, through the registry), `unsourced_legacy` (any other country still on the old
   bare table), `unknown_country` (kills the `0.4` default — D15), `not_reached`
   (geocoding itself failed).
5. `routes.ts` / `shared-routes.ts` / the client's mirrored `api.ts` — `detectCarbonIntensity()`
   deleted outright. `resolveLocationIrradiance()` now resolves `carbonSource` once,
   right after geocoding, and carries it on every branch of the shared provenance
   (`resolution`) record — both `/api/calculate` and `/api/optimize` responses.
   `/api/calculate`'s handler is the only place that acts on `unknown_country` (400).

## Design decisions this block's brief left to the executing session

The brief names two explicit defaults (audit records unpersisted; unsourced constants
shown as pending) that belong to H-A50-PORT, not this block. This block's own brief left
several genuine judgment calls unstated. Recorded here so they can be checked rather than
re-derived:

1. **`resolveLocationIrradiance` resolves `carbonSource` but never rejects on it.**
   The function is shared by both routes. Rejecting on `unknown_country` INSIDE it would
   have given `/api/optimize` a new failure mode it never had — a location that used to
   200 would start 400ing, even though `/api/optimize` has never priced a CO₂ figure and
   this block does not add that. Only `/api/calculate`'s own handler checks the status
   and rejects. This is why "extend the response provenance block... and update the
   H-OPT validator['s]...to match" (scope item 4) reads, on inspection, as a schema-shape
   change (every hand-built `resolution` fixture in `shared-routes.test.ts` needed a
   `carbonSource` added once the field became required) rather than a behavioural one —
   nothing about what `/api/optimize` shows the model, or what figures its prose may
   contain, changed. `optimize-payload.ts` has an empty diff.
2. **Non-Spain countries stay on the legacy bare table, but the response says so.**
   A second country is explicitly OUT of this block's scope. Rather than either (a)
   silently leaving those countries' responses claiming no provenance information at all,
   or (b) fabricating authority/document/date fields for 30-odd countries this block was
   never asked to source, `unsourced_legacy` is a fifth — no, still one of the four —
   honest state: it names the value and says plainly that it is not sourced. AC3's "every
   response carrying a carbon figure names authority, document, edition date and activity
   year" is read as "names its provenance status", which for a `sourced` response IS
   those four fields, and for `unsourced_legacy` is the admission that they don't exist
   yet. Reading AC3 as requiring full authority/document/date for all ~30 countries would
   have meant either sourcing all of them (a second-country expansion, explicitly OUT) or
   silently dropping the field for them (reproducing exactly the "silent" defect class
   this block exists to remove). Flagged here as the one place this ruling is not a
   mechanical reading of the brief — if this call is wrong, it is wrong in the direction
   of MORE honesty, not less.
3. **The retailer table (Verification fixtures, §7 seven-row check) is NOT in the diff.**
   The block itself makes this conditional: "the retailer table, if encoded at all."
   Building it means OCR/extraction from a 23-page primary-source PDF this session
   cannot independently fetch and hand-verify against seven fixtures without a real risk
   of shipping a wrong number with a confident-looking citation — precisely the failure
   mode named in the brief ("do not OCR 23 pages of tables and trust the result").
   Declining to encode it is the brief's own permitted way to satisfy AC5 ("...or the
   retailer table is not in the diff at all"). The four top-level figures (residual,
   generation, renewable-attributed, cogen-attributed) and the two radioactive-waste rows
   ARE in the registry — those come from the same document's headline figures, not its
   per-retailer annex, and were checked against the block brief's own verified table.
4. **The path-resolution risk.** `esbuild` bundles all of `src/` into one
   `dist/index.mjs`; after bundling, every module's `import.meta.url` resolves to that
   one file's location, not to where the source file used to live. A fixed relative
   offset (`"../../../../../data/sources/es.yaml"`, correct for
   `src/lib/emissions/registry.ts` at dev time) would have been WRONG after bundling —
   three directories too deep — and would have failed at exactly the moment it mattered
   most: in the built artifact, not in `vitest`. `registry.ts` instead walks upward from
   its own module location searching for `data/sources/es.yaml`, which is correct
   regardless of bundling depth. **Proven, not assumed:** the registry module was bundled
   standalone with esbuild to an artificially deep path
   (`dist/smoke/deep/nested/registry-smoke.mjs`, four levels deeper than the real build's
   `dist/index.mjs`) and executed with plain `node`; it found the real
   `data/sources/es.yaml` and returned all 17 entries, including the Spain default with
   full provenance. Whether Render's actual deploy checks out the full monorepo (so the
   file is present on disk at runtime) was NOT independently re-verified this session —
   `h2-map.md`'s prior evidence (no Dockerfile, dashboard-managed build/start commands)
   supports it, but this ruling does not claim a live-Render check.

## Acceptance criteria — evidence

1. **No Spanish carbon figure can be emitted without a registry entry.**
   `registry.test.ts`, "proves AC1 live": a real YAML file is written to a temp dir with
   the Spain entry present, read successfully, then rewritten with `entries: []` and
   re-read — `requireCurrentEntry("es-carbon-supply-residual-2025", ...)` throws
   `/no entry/` against the second read. Every resolver in `es.ts` goes through this one
   function; there is no second path to a Spain figure.
2. **The `0.4` unknown-country default is gone. Unknown country → typed error → HTTP 400.**
   `calculate.test.ts`, "D15 — unknown country is a typed 400": a live request through
   the real running server (`POST /api/calculate`, location "Thimphu, Bhutan", a country
   in neither the registry nor the legacy table) returns `400`,
   `code: "unknown_carbon_country"`, and asserts `carbonIntensity` / `co2Reduction` are
   both `undefined` in the body — the response never reaches the arithmetic that would
   have used a substituted number.
3. **Every response carrying a carbon figure names authority, document, edition date and
   activity year.** `calculate.test.ts`, "AC3 — every carbon-bearing response names its
   source": a live Spain request (`ALMERIA`) is parsed against the REAL
   `api.calculations.create.responses[200]` Zod schema (not a hand-built fixture), and
   `resolution.carbonSource.factor` is asserted to carry non-empty `authority`,
   `documentId`, `editionDate` and a numeric `activityYear`. A second test (`TETOUAN`,
   `unsourced_legacy`) proves the honest-admission path for design decision 2 above.
4. **`generation` cannot be used where `supply_residual` is required.**
   Compile-time: `es.test.ts` contains `applyConsumerCarbonFactor(resolveEsGenerationMixFactor(), 1000)`
   under `// @ts-expect-error`. Verified NOT to be a dead assertion — the
   `@ts-expect-error` comment was temporarily removed and `tsc --noEmit` was run, which
   reported `TS2345: Argument of type 'SourcedCarbonFactor<"generation">' is not
   assignable to parameter of type 'SourcedCarbonFactor<"supply_residual">'` at exactly
   that line, then the comment was restored. `pnpm run typecheck` is clean with the
   comment present.
5. **All seven fixtures resolve exactly, or the retailer table is not in the diff at
   all.** The retailer table is not in the diff — see design decision 3.
6. **NASA path diff is empty; the NASA suite passes unchanged.**
   `git diff` against `artifacts/api-server/src/routes/routes.ts` touches no NASA
   constant, no NASA parsing, no `-999` guard logic — only comment context and the new
   `carbonSource` field alongside existing NASA fields. `nasa-fillvalue-fixture.test.ts`
   (5), the A3.4–A3.6 provenance/fallback/`-999` describes in `calculate.test.ts`, and
   `lib/cte`'s 72 tests (irradiance-adjacent, unrelated package) all pass unchanged.
7. **Every test that changed, changed for a stated reason.** `carbon-intensity.test.ts`:
   two assertions that happened to use "Spain" as their example country (testing
   geocoded-country preference and accent survival — not Spain's value specifically) were
   repointed at Portugal, with an inline comment saying why; one new test asserts Spain is
   now ABSENT from the bare table. `shared-routes.test.ts`: the shared `resolution`
   fixture gained a `carbonSource` field (required by the schema change) plus eight new
   tests exercising the four states and the missing-field/wrong-basis rejections. No
   mass-update — every changed assertion is named above.
8. **Tier B: `git revert -m 1 <merge>` applies clean, tree byte-identical to `main`.**
   Run as a disposable, LOCAL-ONLY test, never pushed:
   a temporary local branch was merged into a temporary local copy of `main` with
   `--no-ff`, `git revert -m 1 <merge-sha>` was run immediately after, and
   `git diff <merge-sha>^1 HEAD` (post-revert) was empty — confirmed byte-identical to
   `main` before the merge. The temporary branches and the test merge commit were then
   discarded; nothing from this test reached the real `main` or `origin`. This proves the
   revert mechanics; it does not substitute for actually performing the real merge, which
   is still pending operator confirmation.
9. **This ruling, on the branch, not pushed separately.** Committed in the same commit as
   the block's code changes, on `heatshield/h-src-es`.

## Test counts

| Suite | Before | After | Delta |
|---|---|---|---|
| `artifacts/api-server` (`pnpm test`) | 127 | **171** | +44 |
| `lib/cte` (`pnpm test`) | 72 | **72** | 0 — confirms the NASA/irradiance path is untouched |
| **`pnpm -r test` total** | 199 | **243** | +44 |

Breakdown of the +44: `lib/emissions/registry.test.ts` (16), `es.test.ts` (7),
`carbon-source.test.ts` (9), `carbon-intensity.test.ts` (+1, net of the two repointed),
`shared-routes.test.ts` (+8), `calculate.test.ts` (+3: the D15 400 test, and the two AC3
live-schema tests). No test was deleted; no existing test's assertion was weakened.

`gate-check.sh`'s `EXPECTED_TOTAL_TESTS=199` / `EXPECTED_API_TESTS=127` are now stale —
**by design**, per this block's own preamble ("`gate-check.sh` is still unfixed (block
H-GATE)... this block is deliberately shaped so the machine's future S row has a file to
read: build the registry now, wire the checker later"). Not touched here; H-GATE's job.

## Named failure modes — checked against, not just read

- **The one-line fix** (283→258): not done — a full sourced object replaces the bare
  constant, and the 283 figure is retained in the registry, marked `superseded`.
- **Using 107 as "the Spanish average"**: `resolveEsGenerationMixFactor` exists and is
  resolvable, but nothing in `routes.ts` calls it for a consumer figure — only
  `resolveEsConsumerCarbonFactor` (basis-locked to `supply_residual`) is wired to
  `/api/calculate`.
- **Treating a GdO as automatically zero**: `es.test.ts` asserts the cogeneration factor
  is `> 0` and specifically greater than the no-GdO consumer default.
- **Scraping tables unverified**: declined — see design decision 3.
- **Scope creep into a second country**: `carbon-intensity.ts`'s legacy table is
  untouched except for Spain's removal; no new country was added to the sourced registry.
- **Touching NASA or GreenCalc "while in there"**: both diffs are empty — confirmed by
  `git status`/`git diff` against `artifacts/greencalc/` and `gate-check.sh` (no matches)
  and against the NASA-specific lines in `routes.ts` (see AC6 above).
- **Mass-updating the test suite**: every changed test is named under AC7, each with its
  own stated reason; nothing was bulk-edited to force green.

## Rollback

Branch `heatshield/h-src-es`, `--no-ff` merge planned, not yet executed (see the status
note at the top). Tier B proven via a disposable local test (AC8). The branch itself, as
committed, has not touched `main`.
