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

## EU AI Act classification (added 3 Nov 2026, VPUB audit)

An assessment written by the provider, not a legal opinion. Texts read on 3 Nov 2026 at
artificialintelligenceact.eu (Article 3, Article 6, Annex III).

1. **Article 3(1).** An AI system "infers, from the input it receives, how to generate outputs".
   The index above is a closed-form formula with hand-set weights and data-measured credibility
   values, with no trained model and no ML library. Assessment: most likely not an AI system.
   The Assistant and the Optimizer's prose are AI systems (a language model writes them).
2. **Annex III, point 5(a)** covers systems used by or for public authorities to evaluate the
   eligibility of natural persons for public assistance, or to grant or revoke it. The index ranks
   buildings for a technical visit; it evaluates no person and grants nothing. Not met.
3. **Annex III, point 2** covers safety components in the supply of heating or electricity.
   Voltura controls nothing. Not met. Points 5(b) and 5(c) (credit, life and health insurance):
   not met.
4. **Article 6(3), last sentence:** an Annex III system that profiles natural persons is always
   high-risk. The People factor uses census-section shares, not individuals. Single-dwelling
   buildings are not published one by one (3 Nov 2026), pending a data-protection opinion.
5. **Article 6(4)** (document the assessment, register under Article 49(2)) applies only to
   systems listed in Annex III, so it is not triggered. This section is kept anyway.
6. **Re-assess** if the intended purpose moves toward allocating aid to households, or if a
   trained model enters `lib/screening`.
