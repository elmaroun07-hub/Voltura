# H-SRC-ES-UK — complete Spain, add the UK

**Rulings this contract executes (20–21 Sept 2026):**
- Registry is **Spain + UK**. Morocco dropped — no official per-kWh grid factor, and Tétouan is on Amendis, not ONEE.
- Tariff source for **both** countries is **Eurostat `nrg_pc_204`**, taxes included. Ofgem is recorded in the UK entry as a note, never as the value.
- Spanish install cost is **UNEF €1,100–1,500/kWp**, authority recorded as an industry body. The €9,800 auto-estimate goes.
- The country rejection rule is **carbon + tariff**. Building standard is recorded `notApplied` until the calculation uses it.
- **Carbon is location-based for both countries** (21 Sept): the physical generation mix a solar panel displaces. CNMC's market-based residual mix is recorded as a note, never as the value.

**Domain 1:** no revenue. It buys a live demo where every number a buyer sees for Spain or the UK names its source.

---

## Amendment to append to `contracts/AMENDMENTS.md` BEFORE this block runs

Number it as the next sequential amendment in that file. Text:

> **Carbon method is location-based (ruled by the operator, 21 Sept 2026).** Supersedes the carbon source named in `contracts/blocks/h1b.md` (MITECO "Mix sin GdO", which is market-based).
> - Every country's carbon factor is **location-based**: direct emissions of that country's electricity generation per MWh generated, taken from the system operator or government statistic.
> - **Spain:** REE, *Emisiones y factor de emisión de CO2 eq. de la generación*, **per electric system**. Peninsular addresses use the peninsular factor; Baleares, Canarias, Ceuta and Melilla use their own system's factor or `pending` — never the peninsular one.
> - **UK:** DESNZ GHG conversion factors, **generation** factor, T&D losses excluded.
> - Market-based figures (e.g. CNMC's residual mix) may be recorded as notes, never as the value.
> - Why: the product reports CO₂ avoided by self-consumption — the physical grid a panel displaces — and location-based is the only basis on which both registry countries have an official figure.
> - Consequence accepted: Spain's displayed CO₂ falls by roughly 2.4× against the 258 g/kWh in production at `9034c99`.

---

## Preconditions — halt if any fails

1. `main` is at `9034c99`, live on both Render services (verified 20 Sept 2026, 14:12:25Z api / 14:13:20Z web).
2. **Read the tree for real paths.** `data/sources/es.yaml`, its loader, the Spain resolver and the combining module are quoted from notes, not read.
3. Branch `heatshield/h-src-es-uk` off `main`. No commit to `main`, no fast-forward merge, no push without his go-ahead — `main` auto-deploys both services.
4. **Run both pulls below first** and paste the raw responses into `contracts/rulings/h-src-es-uk.md`. The two tariff values and Spain's carbon factor come from them; nothing is typed in from this document.

```bash
curl -sS "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204?format=JSON&lang=EN&geo=ES&geo=UK&nrg_cons=KWH2500-4999&currency=NAC&unit=KWH&tax=I_TAX&time=2025-S2"
```

`currency=NAC` is deliberate: it returns each country in its **own** currency — EUR for Spain, GBP for the UK — so no conversion ever happens. If a dimension code is rejected, the error lists the valid ones; fix the code, not the method.

```bash
# Spain carbon — REE REData, public, no token (this is NOT ESIOS)
curl -sS "https://apidatos.ree.es/es/datos/generacion/no-renovables-detalle-emisiones-CO2?start_date=2025-01-01T00:00&end_date=2025-12-31T23:59&time_trunc=year&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741"
```

The value needed is REE's **peninsular emission factor for 2025, in tCO₂eq/MWh** (× 1000 = g/kWh). **Not the national figure:** REE's *Nacional* view for 2025 reads 0.11 tCO₂eq/MWh (29,526,035.9 t), but it includes the island systems' diesel engines and gas turbines, and it is displayed to two decimals — about ±5%. The entry needs the **Peninsular** system and the **unrounded** value. If the widget path is rejected, find the emission-factor widget on REE's *Non renewable detail CO₂ emissions* page and use its API path — the source is REE either way. A figure of ~107 g/kWh is recorded from an earlier session but has **not** been read at source; the pull decides it.

---

## Phase 0 — schema

- **P0.1** Country entry: `carbonFactor { value gCO2e/kWh, basis: generation | supply, authority, publication, activityYear, note }`, `tariff { value, unit, currency, taxBasis, authority, publication, period { start, end }, reviewBy, note }`, `installCost { low, high, unit: perKW, currency, taxBasis, authority, authorityType: government | industry, publication, edition } | pending`, `buildingStandard: notApplied`, `currency` (ISO 4217).
- **P0.2** `currency` and `taxBasis` are **types**, not labels. Evidence: a real `TS2345` from a deliberate mismatch for each, confirmed as AC4 was in H-SRC-ES.
- **P0.3** **`period` and `reviewBy` are different things.** `period` is what the statistic describes (2025-S2 = 1 Jul – 31 Dec 2025). `reviewBy` is when the entry must be re-pulled — set to **12 Feb 2027**, six months after Eurostat's 12 Aug 2026 update. A tariff whose `period` has ended is normal for a semi-annual statistic; one past `reviewBy` renders as **stale**, never silently used.
- **P0.4** Install cost is a **range and renders as a range** (€X–€Y). No midpoint — a midpoint is an invented number.
- **P0.5** Rejection rule is **carbon + tariff**. Nothing reads `buildingStandard`.
- **P0.6** No hardcoded currency in the render path; grep for a literal `€` in the deployed app returns zero outside fixtures. **No FX conversion anywhere.**
- **P0.7** The Tariff Used card names its source: "Eurostat 2025-S2" for the registry value, **"your tariff"** when the user typed one. A user-entered tariff always wins.
- **P0.8** **For any country outside the registry, the money figure renders `pending`** until the amendments block ships. The €0.250 default stops being emitted for every country — this is what stops Tétouan being billed at a Spanish rate.

---

## Phase A — Spain

| Field | Value | Source |
|---|---|---|
| Carbon | REE **peninsular** generation emission factor, **2025**, from the pull; basis generation, location-based | REE REData, *Non renewable detail CO₂ emissions* |
| Carbon scope | **Peninsular system only.** REE publishes separate, much higher factors for Baleares, Canarias, Ceuta and Melilla — an address on those systems gets its own factor or `pending`, never the peninsular one | REE, per electric system |
| Carbon note | Market-based alternative, not used: CNMC residual mix 257.712 g/kWh (Circular 2/2021 art. 7.3, `EtiquetadoRestante_2025.xls`, 2025) | CNMC |
| Tariff | Eurostat ES value from the pull, EUR, taxes included, period 2025-S2 | `nrg_pc_204`, band DC |
| Install cost | **€1,100–1,500/kWp**, industry body | **UNEF's own publication** — if the executor cannot locate a UNEF document stating this range, the field is `pending`. A secondary site quoting UNEF is not the source |
| Building standard | `notApplied` | — |

---

## Phase B — United Kingdom

| Field | Value | Source |
|---|---|---|
| Carbon | **130.96 gCO₂e/kWh**, basis generation, location-based | DESNZ 2026 GHG conversion factors, published 11 June 2026 |
| Carbon note | T&D losses (12.99) excluded, matching REE's direct-generation-only factor. This edition folds a methodology change into the fall from 0.17700, so it is not comparable year-on-year | same |
| Tariff | Eurostat UK value from the pull, **GBP**, taxes included, period 2025-S2 | `nrg_pc_204`, band DC |
| Tariff note | Ofgem cap 1 Oct – 31 Dec 2026: 26.32 p/kWh ex-VAT energy unit rate, standing charge 54.83 p/day, Direct Debit, GB average; domestic electricity VAT-free 1 Oct 2026 – 31 Mar 2027 | Ofgem, set 26 Aug 2026 |
| Install cost | **£1,955/kW** ≤4 kW, **£1,645/kW** 4–10 kW, VAT included, government | DESNZ Solar PV cost data, 28 May 2026 — MCS-registered domestic installs Apr 2025 – Mar 2026, GB excl. NI |
| Building standard | `notApplied` | — |

UK install cost is size-banded, not a range: the resolver picks the band by system size.

---

## Acceptance

| AC | Criterion | Evidence |
|---|---|---|
| AC1 | Both entries validate; every number carries authority and publication, or is `pending` and renders pending | Entries + a failing validation on a deliberately incomplete entry |
| AC2 | Currency and taxBasis mismatches are real type errors | Two `TS2345` diagnostics |
| AC3 | An entry past `reviewBy` renders stale and is never silently used | Test with a back-dated `reviewBy` |
| AC4 | **Fuengirola regression, exact:** savings stay **3,860 kWh**; CO₂ = 3,860 × the REE peninsular factor (≈413 kg if the factor is 0.107 — the pull decides); € = 3,860 × the Eurostat ES value. Any other movement is a failure | Before/after responses |
| AC5 | London resolves in **GBP**, and still needs a larger array than Fuengirola for the same household | Live response |
| AC6 | Tétouan's money figure renders `pending`, not €0.250 | Response |
| AC7 | `/api/calculate` and `/api/optimize` both resolve Fuengirola and London, and `/optimize` records the source as `/calculate` does | Four responses |
| AC8 | Tests 243 → 243 + N, zero deletions; fixtures per country as the seven CNMC fixtures were done | Both counts |
| AC9 | `gate-check.sh` and `artifacts/greencalc/` diffs empty | `git diff --stat` |
| AC10 | Revert-clean on a disposable local merge, diffed against `main`, then discarded | Commands + diff |
| AC11 | Stale docs ride this branch: `contracts/blocks/h-src-es.md` §AC8 and `contracts/rulings/h-src-es.md` still say the merge is pending | Diff |
| AC12 | **Deploy proof is behavioural:** after merge, London returns GBP and Fuengirola's CO₂ equals 3,860 × the REE factor on the live API | Live responses with timestamps |

---

## Out of scope

- **The three amendments** — delete the legacy table, apply the carbon + tariff rejection rule, replace the San Francisco / Seattle defaults — their own block, after this one.
- **Sourcing the Annual Energy Mix donut (D8)** — a follow-up. Under the location-based ruling it must come from REE's generation structure, **not** the `EtiquetadoRestante` composition, which is market-based.
- B1 (the Assistant's compliance claim), the `geocode()` logging ticket, H-A50-PORT, H2, Morocco.
