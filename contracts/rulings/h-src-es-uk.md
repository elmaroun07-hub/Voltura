# Ruling — Block H-SRC-ES-UK

**Branch:** `heatshield/h-src-es-uk`, off `main` at `9034c99`. **Status:** OPEN (in progress — sections below are filled as each is proven).
**Executed:** 21 Sept 2026. Operator amendment A21 (location-based carbon) is the first commit on the branch.

---

## Preconditions (Step 0)

| Check | Result |
|---|---|
| `git status` clean | **Deviation.** One untracked file: `contracts/blocks/h-src-es-uk.md` — the block file the operator placed for this run. It cannot be tracked before the block runs. Committed on the branch with A21. Nothing else was untracked or modified. |
| on `main`, `git rev-parse --short main` | `main` / `9034c99` ✔ |
| live `/api/version` | `{"sha":"9034c99", ...,"source":"render"}` ✔ |
| baseline suite | `pnpm -r test`: `lib/cte` 72 + `artifacts/api-server` 171 = **243** ✔ (notes said 243; verified, not copied) |
| repo location | `C:\Users\elmar\Desktop\Desktopdev\Green-Energy-Calc` (found on disk; scratch session was empty) |

## Real paths found in the tree (block file quoted them from notes)

| Thing | Real path |
|---|---|
| Spain CNMC registry | `data/sources/es.yaml` (17 entries) |
| Registry loader | `artifacts/api-server/src/lib/emissions/registry.ts` |
| Spain resolver | `artifacts/api-server/src/lib/emissions/es.ts` |
| Combining module | `artifacts/api-server/src/lib/emissions/carbon-source.ts` |
| Legacy country table | `artifacts/api-server/src/lib/carbon-intensity.ts` |
| Routes / geocode / calculate / optimize / PDF | `artifacts/api-server/src/routes/routes.ts` (`geocode()` ~L74, `resolveLocationIrradiance()` ~L493, `/api/calculate` ~L873, `/api/optimize` ~L1068) |
| Response schema (server) | `artifacts/api-server/src/shared-routes.ts` |
| Request schema (server, Zod) | `lib/db/src/schema/schema.ts` `calculationInputSchema` |
| Client mirror of schemas | `artifacts/green-energy-calculator/src/lib/api.ts` |
| Client money render sites | `…/components/calculator/ResultsDisplay.tsx`, `CalculatorForm.tsx`, `…/pages/History.tsx` |
| Amendment numbering | `contracts/AMENDMENTS.md` — last numbered was A20; this block's is **A21** |

---

## Sources (pulled from this machine, 21 Sept 2026; every raw byte pinned by sha256 — see "Fixtures")

### S1 — Eurostat `nrg_pc_204`, ES + UK — `contracts/fixtures/eurostat-nrg_pc_204-ES-UK-2025S2.raw`

URL (as given, accepted first time — no dimension code was rejected):
`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204?format=JSON&lang=EN&geo=ES&geo=UK&nrg_cons=KWH2500-4999&currency=NAC&unit=KWH&tax=I_TAX&time=2025-S2`
Pulled 2026-09-21T20:46:49Z, HTTP 200. Dataset label: *Electricity prices for household consumers - bi-annual data (from 2007 onwards)*. `updated: 2026-08-12T11:00:00+0200`. Band label: *"Consumption from 2 500 kWh to 4 999 kWh - band DC"*; tax label *"All taxes and levies included"*; currency *"National currency"*.

Raw value-bearing part, verbatim:
```
"value":{"0":0.2669}, "id":["freq","siec","nrg_cons","unit","tax","currency","geo","time"],
"size":[1,1,1,1,1,1,2,1], geo index {"ES":0,"UK":1}
```
- **ES = 0.2669 EUR/kWh** (index 0), period 2025-S2, all taxes included, band DC.
- **UK = NO VALUE.** `size` says two geos; `value` carries one observation. Index 1 (UK) is absent.

**Probe** — `eurostat-nrg_pc_204-UK-alltime-probe.raw`: UK, same band/tax/currency, all periods: 26 observations, **last = 2020-S1, 0.1927 GBP**. A second probe (`geo=UK&geo=ES&sinceTimePeriod=2024-S1`) returned four observations, all Spain (`size [..,2,4]`, four values at indices 0–3 = ES 2024-S1 0.2436, 2024-S2 0.2408, 2025-S1 0.2612, 2025-S2 0.2669). `geo=GB` returns an empty dataset. Eurostat has published no UK figure for this dataset since 2020-S1.

