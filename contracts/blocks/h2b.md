> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H2b — Spanish · set up during H2, enforced from H3 commit one

**Fence.** In: i18n infrastructure, locale files, domain vocabulary. Out: translating screens that H3 has not built yet. Branch: `heatshield/h2b`.

Every screen, label, PDF, error message and system prompt in this repository is in English. The buyer is a Spanish regional administration. This is a procurement precondition, not polish — retrofitting i18n after the UI is built costs several times what building with it costs.

| # | Task |
|---|---|
| 2b.1 | i18n in place before H3 starts. Spanish is the default locale; English is the translation. |
| 2b.2 | Salvaged `es.json` strings loaded (from C2) |
| 2b.3 | **Amended A24 (7 Oct 2026).** Domain vocabulary from official usage — *pobreza energética*, *pobreza energética en verano*, *rehabilitación*, *parque edificatorio*, *cribado* — each cited to a page of the Estrategia Nacional contra la Pobreza Energética 2026–2030, not translated. *(Was: the Andalusian heat-health plan and the CTE, which hold none of the terms; and* viviendas difíciles de refrigerar, parque de viviendas*, which the strategy does not use.)* |
| 2b.4 | Assessment and screening PDFs in Spanish, with Spanish number and date formatting |
| 2b.5 | Assistant system prompt in Spanish, if the Assistant survives into the HeatShield product |

**Gate H2b.** A new string added anywhere fails the build if it has no Spanish entry. Demonstrated by adding one and showing the failure.
