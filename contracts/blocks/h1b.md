> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H1b — lib/emissions · week 2

**Fence.** In: the module, its tests, its wiring. Out: the UI copy that quotes CO₂ — that is H1c. Branch: `heatshield/h1b`.

**Tasks.** Build to `lib/cte`'s standard.

- Store authority, edition, activity year, unit, GdO treatment, scope. Never a bare number.
- Seed: MITECO official workbook, revised 7 May 2026 — Mix sin GdO 0.283 kg CO₂e/kWh (activity year 2024), 0.258 (2025). Series back to 2007.
- Render as: `MITECO 2026-edition factor, activity year 2024: 0.283 kg CO₂e/kWh, Mix sin GdO`.
- Throw on unknown jurisdiction. No 400 default. No 0.4 default. G5.
- Country comes from the geocoder's structured response, never substring matching (see 1.5).
- Morocco: no national authority publishes a citable factor. Either label explicitly as non-Moroccan-authority data, or omit the market. Do not silently keep 0.543 or 638 g.
- The factor is a parameter, not a constant — the correct one depends on the accounting protocol a programme or contract specifies.

**Failure modes.** Replacing two wrong constants with one wrong constant. Keeping a fallback "for safety" — that is the defect class this whole contract exists to remove. Rendering the bare number without the provenance string (G7's cousin: provenance is part of the value).

**Gate H1b.** Every emissions figure in the codebase resolves through this module — proven by grep showing no other source. An unknown jurisdiction throws, demonstrated live. The rendered string carries authority and year. **Until this gate closes, quote no CO₂ figure publicly, anywhere.**