> **REFUSAL — H-SRC-ES-UK.PhaseB.UKtariff** (raised to the operator mid-run under §5; ruled by the operator in chat)
> Instruction: UK tariff = Eurostat `nrg_pc_204` UK value from the pull, GBP, taxes included, period 2025-S2.
> Reality: no such value exists (above). The UK left Eurostat's reporting after 2020-S1.
> Conflict: block Phase B / ruling "tariff source for both countries is Eurostat" cannot be satisfied by any code path; "no number enters code from the block's prose" forbids substituting Ofgem.
> Options offered: (1) UK tariff `pending`; (2) Ofgem as the value (reverses the ruling); (3) stop.
> **Operator ruled: (1) `pending`.** The UK entry carries currency GBP, authority Eurostat, the reason, and Ofgem 26.32 p/kWh as a *note only*. London's money figure renders `pending` unless the user types a tariff. Consequence for AC5/AC12: London still resolves in GBP; it does not produce a computed tariff-based £ figure by default.

### S2 — REE REData, peninsular carbon factor — `contracts/fixtures/ree-emissions-peninsular-2025.raw`

URL (as given, accepted first time): `https://apidatos.ree.es/es/datos/generacion/no-renovables-detalle-emisiones-CO2?start_date=2025-01-01T00:00&end_date=2025-12-31T23:59&time_trunc=year&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`
Pulled 2026-09-21T20:48:37Z, HTTP 200, no token. Widget `gen7`, title *"Emisiones y factor de emisión de CO2 en generación no renovables"*, `last-update: 2026-05-11T21:41:15.000+02:00`.

Extracted, verbatim from the response:

| id | title | value | unit |
|---|---|---|---|
| 1587 | Ciclo combinado | 14359873.836 | tCO2 eq. |
| 10317 | Cogeneración | 5659740.784999999 | tCO2 eq. |
| 10315 | Carbón | 1363517.1729999983 | tCO2 eq. |
| 1584 | Turbina de vapor | 628957.537 | tCO2 eq. |
| 10318 | Residuos no renovables | 221243.81599999993 | tCO2 eq. |
| tCO2 eq. | Total | 22233333.148 | tCO2 eq. |
| **MWh** | **tCO2 eq./MWh** | **0.08613556944796785** | — |

**Peninsular 2025 factor = 0.08613556944796785 tCO₂eq/MWh = 86.13556944796785 g/kWh** (unrounded; ×1000 for g/kWh is exact). The "~107 g/kWh recorded from an earlier session" was **not** this figure — it is the CNMC national number; the pull decided it.

