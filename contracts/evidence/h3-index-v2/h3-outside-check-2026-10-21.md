# H3 outside check — Córdoba, run h3-index-v2-14021-2026-10-21T22:28:58.722Z

**Date:** 21–22 Oct 2026. **Production:** `a15dd1d`. Read-only: SQL against `voltura-db`, public INE API.

## Question

Does the screening index point at the parts of Córdoba an independent official source
calls poorest? Nothing from that source enters the index.

## Source

INE, *Atlas de Distribución de Renta de los Hogares* (operation 353, ADRH), table **30980**
(Córdoba province), series "Córdoba sección DDSSS. Dato base. Renta neta media por persona",
latest year **2024**. Pulled from `servicios.ine.es/wstempus/js/ES/DATOS_TABLA/30980?nult=1`
on 21 Oct 2026. 256 sections of Córdoba municipality.
Pinned copy: `ine-adrh-30980-cordoba-2024-renta-persona.csv`
(sha256 `fc8f18190ce53c1df0a0c550db1a1500e3cb561123f4a28a9fe3a52714ac246f`).

## Method

- Per census section (2021 boundaries, as in H3): dwelling-weighted mean of `index_mid`, and
  the share of the section's dwellings in the first tenth (`rank_high ≤ 3,244`).
- Joined to INE by section code (`14021` + DDSSS). **251 of 253** screening sections matched;
  INE's 2024 sectioning has 256 (codes added or split since 2021 do not match).
- Spearman: rank of income (poorest = 1) against rank of the index (highest = 1).
- "Building-only" repeats it without the census term: geometric mean of hazard, exposure and
  sensitivity with their v2 weights (⅙, ⅙, ⅓) renormalised to ¼, ¼, ½, people removed.

## Results

| Measure | Value |
|---|---|
| Spearman, income vs index | **0.36** |
| Spearman, income vs building-only part | **0.14** |
| Share of dwellings in the first tenth — 25 poorest sections | **59.7 %** |
| Same share — all other sections | **18.0 %** |
| Poorest 25 with at least half their dwellings in the first tenth | **15 of 25** |
| Poorest 25 that are also in the index's top 25 sections | **10 of 25** |

Section **1402109012** — where 19 of the index's top 20 buildings sit — is the **second-poorest
section in Córdoba: €6,042 per person (2024)**.

The ten poorest sections and the share of their dwellings in the first tenth:

| Section | €/person 2024 | First-tenth share |
|---|---|---|
| 06037 | 5,828 | 1.00 |
| 09012 | 6,042 | 1.00 |
| 06014 | 6,650 | **0.00** |
| 06041 | 6,697 | 0.24 |
| 06026 | 7,022 | 0.88 |
| 06035 | 7,594 | 1.00 |
| 09032 | 8,088 | 0.25 |
| 06033 | 8,150 | **0.00** |
| 09014 | 8,157 | 1.00 |
| 06013 | 8,364 | 1.00 |

## Where the top is

The index's rank-3 building, ref `4023301UG4942S` (section 1402109012, 20 dwellings, 1962), is
**Calle Torremolinos 8, 14013 Córdoba** (Catastro, Consulta_DNPRC, read 21 Oct 2026).
Property portals list that street under **Sector Sur** — not an official delimitation.
Official context, not yet joined at section level:
- Córdoba's Plan Local de Intervención en Zonas Desfavorecidas (ERACIS) names three zones:
  Barriada Las Palmeras, Distrito Sur Córdoba, Las Moreras.
- Cordópolis, 6 Feb 2025: the "Distrito Sur" zone takes in the Barrio del Guadalquivir and the
  Sector Sur.
- INE Indicadores Urbanos 2023 (reported by El Debate, 23 May 2023): Las Palmeras, Polígono del
  Guadalquivir and Sector Sur among Spain's poorest neighbourhoods.

## What this does not show

- **Part of the agreement is shared input.** The people term (⅓ of the index) uses Censo 2021
  unemployment, which moves with income. The building-only part agrees only weakly (0.14).
- Income is not summer energy poverty. This shows the index looks where incomes are lowest;
  it does not show that those dwellings overheat.
- Two of the ten poorest sections (06014, 06033) have **no** dwelling in the first tenth. Not
  yet explained.
- The section → neighbourhood mapping above rests on one building's address and on property
  portals. The ERACIS zones' own section lists were not found in the documents read.
