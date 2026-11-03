# VPUB-SEC — 6c: lib/screening has no trained model and no ML library

Date: 3 Nov 2026. Branch: vpub/phase2. Report only; no code changed.

## Imports in `lib/screening/src`

Nothing outside this list is imported. No dynamic `import()`, no `require()`, no
side-effect imports.

| Module | Imported by |
|---|---|
| `@workspace/cte` | `climate.ts`, `orientation.ts` |
| `pg` | `db/census-db`, `db/climate-db`, `db/epc-db`, `db/index-db`, `db/ingest`, `db/portfolio`, `db/facades.integration.test` |
| `node:fs`, `node:url` | tests only: `gml.test`, `census.test`, `epc.test`, `facades.integration.test` |
| `vitest` | tests only (8 files) |

All other imports are relative, within the package.

- `package.json` dependencies: `@workspace/cte`, `pg`. Dev: `@types/node`, `@types/pg`, `vitest`.
- `@workspace/cte` has no dependencies; its only external import is `vitest`, in tests.
- No model artefact in the package (`.pkl`, `.onnx`, `.pt`, `.h5`, `.joblib`, `.safetensors`, `.npy`: none).
- A search of the source for tensorflow, onnx, scikit/sklearn, torch, regression, random forest,
  neural, train, `.fit(`, predict: no matches.

## How the index is computed (`src/heat-index.ts`)

A closed-form formula with fixed weights. Each factor is a ratio to the
municipality's residential median (1.0 = typical).

- **Hz, hazard** (point): July horizontal irradiation of the building's CTE zone
  (DA DB-HE/1 tables 20/21) / median.
- **Ex, exposure** (point): `(1 + façade term / median) / 2`; façade term = July irradiation
  on exposed street façades per metre of perimeter. The roof half is the constant 1.
- **En, sensitivity** (range): cooling demand, kWh/m²·year, from the Junta's certificate
  register / median. Certificate values are capped at the municipality's 99th percentile first.
- **Vu, people** (point): mean of three census-section ratios to the median: share aged over 64,
  one-person households, unemployment. No census section: municipality p10/p50/p90 of Vu.
- **Weights:** Hz 1/6, Ex 1/6, En 1/3, Vu 1/3 (IPCC AR5 risk thirds).
- **Combination:** weighted geometric mean `exp(Σ wᵢ·ln vᵢ / Σ wᵢ)`, computed for the low, mid and
  high ends; throws if any factor ≤ 0. Ranking uses the high end.
- **En without a certificate:** p10/p50/p90 of certified buildings in the same age band
  (pre-1980, 1980–2006, 2007-on); no year: all certified buildings.

### Credibility step (v2, `METHOD_V2`)

- With a certificate: `En = w · own entries + (1 − w) · age-band prior`, applied to min/median/max
  against p10/p50/p90.
- v1: `w = min(1, entries / dwellings)`.
- v2: `w = min(1, entries / dwellings) × entries / (entries + k)`.
- `k` is measured per age band (Bühlmann–Straub) on capped entries, one per unit:
  `k = EPV / VHM`, with `EPV = Σᵢ Σⱼ (xᵢⱼ − x̄ᵢ)² / Σᵢ (nᵢ − 1)` and
  `VHM = [Σᵢ nᵢ (x̄ᵢ − x̄)² − (r − 1)·EPV] / (N − Σ nᵢ² / N)`.
- No constant is chosen by hand. If VHM ≤ 0, or no building in a band has two entries, `k` is
  undefined and the run is refused (P2), never filled with a value. Each run records `k`, EPV, VHM,
  buildings and entries per band.
