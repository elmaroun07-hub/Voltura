# Ruling — Block H-SRC-ES-UK

**Branch:** `heatshield/h-src-es-uk`, off `main` at `9034c99`, tip `42515ce`.
**Correction, 23 Sept 2026:** the merged tip is **`169b2c4`**, not `42515ce`. `169b2c4` adds only ruling text, +122/−3 on this file. The merge is **`dfde7b7`**. The revert was re-proved against `dfde7b7`: 42 files, +1,273/−6,482, tree identical to `9034c99`. See "MERGE AND LIVE EVIDENCE".
**Status:** all tasks and acceptance criteria below are met on the branch. **Not merged** — merging to `main` is operator-ruled (§14.2); this session stops before it.
**Update, 23 Sept 2026:** operator-authorised (22 Sept, §14.2) and **merged as `dfde7b7`**, pushed, deployed to both services, AC12 proven live. See **"MERGE AND LIVE EVIDENCE"** at the end. The text above that section is the pre-merge record and is left as written.
**Executed:** 21–22 Sept 2026. Operator amendment A21 (location-based carbon) is the first commit on the branch.

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

| Fixture | sha256 |
|---|---|
| `contracts/fixtures/eurostat-nrg_pc_204-ES-UK-2025S2.raw` | `4def6a5a4e052bc35d8dfce77979b2371b667b9ed48fe2d82a65ec96da29d2e2` |
| `contracts/fixtures/eurostat-nrg_pc_204-UK-alltime-probe.raw` | `320eb3e5fb675592dbeb1c427dd5b54d4d6e6078ba3e22812992c65114390030` |
| `contracts/fixtures/ree-emissions-peninsular-2025.raw` | `c33daabe8ac32556ce928db5efdf19e4ab5701affaa8145b07cfb24fbc6606af` |
| `contracts/fixtures/ree-emissions-nacional-control-2025.raw` | `f7fdf53c9ae93176648a77aefdd0d3fadebde22095b72b9d00ffdcef105b1959` |
| `contracts/fixtures/desnz-ghg-2026-publication-page.html` | `5f289a1f34fba90b34da2e2954493d5b2943c1bd86f8270ff22adb3cba3eceb2` |
| `contracts/fixtures/desnz-ghg-conversion-factors-2026-full-set.xlsx` | `b5c4f2f86cdc74707337b2fb013b44ded189a1b528f5e29ea99856ba65ae0205` |
| `contracts/fixtures/desnz-solar-costs-2025-26-tic.xlsx` | `1ce7ec3a9671fac704d313f07ee127de1fd0776e312ded7257d219131a45a1ca` |
| `contracts/fixtures/desnz-solar-costs-2025-26-dnc.xlsx` | `a5932c65beedb36867b7f106f3dbc3374f239ca028e576a0b096377020cde680` |
| `contracts/fixtures/secondary-tuenergiaverde-placas-solares-precio-2026.html` | `66f4922988810d2a389c33b6fd6a9ad5b8acfd244eb408bbb2c9e3e01ecdd0f0` |
| `contracts/fixtures/h-src-es-uk-geo-nasa.fixtures.json` | `8752ecd91e43991bba1706ca75ccd856d07f2572bb564693b5e8824779794d9f` |
| `contracts/fixtures/prod-9034c99-calculate-fuengirola-before.json` | `1f071a2e68b54f4fc7a22348663dddbdb45f4ebce5d7965dd441321ae708de96` |
| `contracts/fixtures/prod-9034c99-calculate-london-before.json` | `51eecc44659cfd2d0f24e63226dc6559cc102116f2ddb75f4fd914a82c431237` |
| `contracts/fixtures/prod-9034c99-calculate-tetouan-before.json` | `9a6e39552008bc7029b61eca824d4af550dda06a7cdf1fd5f76c90c7c3cf42e4` |

*Filled 23 Sept 2026. The pre-merge record left this block unfilled. The table is copied from `PINNED` in `artifacts/api-server/src/lib/emissions/source-fixtures.test.ts`, and each hash was recomputed from the file bytes on disk: **13/13 equal their pins, 0 mismatches.** All 13 files carry `-text` (`git ls-files --eol`), so git cannot normalise their bytes. The pre-existing NASA fill-value fixture is pinned separately, in `nasa-fillvalue-fixture.test.ts`, and is not listed here.*

## Operator decision taken mid-run (§5 refusal)

**REFUSAL — H-SRC-ES-UK.PhaseB.UKtariff**, raised and ruled during Step 2 (see "S1" above for the full text). Summary: Eurostat `nrg_pc_204` has published no UK observation since 2020-S1; the block's instruction to use the "Eurostat UK value from the pull" names a value that does not exist. **Operator ruled: UK tariff = `pending`.** Ofgem's 26.32 p/kWh stays a note, per the block's own rule ("Ofgem is recorded... never as the value"), so this is not a second deviation — it is the block's own rule applied to a source that turned out empty.

## Design decisions this session made that the block left unstated