**Sanity check (block's rule: peninsular ≤ national, else wrong system → halt):**
Control pull `ree-emissions-nacional-control-2025.raw` (same call, no `geo_limit`): total **29,526,035.901999995 t** — matches REE's own page figure (29,526,035.9 t) to the digit — and factor **0.10842352300681778**. Peninsular 0.0861 < national 0.1084 ✔. The geo parameters are honoured (22.23 Mt vs 29.53 Mt): not a response that ignores the system. Implied peninsular generation 258.1 TWh — physically consistent.

### S3 — UNEF install cost (Spain): **`pending`**

Searched UNEF's own pages by fetching them from this machine: `unef.es/es/autoconsumo`, `autoconsumo.unef.es/` and `/instalacion-vivienda-unifamiliar/`, `unef.es/es/recursos-informes`, and four UNEF press posts (`…9-3-gw-instalados`, `…umbral-de-los-8gw`, `…tras-el-apagon`, `…primer-trimestre-de-2025`). **None states €1,100–1,500/kWp, nor any €/kWp, €/Wp or "coste medio" figure.** (The *Informe Anual* is a download not exposed as text on those pages.)
The only place the range appears is a secondary site — Tu Energía Verde, *"Placas solares precio 2026"* (`tuenergiaverde.es/guias/placas-solares-precio-2026`), which writes "según datos de la Unión Española Fotovoltaica (UNEF) y análisis de mercado de OCU" without a UNEF document, date or page. Saved as `secondary-tuenergiaverde-placas-solares-precio-2026.html` **as evidence of what was found, not as a source.**
Per the block ("a secondary site quoting UNEF is not the source"): **Spain `installCost` = `pending`.** No number is used. The range-rendering code and its tests still ship (P0.4), exercised with a synthetic test entry labelled as such; the day UNEF's own document is found, only the YAML changes.

### S4 — DESNZ (UK)

**Carbon** — *Greenhouse gas reporting: conversion factors 2026* (`gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026`; page saved `desnz-ghg-2026-publication-page.html`). Page `datePublished` **2026-06-11T09:30:00+01:00**, `dateModified` 2026-07-31 (a *revised flat-format* file was added; the page states the full set "published in June … has not been revised"). Workbook `ghg-conversion-factors-2026-full-set.xlsx` (2,109,334 B), sheet `UK electricity`, row *Electricity generated / Electricity: UK / kWh / 2026*: **0.13096 kg CO2e/kWh** (CO2 0.12943, CH4 0.00067, N2O 0.00086) = **130.96 g/kWh**. Sheet `Transmission and distribution`, *T&D- UK electricity / 2026*: **0.01299** (excluded). Same sheet states the gov's environmental-reporting guidelines *require location-based grid-average factors* — consistent with A21. **Matches the block's table exactly.**

**Install cost** — *Solar photovoltaic (PV) cost data* (`gov.uk/government/statistics/solar-pv-cost-data`, `dateModified` 2026-05-28; workbooks say "published on Thursday 28th May 2026", "April 2025 to March 2026", MCS installs, Great Britain excl. NI). Two workbooks exist for 2025/26 and give different numbers — the block did not say which:

| Measure | 0–4 kW domestic mean | 4–10 kW domestic mean | status |
|---|---|---|---|
| **TIC** (Total Installed Capacity) — `Solar_Costs_2025-26__TIC_.xlsx`, sheet *Domestic costs (TIC)* | **1954.53** £/kW | **1644.70** £/kW | "official statistics in development" |
| DNC (Declared Net Capacity) — `…__DNC_.xlsx`, sheet *Domestic costs (DNC)* | 2095.51 | 1785.16 | official statistics |

**Difference from the block's table (the DESNZ page wins):**
1. The block's **£1,955 / £1,645 are the TIC domestic *mean*, rounded to the pound**. Entered as data they would be rounded display values. The entry stores **1954.53** and **1644.70**.
2. The block says "**VAT included**". DESNZ Note 1 says cost includes "VAT **where applicable**, VAT rates vary over time", and excludes batteries and extended warranties. The entry records `taxBasis: vat_where_applicable`, not `incl_vat`.
3. The bands are **0–4 kW** and **4–10 kW** (TIC-based), not "≤4 kW". The cover sheet warns a system's band depends on TIC vs DNC. TIC is the measure matching a user's kWp (panel capacity), so TIC is used; DNC recorded in the entry note.
4. The cost excludes battery storage → the registry cost is **PV only**. The resolver refuses to pair it with a battery (see design).

### S5 — Ofgem (note only, never the value)
Taken as given in the block's Phase B table ("Ofgem cap 1 Oct – 31 Dec 2026: 26.32 p/kWh ex-VAT energy unit rate; standing charge 54.83 p/day; Direct Debit, GB average; domestic electricity VAT-free 1 Oct 2026 – 31 Mar 2027; set 26 Aug 2026"). **Not independently fetched this run** — recorded as a note the operator supplied, flagged as such in the entry (`note`), and never used as a value.

### S6 — CNMC residual mix (note only)
`257.712 g/kWh` (CNMC Circular 2/2021 art. 7.3, `EtiquetadoRestante_2025.xls`) — recorded as market-based note per A21; not fetched this run; carried from the operator's block table and the existing `es.yaml` (`es-carbon-supply-residual-2025`, 258).

---

## Computed expected values (written before the checks that compare against them)

Fuengirola, standard request (5,000 kWh/yr, 4,000 W PV, 10 kWh battery). Production `9034c99` "before", captured 2026-09-21T20:58:19Z:
`savingsKwh 3860, co2Reduction 996, annualSavingsEur 965.1, carbonIntensity 0.258, installationCostEur 9800, paybackYears 9.5` (`prod-9034c99-calculate-fuengirola-before.json`).

| | Rule | Expected |
|---|---|---|
| savings | unchanged | **3,860 kWh** |
| **AC4 CO₂** | 3,860 × 0.08613556944796785 | **332.4832980691559 kg → reported 332** (the "≈413" in the block was for 0.107; the pull decided 0.0861) |
| **AC4 €** | 3,860 × 0.2669 | **1030.234 → 1030.23 EUR** |
| annual-savings movement | 1030.23 − 965.10 | +65.13 EUR (tariff 0.25 default → 0.2669 Eurostat) |
| CO₂ movement | 332 vs 996 | −664 kg, ×0.334 (the amendment's "roughly 2.4×" was vs 107; against the 258 in production the factor falls 3.0×, 0.258 → 0.0861 — reported, not disputed) |

Test will be written against the *registry-read* values, and I additionally pin these two literals in the ruling only (not in test code — "no test may hardcode a carbon value").

---

## Fixtures (sha256 — every one pinned by a test, see `source-fixtures.test.ts`)

```
FIXTURE_HASHES_PLACEHOLDER
```

*(remaining sections — Design, Acceptance evidence, Mutation check, Rollback, Residue, Ruling — are appended as they are proven)*
