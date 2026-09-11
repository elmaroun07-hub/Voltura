> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H-OPT — the Optimizer computes, the model explains · 11 Sep 2026

**Fence.** In: `/api/optimize` — geocode, NASA, a pure sizing function, model-output
validation, the provenance block, and the Optimizer tab that renders it. Out: the typed
502/503 **transport-path** error handling for the LLM call and its missing tests (separate
ticket); `lib/emissions` (H1b); the claims takedown (H1c).
Branch: `heatshield/opt-grounded`, off `main` at `c459b0d`. G1 — no commits to `main`.

## The defect

`/api/optimize` never calls NASA. It hands the location **string** to the model and prints
whatever comes back.

| | Model says | `/api/calculate` computes | Source of the model's number |
|---|---|---|---|
| Tétouan | ~5.5 kWh/m²/day | **5.08** | its own priors |
| Fuengirola | ~4.5 | **5.05** | its own priors |

It also reads the 24-entry `energyPattern` as absolute kWh. The web client sends a fixed
shape summing to **102**, so every request is sized against 102 kWh/day while the
calculator works from 5,000 kWh/year (13.70 kWh/day) — which is how a 20,000–30,000 W
array comes back where the answer is ~3.4 kWp.

This is **C7**, shipping today. C7 said *"do not fix it early; it needs `simulate8760()`
extracted (2.11) first."* That premise does not hold for this fix: the sizing here is
closed form, it consumes the existing `fetchNasaPower` and the existing hourly solar
profile, and it extracts nothing from the calculate path. C7's deferral stands as written
for the 8760-simulation-based optimizer it describes; this block does the smaller, earlier
thing — stop quoting priors — and H1c's inventory should record C7 as closed by it.

It is a **P3** violation ("LLMs explain, never compute"), a **P1** violation (a displayed
number originating in a model response), and `optimize-payload.ts:46–47` is a live **G5**
violation: `rec["optimal_pv_watts"] || 5000`.

## Finding, recorded before building — fence item 4

**The web client does not send usage to `/api/optimize`, and there is nowhere for it to
come from.** `Optimizer.tsx:21` posts exactly `{ location, energyPattern }`, and
`energyPattern` is the module constant `DEFAULT_PATTERN` — 24 numbers summing to 102, never
edited by the user, labelled "Standard Profile" in the UI. The optimize input schema
(`shared-routes.ts:149`, mirrored at `green-energy-calculator/src/lib/api.ts:150`) has no
usage field at all. So the web needs a change too, and this block takes it: an annual-usage
input on the Optimizer tab, sent as `annualUsageKwh`, with the same 100–100,000 kWh bounds
`calculationInputSchema` already applies to `energyUsage`.

**Required, not optional, and not defaulted.** A missing usage is a 400 from Zod, not a
substituted 5,000 — G5 and P2. The hardcoded pattern stays as the load *shape*; it is a
shape, and only ever was one. What it must stop being is a magnitude.

## Tasks

| # | Task |
|---|---|
| O.1 | Geocode the location in the optimize handler through the **same** `geocode()` the calculate handler uses, country resolved first. No second geocoder — P5. |
| O.2 | Call the **same** `fetchNasaPower(lat, lon)`. Same 2019–2023 mean, same parse boundary. A `-999` returns a typed 422 through the existing `nasaDataFailureToHttp`, never a number. |
| O.3 | New pure function, deterministic and tested: `sizePvAndBattery()`. `PV_kWp = (coverage × daily_kWh / PR) / irradiance`; `Battery_kWh = (night_kWh / RTE) / DoD`. Defaults PR 0.80, RTE 0.90, DoD 0.80, coverage 1.00. |
| O.4 | Load from the user's annual usage, spread over the profile **shape**: `daily_kWh = annualUsageKwh / 365`; `night_kWh = daily_kWh ×` the shape's share of the hours the solar profile produces nothing. No fixed 102. |
| O.5 | The model receives the computed figures and returns **prose only** — no `optimal_pv_watts`, no `optimal_battery_kwh`, no irradiance. `optimalPv` and `optimalBattery` stop being `llmNumberSchema` and become `z.number()`, computed server-side. |
| O.6 | Validate the model's prose: **every numeral in the explanation must appear in the input the model was given**, or the response is the existing `invalid_model_response` 502. |
| O.7 | The optimize 200 carries the same `resolution` block `/api/calculate` ships, and the Optimizer tab renders it through the **same** label map as `ResultsDisplay` — G7, one map, inspected at the render site. |

## The coverage target — one number, applied everywhere

**Coverage = 1.00.** Annual PV generation is sized to equal annual consumption.

The current output has no coverage target; it has whatever the model felt. Reconstructed
from its own answers: **100%** for Tétouan and Paris, **88%** for Fuengirola, **40%** for
London. A figure that silently varies by location is not a design choice, it is the absence
of one, and it means two users doing the same thing get answers computed to different
standards without either being told.

Why 1.00 rather than a smaller, self-consumption-optimised figure:

- It is the only value that needs no second assumption. Any other target implies a claim
  about tariffs, export pricing or payback that this route does not compute and cannot
  cite — P1. 1.00 is a definition, not an estimate.