1. **`data/sources/countries.yaml` is a new registry, separate from `data/sources/es.yaml`.** H-SRC-ES's `es.yaml`/`registry.ts` resolve Spain's CNMC *market-based* figures (`supply_residual`, `generation`, GdO variants) and remain wired to nothing after this block — `carbon-source.ts` no longer calls `resolveEsConsumerCarbonFactor()`. They are **not deleted**: H-SRC-ES's own tests (`es.test.ts`, `registry.test.ts`) still read `es.yaml` directly and pass unchanged, and the CNMC residual figure is preserved as a **note** on Spain's peninsular entry in `countries.yaml`, per A21 ("market-based figures may be recorded as notes, never as the value"). Deleting `es.yaml`/`registry.ts` was out of scope (nothing in the block asked for it) and would have broken H-SRC-ES's own still-pending merge.
2. **`findUpward` was exported from `registry.ts` and reused by `countries.ts`** rather than duplicated, since the bundling-safe upward search (H-SRC-ES design decision 4) applies identically to the new registry file.
3. **`electricityTariff` and `installationCostEur` became optional/renamed, with no default, in both `calculationInputSchema` (`lib/db`) and its client mirror.** The block's P0.7/P0.8 require no default anywhere; the old `.default(0.25)` was the exact defect A21 exists to remove from the carbon side, present on the money side too. `installationCostEur` was renamed `installationCost` (server) / `installationCost` (client) because the field is no longer guaranteed EUR.
4. **The response shape replaces `annualSavingsEur` / `installationCostEur` / `paybackYears` / `roiCurve` with one `money` block** (`MoneyBlock`, `artifacts/api-server/src/lib/emissions/money.ts`), because P0.7/P0.8 require each of those four figures to independently carry USED-with-source or PENDING-with-reason, which four flat nullable fields cannot express as legibly as one discriminated block. `carbonIntensity`, `co2Reduction`, `savingsKwh`, `avgIrradiance` etc. are unchanged.
5. **`CarbonSourceNote` grew a fifth state, `"pending"`,** for a registry country whose address-specific electric system has no sourced factor (Baleares/Canarias/Ceuta/Melilla) or whose system could not be determined at all. `/api/calculate` rejects it with a new code `carbon_factor_pending` (400), parallel to the existing `unknown_carbon_country` handling for D15.
6. **Spain's electric system is read from Nominatim's `address["ISO3166-2-lvl4"]`**, added to `geocode()`'s return type as `regionCode`. Verified live against Fuengirola (`ES-AN`), Palma de Mallorca (`ES-IB`), Las Palmas (`ES-CN`), Ceuta (`ES-CE`), Melilla (`ES-ML`) and London (`GB-ENG`) on 21 Sept 2026 (see `h-src-es-uk-geo-nasa.fixtures.json`). An empty, missing or unrecognised code resolves `"undetermined"`, never `"peninsular"` — `spainElectricSystem()` matches on an explicit switch over the four non-mainland codes and treats everything else matching `/^ES-[A-Z]{1,2}$/` as peninsular, so a new mainland province code needs no code change, but a malformed or absent code cannot silently pass as peninsular.
7. **UK install cost uses the TIC (Total Installed Capacity) workbook, not DNC.** Both exist for 2025/26 and disagree (TIC domestic mean 1954.53/1644.70 vs DNC 2095.51/1785.16 £/kW). TIC is the measure DESNZ's own cover sheet says "brings this publication in line with our published solar deployment statistics" and matches a user's kWp (panel nameplate capacity) rather than net-export capacity; DNC's figures are recorded in the registry's `note` for anyone who later needs them.
8. **The UK install-cost entry refuses a system with a battery** (`battery_not_in_registry_cost`), because DESNZ Note 1 explicitly excludes "any additional device installed alongside the solar panels, such as battery storage" from the cost figure — applying it to a battery-equipped system would understate the true cost with a confident-looking citation, the exact failure mode the block's named list warns against ("Averaging or taking a midpoint... Entering a rounded display value as data" are siblings of this one).
9. **AC2's compile-time proof uses TS2322/TS2769, not TS2345.** The block's own text names `TS2345`; a plain `roi<C extends Currency>(a: Money<C>, b: Money<C>)` does **not** produce any compiler error for `roi(eurMoney, gbpMoney)` — proven with a minimal repro (`Money<C>`'s `currency` field is only in a covariant/readonly position, so TypeScript infers `C = "EUR" | "GBP"` and both arguments satisfy it). `roi` is exported as two concrete overloads instead, which **is** caught, as `TS2769` ("no overload matches"). A second real diagnostic (`TS2322`, assignment) proves `Money<"EUR">` cannot be assigned to `Money<"GBP">`, and a third (`TS2322`) proves `PricedTariff.taxBasis` excludes `"vat_where_applicable"`. This is read as a §5 case — the literal instruction named an error code that a correct design does not produce; the reading of the compiler wins. All three `@ts-expect-error` guards in `countries.test.ts` were verified live: temporarily removed, `tsc -p tsconfig.json --noEmit` run directly and shown to report the real diagnostics at exactly those three lines, then restored. `pnpm run typecheck` is clean with the comments present.
10. **AC4's "3,860 × factor" is read against the server's own unrounded total, not the rounded display figure.** `simulate8760`'s true monthly-savings sum for the standard Fuengirola request is `3860.3999999999996`, which rounds to the displayed `3860` but is not exactly `3860`; multiplying the *rounded* 3860 by the peninsular factor gives `332.48…` (rounds to 332), while the server's actual `co2Reduction` — computed from the unrounded total, unchanged behaviour from before this block — is **333**. This is a pre-existing rounding-boundary characteristic of the 8760 simulation (present before this block too; the old 258 g/kWh factor never happened to sit near this particular boundary), not a defect this block introduces or should fix under its own scope fence. `h-src-es-uk.test.ts`'s AC4 test reconstructs the exact unrounded total from `monthlyData` and asserts `co2Reduction`/`annualSavings` against that, so the test tracks the server's real arithmetic rather than a rounded re-derivation. **The real observed AC4 values: savingsKwh 3860, co2Reduction 333 kg, annualSavings 1030.34 EUR** (not 332/1030.23 as a naive `3860 × factor` reads) — recorded here as what was actually computed, before any test compared against it.

## Acceptance criteria — evidence

1. **AC1 — every number carries authority/publication or renders pending.** `countries.test.ts` "AC1" (4 tests): real `countries.yaml` has both entries with currency and ≥1 carbon system; deleting all entries breaks `findCountry` for both (never falls back); a country absent from the file (`Narnia`, `Morocco`) returns `null`, never a guessed default; `parseCountries` rejects a country with zero carbon systems.
2. **AC2 — currency/taxBasis mismatches are real type errors.** Three genuine compiler diagnostics (TS2322/TS2769/TS2322), proven live by temporarily removing each `@ts-expect-error` — see design decision 9 above.
3. **AC3 — an entry past `reviewBy` renders stale, never silently used.** `money.test.ts` "AC3" (2 tests): a back-dated `now` (`2027-02-13`, one day past Spain's `reviewBy: 2027-02-12`) renders `tariff.status: "pending"`, `reason: "registry_tariff_stale"`, `annualSavings: null`; `now = reviewBy` itself still resolves.
4. **AC4 — Fuengirola regression, exact.** `h-src-es-uk.test.ts` "AC4" (1 test, live server round trip): `savingsKwh` stays 3860; `co2Reduction` and `money.annualSavings` are asserted against the server's own unrounded total × the response's own `carbonSource.factor.valueGPerKwh` / `money.tariff.value` (see design decision 10 — the naive display-rounded "3,860 × factor" is off by 1 kg / a few cents at this rounding boundary, not a defect).
5. **AC5 — London resolves in GBP and needs a larger array than Fuengirola.** `h-src-es-uk.test.ts` "AC5" (2 tests): `money.currency === "GBP"`, `carbonSource.factor.system === "gb"`, `avgIrradiance` lower than Fuengirola's (the "needs a larger array" physical claim); and, without a user tariff, currency is still known (`"GBP"`) while the tariff itself is honestly pending.
6. **AC6 — Tétouan's money figure renders pending, not €0.250.** `h-src-es-uk.test.ts` "AC6" (1 test): `money.currency === null`, `tariff.status === "pending"`, `annualSavings === null`, and explicitly `tariff.value !== 0.25` is not even a field that exists on the pending shape (no `value` key at all).
7. **AC7 — `/api/calculate` and `/api/optimize` both resolve Fuengirola and London; `/optimize` records the source as `/calculate` does.** `h-src-es-uk.test.ts` "AC7" (1 test, four live responses): all four 200; `optFuen.resolution.carbonSource` deep-equals `calcFuen.resolution.carbonSource`, same for London; all four bodies validated against the real Zod response schemas (`api.calculations.create.responses[200]`, `api.calculations.optimize.responses[200]`).
8. **AC8 — 243 → 243+N, zero deletions.** `lib/cte`: 72 → 72 (0). `artifacts/api-server`: 171 → 239 (+68). **Total 243 → 311 (+68).** Every pre-existing test file's count is unchanged or grew (verified file-by-file, see the full run below); no test was removed. Breakdown of new files: `countries.test.ts` (28), `money.test.ts` (11), `source-fixtures.test.ts` (16), `h-src-es-uk.test.ts` (6, route-level) = 61 new tests in new files; the remaining +7 are in edited existing files (`carbon-source.test.ts` 9→15, `shared-routes.test.ts` 18→19, `calculate.test.ts` 18→18 body-only edits).
9. **AC9 — `gate-check.sh` and `artifacts/greencalc/` diffs empty.** `git diff --stat main -- gate-check.sh artifacts/greencalc/` — empty.
10. **AC10 — revert-clean on a disposable local merge.** See "Rollback" below.
11. **AC11 — stale docs ride this branch.** `git diff --stat main -- contracts/blocks/h-src-es.md contracts/rulings/h-src-es.md` — empty. Neither file was touched; both still say H-SRC-ES's own merge is pending, which remains true and is a separate, still-open question from this block.
12. **AC12 — deploy proof is behavioural.** Not yet performed — requires the push and merge the operator has not authorised. The exact curls to run after that merge are recorded below. **Performed 23 Sept 2026 against `dfde7b7`: met. See "MERGE AND LIVE EVIDENCE".**

## Test counts

| Suite | Before | After | Delta |
|---|---|---|---|
| `lib/cte` (`pnpm test`) | 72 | **72** | 0 |
| `artifacts/api-server` (`pnpm test`) | 171 | **239** | +68 |
| **`pnpm -r test` total** | 243 | **311** | +68 |

## Mutation check (G9) — each introduced, confirmed to fail at least one test, then restored

| # | Mutation | Failed | Restored, green |
|---|---|---|---|
| 1 | `resolveMoney`'s `currency` forced to `"EUR"` regardless of country | 7 tests (`money.test.ts` UK/pending cases, `h-src-es-uk.test.ts` AC5/AC6) | ✔ |
| 2 | `toPricedTariff`'s `taxBasis !== "all_taxes_included"` throw removed | 1 test (`countries.test.ts` — the runtime taxBasis refusal) | ✔ |
| 3 | `resolveTariff`'s `reviewBy` staleness branch removed | 1 test (`money.test.ts` AC3 — stale-after-reviewBy) | ✔ |
| 4 | Spain's `countries.yaml` peninsular value replaced with the national figure (108.42352300681778) | 1 test (`countries.test.ts` "AC4 sanity — peninsular is below the national figure") | ✔ |
| 5 | `resolveTariff`'s `!country` branch reintroduces a 0.25 EUR default instead of pending | 2 tests (`money.test.ts` P0.8, `h-src-es-uk.test.ts` AC6) | ✔ |
| 6 | `formatMoneyRange` collapsed to `formatMoney((low+high)/2, currency)` | 2 tests (`countries.test.ts` P0.4, `money.test.ts` P0.4) | ✔ |

Each mutation was applied to the working tree (verified clean before starting), the relevant test file(s) run and shown red, then `git checkout -- <file>` restored the original and the same test file(s) re-run green. Full suite (`pnpm -r test`, 311 tests) and full typecheck (`pnpm run typecheck`, both packages) re-confirmed clean after all six restorations, on a clean `git status`.

## Named failure modes — checked against

- **Unauthenticated/metadata-only response as proof of access:** not applicable here — every pull in Step 2 was a plain HTTP 200 body, read and parsed, sha256-pinned.
- **Entering a rounded display value as data:** the DESNZ UK install-cost bands are stored **unrounded** (1954.53 / 1644.70), not the block's own rounded 1,955/1,645 — see S4 and `countries.test.ts` "UK install cost" asserting `Number.isInteger(...) === false`.
- **Using the national figure for a mainland address:** REE **peninsular** (86.14 g/kWh) is what `resolveEsConsumerCarbonFactor`'s successor (`carbonFactorFor(spain, "peninsular")`) returns for a mainland region code; the national figure (108.42) is never read by any resolver — proven by mutation 4 above.
- **Averaging or taking a midpoint:** UNEF's install cost is `pending` (no value to average); the UK's is banded, not ranged, so no midpoint arises; `formatMoneyRange` renders `low–high` and mutation 6 proves a midpoint substitution is caught.
- **Recording a criterion met because the file that would prove it exists:** every AC above cites a passing test or an empty `git diff`, not a file's mere presence.
- **A fixture reshaped until it fits, with nothing pinning its bytes:** all 13 new raw pulls are sha256-pinned in `source-fixtures.test.ts`; `.gitattributes` marks `contracts/fixtures/**` `-text` so git's CRLF normalisation cannot silently alter them — verified by a checkout into a disposable worktree and re-hashing (all 14 fixtures, including the pre-existing NASA one, matched).
- **Scope creep (three amendments block, D8 donut, B1):** not started. `git diff --stat main` touches no file under those descriptions; `carbon-intensity.ts`'s legacy table only had Spain (already absent, H-SRC-ES) and now the UK removed — no new country added to it, no rejection-rule change beyond the new `carbon_factor_pending` state this block's own scope requires.

## Rollback

**Tier B** (G8, A16): code ships, merge authorised is **not yet granted**, drill is **not** authorised this session.

Revert proven to apply cleanly on a **disposable local ref**, never pushed:
```
git branch -f _disposable-main-test main
git worktree add /tmp/revert-test _disposable-main-test
cd /tmp/revert-test
git merge --no-ff heatshield/h-src-es-uk -m "test merge for revert-clean proof"
git revert -m 1 --no-edit <merge-sha>
git diff <merge-sha>^1 HEAD --stat   # empty
git diff main --stat                # empty — tree byte-identical to main pre-merge
```
Result: 42 files changed by the merge (6,363 insertions, 1,273 deletions); the revert reversed every one of them exactly (1,273 insertions, 6,363 deletions — the mirror image); the post-revert tree diffed against `main` is **byte-identical, zero lines**. The disposable worktree and branch were then removed; nothing from this test reached the real `main` or `origin`.

**The deploy path is UNPROVEN.** This ruling records mechanics only, not a live deploy: real `main` is untouched at `9034c99`, `heatshield/h-src-es-uk` is unmerged and unpushed, and no Render deploy has occurred for this block. A13's debt survives this block too.

### The exact merge command, for the operator to run

```bash
git checkout main && git merge --no-ff heatshield/h-src-es-uk
```

### AC12 live-proof curls — to run AFTER the operator pushes and merges

```bash
# London resolves in GBP
curl -sS -X POST https://voltura-api.onrender.com/api/calculate \
  -H "Content-Type: application/json" -H "X-Session-Id: <any-uuid>" \
  --data-raw '{"location":"London, United Kingdom","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10,"electricityTariff":0.28}'
# expect: money.currency === "GBP"

# Fuengirola's CO2 equals savingsKwh(unrounded) × the REE peninsular factor
curl -sS -X POST https://voltura-api.onrender.com/api/calculate \
  -H "Content-Type: application/json" -H "X-Session-Id: <any-uuid>" \
  --data-raw '{"location":"Fuengirola, Spain","energyUsage":5000,"pvWattage":4000,"batteryCapacity":10}'
# expect: resolution.carbonSource.factor.system === "peninsular",
#         co2Reduction consistent with carbonSource.factor.valueGPerKwh (see design decision 10 —
#         compare against the response's OWN monthlyData sum, not a hand-typed 3860)

curl -sS https://voltura-api.onrender.com/api/version
# expect: sha matching the new merge commit
```

## Residue

- `data/sources/es.yaml` and `artifacts/api-server/src/lib/emissions/{registry,es}.ts` are now unwired from `routes.ts` (H-SRC-ES's CNMC market-based path) but not deleted — see design decision 1. Their own tests still pass unchanged. Deletion is out of this block's scope.
- Spain's `installCost` and the UK's `tariff` are both `pending` in production data as of this ruling — expected, not a defect: no primary source was found for the former (UNEF), and no source exists at all for the latter (Eurostat dropped UK reporting in 2020).
- Baleares, Canarias, Ceuta and Melilla remain `pending` in the registry, as the block specifies ("never the peninsular one... or `pending`").
- `contracts/blocks/h-src-es.md` and `contracts/rulings/h-src-es.md` are untouched (AC11) — H-SRC-ES's own merge is a separate, still-open decision for the operator.
- Working tree is clean; `git status --short` empty at the time of this ruling.

## RULING

**CLOSED on the branch, pending operator merge.** Every mechanical acceptance criterion (AC1–AC3, AC5–AC11) is met with evidence above; AC4 is met against the server's real (unrounded) arithmetic, with the naive rounded reading corrected and explained; AC12 cannot close until the operator authorises the push/merge this session stops before. One `§5` refusal was raised and ruled by the operator mid-run (UK tariff = pending). This gate — being a merge to `main` — is **operator-ruled**, not self-ruled under §14.2.

---

## MERGE AND LIVE EVIDENCE — 23 Sept 2026

| | |
|---|---|
| **BLOCK / GATE** | H-SRC-ES-UK / merge |
| **DATE** | 2026-09-23 |
| **COMMIT (before)** | `9034c99` |
| **MERGE COMMIT** | **`dfde7b7`** (`dfde7b7606e5e243ca6916b89aa85384f5801484`), two parents: `9034c99` and `169b2c4`. `--no-ff` per G2 |
| **AUTHORISED BY** | Operator, 22 Sept 2026, §14.2 (*"any merge to `main`"*). The authorisation covered this merge and its push only |
| **RULING** | **MERGED. AC12 met live.** Deploy path still **UNPROVEN** (A16), A13's debt carried forward unchanged. See the end of this section |

### Step 0: preconditions, all met, checked 12:50Z

| Check | Result |
|---|---|
| `git fetch origin`, `git status` | clean |
| `main` / `origin/main` | `9034c99` / `9034c99`. No unpushed commits on `main` (`git log origin/main..main` empty) |
| branch tip / `git merge-base main heatshield/h-src-es-uk` | `169b2c4` / `9034c99` |
| live `GET /api/version` (12:50:47Z) | `{"sha":"9034c99","shaFull":"9034c990be5062d23819ebf234b716ce218f97c5","source":"render"}` |
| live web, `curl -sS` (a GET, not `-I`) piped to `grep build-sha` | `<meta name="build-sha" content="9034c99" />` |
| branch tip: root `pnpm run typecheck` | exit 0 |
| branch tip: `pnpm -r test` | `lib/cte` 72 + `artifacts/api-server` 239 = **311**, all passed |
| Render live deploys before the merge | api `dep-danuj3740ujc73d83c3g`, web `dep-danujon40ujc73d85sgg`, both `9034c99`, live since 2026-09-20T14:12Z / 14:13Z |

### Step 1: merge

```
git checkout main
git merge --no-ff heatshield/h-src-es-uk -m "Merge branch 'heatshield/h-src-es-uk' into main" -m "Co-Authored-By: ..."
```

The only change from the ruling's command is `-m`, which supplies the message and attribution trailer so no editor opens in a non-interactive shell. The `--no-ff` semantics are unchanged. The merge commit has two parents (above), so `git revert -m 1` has a mainline. **42 files, 6,482 insertions, 1,273 deletions.** No DDL: the only `lib/db` change is Zod input fields plus a TypeScript type on the existing `renewable_mix` jsonb column. No column changed (G3).

**On `main` at `dfde7b7`:** root `pnpm run typecheck` exit 0. `pnpm -r test` 72 + 239 = **311**, equal to the branch.

### Step 2: push, a production deploy of both services (A13)

`git push origin main`: `9034c99..dfde7b7`, window **2026-09-23T12:54:47Z → 12:54:57Z**.

**CI on `main`:** run [35863537086](https://github.com/elmaroun07-hub/Green-Energy-Calc/actions/runs/35863537086), head `dfde7b7`, **success**. Job `build` completed 12:55:38Z, job `test` completed 12:56:03Z.

### Step 3: Render. Both containers moved, and both builds succeeded

These are declared as **two production deploys** (A13), window 12:54:57Z–12:56:01Z. Deploy data is from the Render API (read-only `list_deploys`), and the served sha was polled from outside every 30 s:

| Service | Deploy id | Trigger | Build started | Live (Render) | First seen serving `dfde7b7` (poll) |
|---|---|---|---|---|---|
| `voltura-web` | `dep-dapso8cs728c73fc8sh0` | `new_commit` | 12:54:57.214Z | **12:55:30.108Z** | 12:55:51Z (12:55:20Z still `9034c99`) |
| `voltura-api` | `dep-dapso8cs728c73fc8sk0` | `new_commit` | 12:54:57.290Z | **12:56:00.897Z** | 12:56:23Z (12:55:51Z still `9034c99`) |

The previous deploys, `dep-danuj3740ujc73d83c3g` and `dep-danujon40ujc73d85sgg`, went to `deactivated` at those same instants.

```
GET https://voltura-api.onrender.com/api/version   (12:56:23Z)
{"sha":"dfde7b7","shaFull":"dfde7b7606e5e243ca6916b89aa85384f5801484","source":"render"}
GET https://voltura-web.onrender.com | grep build-sha   (12:56:23Z)
<meta name="build-sha" content="dfde7b7" />
```

**§2 / A2: auto-deploy was re-confirmed at this merge gate by observation, not assertion.** One push moved both containers with trigger `new_commit`. Render's service records read `autoDeploy: yes`, `autoDeployTrigger: commit`, `branch: main` for both. **Build config:** both build commands are the dashboard-fixed form, `corepack enable --install-directory /tmp/bin`. The builds succeeded, so the 20 Sept `EROFS` failure shape did not recur. **The Node version pin was not verified:** service env vars were not read. It remains the operator's item, unchanged. *(Update, 23 Sept 13:08Z: the operator pinned it. See "Operator-side change outside git" below.)*

### Step 4: AC12, behavioural proof on the live API

The sha match above is not the proof. The proof is these responses.

Probe session id: **`probe-h-src-es-uk-2026-09-23-dfde7b7`**, sent as `X-Session-Id` on every request. Bodies were sent from files, ASCII only, with Tétouan JSON-escaped as `Tétouan`. Every body was `energyUsage 5000, pvWattage 4000, batteryCapacity 10` unless stated.

| # | Request (sent → received, UTC) | HTTP | Expected | Observed | Result |
|---|---|---|---|---|---|
| 1 | `POST /api/calculate` `"Fuengirola, Spain"` (12:56:59Z → 12:57:00Z) | 200 | CO₂ 333 kg; money €1,030.34; carbon REE peninsular 86.1356 g/kWh; tariff Eurostat ES 2025-S2 | `co2Reduction` **333**; `money.currency` EUR, `annualSavings` **1030.34**; `carbonSource.factor` `system: "peninsular"`, `valueGPerKwh` **86.13556944796785**, `basis: "generation"`, REE, published 2026-05-11; `money.tariff` `status: "used"`, `source: "registry"`, **0.2669**, `label: "Eurostat 2025-S2"`, `taxBasis: "all_taxes_included"`, `reviewBy` 2027-02-12. `savingsKwh` 3860 | **MET** |
| 2a | `POST /api/calculate` `"London, United Kingdom"`, **no tariff** (12:57:03Z → 12:57:04Z) | 200 | currency GBP; money pending; carbon DESNZ generation 130.96 | `money.currency` **GBP**; `money.tariff.status` **"pending"**, `reason: "registry_tariff_pending"`; `annualSavings` **null**; `roi` pending; `installCost` pending (`battery_not_in_registry_cost`); `carbonSource.factor` `system: "gb"`, `valueGPerKwh` **130.96**, `basis: "generation"`, DESNZ, published 2026-06-11 | **MET** |
| 2b | `POST /api/calculate` London **with the ruling's `"electricityTariff":0.28`** (12:57:01Z → 12:57:03Z) | 200 | per the ruling's curl: `money.currency === "GBP"` | `money.currency` **GBP**; `tariff` `status: "used"`, `source: "user"`, 0.28, `label: "your tariff"`; `annualSavings` 761.94; carbon identical to 2a | **MET** (the ruling's expectation) |
| 3 | `POST /api/calculate` `"Tétouan, Morocco"` (12:57:04Z → 12:57:05Z) | 200 | money pending, never €0.250 | `money.currency` **null**; `tariff.status` **"pending"**, `reason: "country_not_in_registry"`; `annualSavings` null; `installCost` and `roi` pending. The raw body contains **no** `0.25`, `0.250` or `electricityTariff` anywhere. `resolution.locationInput` echoes `Tétouan, Morocco` correctly | **MET** |
| 4 | `POST /api/optimize` London, `annualUsageKwh 5000`, the web client's standard 24-h profile (12:57:39Z → 12:57:44Z) | 200 | resolves, and carries `carbonSource` the way `/calculate` does | resolves: `optimalPv` 5651, `optimalBattery` 4.1, `nasa-live` 2019–2023. `resolution.carbonSource` **deep-equals** 2a's `resolution.carbonSource` (`JSON.stringify` equality: `true`). Rate limit after the call: `limit=10, remaining=9` | **MET** |

**Arithmetic, from each response's own `monthlyData`** (design decision 10: never a hand-typed 3860):

| | Σ `monthlyData[].savingsKwh` | × factor | → `co2Reduction` | × tariff | → `annualSavings` |
|---|---|---|---|---|---|
| Fuengirola | 3860.3999999999996 | × 0.08613556944796785 = 332.5178 | **333** ✔ | × 0.2669 = 1030.3408 | **1030.34** ✔ |
| London (2a / 2b) | 2721.2 | × 0.13096 = 356.3684 | **356** ✔ | 2b: × 0.28 = 761.936 | 2b: **761.94** ✔ (2a: null, pending) |

**Deviation: London was probed twice, and neither expectation was chosen over the other.** The ruling's AC12 curl sends `"electricityTariff":0.28` and expects only `money.currency === "GBP"`. The merge instruction expects London to return **money pending**, which by the ruling's own S1 ("London's money figure renders `pending` unless the user types a tariff") can only be observed **without** a user tariff. The two expectations test two different requests, so both were sent: 2b is the ruling's curl verbatim, and 2a is the same request without the tariff. Cost: one extra production row, counted below.

**Observed and not ruled:** Tétouan's `carbonSource` is `{"status":"unsourced_legacy","country":"Morocco","valueKgPerKwh":0.543}`, from the legacy country table. It is labelled as unsourced in the response. It is outside this block's AC12 expectations and is recorded only.

### Probe hygiene

- Session id **`probe-h-src-es-uk-2026-09-23-dfde7b7`**.
- **4 rows** in production `calculations`, read back with `GET /api/history` (12:57:55Z, read-only):

| id | location | createdAt |
|---|---|---|
| 90 | Fuengirola, Spain | 12:56:59.764Z |
| 91 | London, United Kingdom (tariff 0.28) | 12:57:02.086Z |
| 92 | London, United Kingdom | 12:57:03.423Z |
| 93 | Tétouan, Morocco | 12:57:04.906Z |

- `/api/optimize` writes no row. The only insert in `routes.ts` is `storage.createCalculation` in `/api/calculate`.
- **Nothing was deleted (G3).** Cleanup is a separate operator-granted micro-task.

### Raw responses: `contracts/fixtures/` (binary to git, `-text`), sha256

```
b539c10d02c716f3f355e0044568439d548a538bf5dd7b4193477edf558d9f44  prod-dfde7b7-calculate-fuengirola-after.json
9176d52fd7fca78ddb0c8094c2ce5704abff28404afed77fa81c0f21923157e4  prod-dfde7b7-calculate-london-after.json
c4bdbe8cc6114284525a077ccaf31d4447f71478f339f7dab2e411ddac2fafc7  prod-dfde7b7-calculate-london-tariff028-after.json
d071ce31e17b23f580501ccda1d034c828175f54e5db5053671f90d530a6f9d5  prod-dfde7b7-calculate-tetouan-after.json
ce3b0c4bce123eda4e392f4d47310640032d26f9ba227e2aa19e5cf6b9fb1fa7  prod-dfde7b7-optimize-london-after.json
112c123ecff44fae439d7772223db391fb815857b50a905e8b622125d2c3db69  prod-dfde7b7-history-probe-session.json
```

These are not pinned by a test. They are evidence captured from production, like the `prod-9034c99-*-before.json` files beside them.

### Operator-side change outside git: 23 Sept 2026, 13:08Z. Two production deploys, no code change

**Operator statement.** `NODE_VERSION` was changed on both Render services from the floating `"24"` to **`24.21.0`**. The env change redeployed `dfde7b7` on both. Nothing in git changed.

**Observed, not taken on assertion**, from the Render API (read-only `list_deploys`, `list_logs`) and a live GET:

| Service | Deploy id | Commit | Trigger | Build started | Live |
|---|---|---|---|---|---|
| `voltura-web` | `dep-dapsudhsrm7s73aoaem0` | `dfde7b7` | `api` | 13:08:06.727Z | **13:08:41.588Z** |
| `voltura-api` | `dep-dapsucegekts73f3ht60` | `dfde7b7` | `api` | 13:08:01.878Z | **13:08:53.507Z** |

The merge deploys, `dep-dapso8cs728c73fc8sh0` and `dep-dapso8cs728c73fc8sk0`, went to `deactivated` at those same instants. At 13:12:19Z, `/api/version` read `{"sha":"dfde7b7",...}` and the web `build-sha` read `dfde7b7`. **Same commit, no code change.**

**The pin, as the build logs show it:**

| Build | Log lines |
|---|---|
| 12:55Z (merge deploys, both services) | `Requesting Node.js version 24`, then `Using Node.js version 24.21.0 via environment variable NODE_VERSION`. A floating `24` was resolved at build time |
| 13:08Z (env-change deploys, both services) | `Using Node.js version 24.21.0 via environment variable NODE_VERSION`, with **no** `Requesting ... 24` line. This fits an exact pin |

So the merge deploys already ran 24.21.0. The pin freezes the version that was running; it does not change it. A future Node 24.x release can no longer enter a build unannounced, and that floating version was the unverified half of the 20 Sept `EROFS` failure.

**Declared per A13: two production deploys** (`voltura-api`, `voltura-web`), window **13:08:01Z–13:08:54Z**, made by the operator outside git. The executor made no deploy, env or dashboard change.

### Rollback: Tier B, re-proven against the real merge. Deploy path UNPROVEN

```
git revert -m 1 dfde7b7
```

The pre-merge Tier-B proof above was computed at `42515ce` (6,363 insertions). The merged tip is `169b2c4`, which adds 122 lines of ruling text to one file. The proof was therefore **re-run against `dfde7b7` itself**, on a detached scratch worktree with no branch, never pushed, then removed. `git revert -m 1 dfde7b7` applied cleanly: **42 files, 1,273 insertions, 6,482 deletions**, the exact mirror of the merge. `git diff --stat 9034c99 <revert>` printed **zero lines**, so the tree is byte-identical to pre-merge `main`.

**The deploy path is UNPROVEN.** No rollback of this block has been pushed. A revert on `main` is a production deploy, and this merge measured that deploy at about 64 s for the API (push end 12:54:57Z → live 12:56:01Z). **A13's standing debt is carried forward unchanged**: the deploy path has carried another forward merge and still never a rollback. No drill was authorised and none was run.

**The rollback target moves: `dfde7b7`, not `9034c99`.**

### Residue

| # | Item |
|---|---|
| 1 | **This evidence commit rides the next code merge.** It is on `heatshield/h-src-es-uk-live-evidence`, off `dfde7b7`, **unmerged and unpushed**. A docs-only commit to `main` would redeploy both services for zero code change, which is how H-OPT wasted three deploys. |
| 2 | **4 probe rows (ids 90–93)** remain in production `calculations` under `probe-h-src-es-uk-2026-09-23-dfde7b7`. Deleting them needs an operator-granted micro-task (G3). |
| 3 | ~~The Node version pin on both Render services is unverified.~~ **Resolved 23 Sept 13:08Z by the operator:** `NODE_VERSION` pinned to `24.21.0` on both services, and verified in the build logs. See "Operator-side change outside git". |
| 4 | ~~Pre-merge ruling text: stale tip on line 3, unfilled fixture-hash block.~~ **Resolved 23 Sept 2026 at the operator's instruction.** A dated correction line was added under line 3, with the original line kept. The fixture-hash block now holds the 13-row table, each hash recomputed and equal to its pin. |
| 5 | Pre-merge residue (es.yaml unwired, Spain install cost and UK tariff `pending`, island systems `pending`, H-SRC-ES's own ruling untouched) is carried forward unchanged. |

### RULING (merge)

| Criterion | Ruling |
|---|---|
| `--no-ff`, two parents, revert has a mainline | **PASS**. `dfde7b7`, parents `9034c99` + `169b2c4` |
| Suite and typecheck on `main` equal the branch | **PASS**. 311 = 311, typecheck exit 0 both |
| CI green on `main` | **PASS**. Run 35863537086, `build` + `test` |
| Both containers deployed | **PASS**. `dep-dapso8cs728c73fc8sh0` (web, 12:55:30Z), `dep-dapso8cs728c73fc8sk0` (api, 12:56:01Z), both serving `dfde7b7` |
| AC12, behavioural | **PASS**. Five live responses, all as expected (table above) |
| §2 auto-deploy re-confirmed at the merge gate | **PASS, observed** |
| Operator env change, 13:08Z (`NODE_VERSION` pinned to `24.21.0`) | **Declared: two production deploys**, `dep-dapsucegekts73f3ht60` (api, 13:08:53Z) and `dep-dapsudhsrm7s73aoaem0` (web, 13:08:41Z). Both still `dfde7b7`, no code change |
| G8 rollback | **Tier B**, re-proven at `dfde7b7`. **Deploy path UNPROVEN. A13 debt carried** |

**Block H-SRC-ES-UK: MERGED. `main` is `dfde7b7`.**