- It is the target a reader assumes on hearing "optimal system size for my usage", so it is
  the one least likely to mislead if the label is skimmed.
- With coverage exactly 1.00 the two formulas reduce to the fence's verbatim, so the
  coverage term is visible in the code and provable in the response without altering the
  arithmetic anyone reviews.

**What it is not, stated so the label cannot drift into a claim.** 1.00 is *annual energy
parity* — a year's generation equals a year's consumption. It is **not** 100%
self-consumption, **not** off-grid autonomy, and **not** a guarantee that grid import is
zero: generation and load are offset in time, which is what the battery term is for and
what `simulate8760()` in `/api/calculate` actually measures. The response therefore carries
`coverageTarget` as a field and the UI says what it means. It may never be rendered as a
grade, a rating or a compliance result — **P7**.

**Coverage multiplies the PV load only, not the battery.** Sizing an array to a fraction of
the load does not make the night shorter; the battery is sized to carry the night it is
actually asked to carry. At 1.00 the distinction changes no number, which is precisely when
it is cheap to get right.

## Where the pure function lives

`artifacts/api-server/src/lib/sizing.ts` — the same `src/lib/` that holds
`carbon-intensity.ts` and `llm.ts`, and for the reason `carbon-intensity.ts` states in its
own header: it is *"deliberately placed in the only package that consumes it rather than in
a new `lib/*`"*. A root `lib/*` is a published workspace package with build wiring and a
project reference; standing one up for a single-consumer function spends §14 capacity on
packaging, and `lib/emissions` (H1b) is the next block that will actually need a package.
The module imports nothing — no `routes.ts`, no schema, no Zod — so the hourly solar profile
is **passed in** by the caller rather than duplicated. One profile, one definition, no
cycle. P5.

## Specific constraints

- **No `||` numeric default anywhere in the new code.** G5. `optimize-payload.ts:46–47` is
  deleted by O.5, not relocated.
- **No number reaches the Optimizer tab that a function did not compute.** G6. The model's
  only output is a string.
- `irradianceSource` must not render raw. G7.
- Tests network-free; fixtures only. G10.
- No DB, no DDL, no migration. G3. The optimize route persists nothing and must not start.
- The block ships code to production if merged, so G8 is **Tier B** at minimum: the revert
  is proven to apply on a scratch ref, the deploy path recorded **UNPROVEN**, A13's debt
  carried. No push to `main`, no merge — operator-only under §14.2.

## Failure modes

- Sizing from the model's irradiance instead of NASA's because the prompt still carries a
  location string the model can re-derive from. The prompt carries **figures**, and the
  validator rejects anything else.
- A validator so loose that a fabricated figure passes because it "looks like" an allowed
  one. Matching is exact on the normalised numeric value, never on a rounding.
- A validator so tight that ordinary prose 502s on "24 hours". Accepted deliberately: the
  failure mode is an honest error, not a wrong number, and the prompt states the rule.
  Written here rather than discovered later.
- Reading the 24-entry pattern as kWh again, anywhere. It is a shape; it is normalised to
  sum 1 before use.
- Rounding the mean irradiance differently from `/api/calculate`, so the two tabs quote
  different irradiance for one place. The sizing consumes the same `avgIrradiance` the
  calculate response reports, to the same 2 decimals.
- Sizing a battery off a "night" that is a constant rather than the profile. Night is the
  hours the supplied solar profile is exactly zero — mechanical, and it moves if the
  profile moves.

## Gate H-OPT

Mechanical throughout, therefore **self-ruled under §14.2** — except the merge, which is
not taken.

| # | Demands | Provable because |
|---|---|---|
| i | `/api/optimize` calls NASA POWER for the geocoded coordinates, and the figure it sizes from equals the figure `/api/calculate` reports for the same place | Both routes hit the same fixture in one test; the two `avgIrradiance` values are asserted equal |
| ii | The `-999` fill value is a typed 422 on the optimize path too — never a number | Fixture-injected `-999`, asserted `422` / `nasa_fill_value`, asserted no `optimalPv` in the body |
| iii | **Mutation (G9):** re-hardcoding the irradiance kills tests; dropping the NASA call kills tests | Both mutations run, killed-test counts recorded in the ruling |
| iv | Sizing is a pure function of its inputs, and the numbers are the fence's formulas | Direct unit tests on `sizePvAndBattery`, hand-computed expectations |
| v | Load comes from `annualUsageKwh`, not from 102 | Two usages, same location, asserted proportional; 102 appears in no sizing path |
| vi | No figure in the model's prose that was not in its input | Validator unit tests in both directions, plus a route test with a fabricated figure asserting 502 `invalid_model_response` |
| vii | The 200 carries `resolution`, and the tab renders it through the shared label map | Route test asserts the block; the render site is the evidence for G7, read in the ruling |
| viii | Full suite green; root `pnpm run typecheck` clean; CI green on the pushed branch | Recorded with counts |

**Rollback.** `git revert -m 1 <merge>` — computed on a scratch ref and proven to apply,
**not** executed. Nothing is merged and nothing is pushed to `main`, so under G8/A16 this is
Tier B and its deploy path is **UNPROVEN**. The ruling must say so; A16 makes the omission
the breach.
