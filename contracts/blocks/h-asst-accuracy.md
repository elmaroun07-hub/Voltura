# Block H-ASST-ACC — the Assistant says only what the code backs

Written 5 Oct 2026 (chat) for execution in Claude Code. Operator: Houssain.

Written against one live answer: the Assistant's reply to "What is Voltura?", pasted by the operator on 5 Oct 2026 and reproduced verbatim in Appendix A0. H-ASST-D16-N3 kept the Assistant on the feature list. This block makes what it says about each feature true.

**Precondition: H-ASST-D16-N3's post-merge gate is CLOSED** (`6a8eca4` on `heatshield/asst-d16-n3-live-evidence`, unmerged, 5 Oct). Branch off the tip at block open. The rollback target is named "the tip at block open", never a literal sha written here.

---

## Ground truth — every line dated; re-verify each in A.1 before relying on it

| Fact | Source, date |
|---|---|
| Production `main` = `0192cd6`, live on both services | Render API + L1, 5 Oct |
| H-ASST-D16-N3 Part A: the prompt lists 13 features built from code, plus a "say Voltura doesn't do it" rule; a feature-map test maps each to a file and symbol | `9f6c2cd`, 5 Oct |
| Its L2-A passed on staying on the map, but restatements were wrong: conversation 38 calls the NASA data "hourly-averaged" (it is monthly); three answers say other countries get "a generic statement"; one says the monthly chart shows battery-supplied energy | H-ASST-D16-N3 ruling, 5 Oct |
| Carbon: Spain (REE peninsular) and the UK (DESNZ) come from the registry. A country code in the legacy table gets its unsourced factor (Atlanta → US 0.386, row 108). A code in neither → 400 `unknown_carbon_country`, and the calculation is rejected | H-SRC-ES-UK, 23 Sept; H-ASST-D16-N3 L2-B, 5 Oct |
| Install cost: UK sourced (DESNZ TIC domestic means, £/kW bands); Spain `pending` (UNEF's own pages state no range) | H-SRC-ES-UK, 22–23 Sept |
| Tariff: Spain = Eurostat `nrg_pc_204` 2025-S2; UK `pending`; a user-typed tariff always wins; no tariff → money shows as pending | H-SRC-ES-UK, 23 Sept |
| NASA POWER: 2019–2023 mean. A failure returns typed 422s (`nasa_fill_value`, `nasa_partial_coverage`). H1 deleted the silent defaults `\|\| 4.0`, `\|\| 15.0`, `lat \|\| 45` | Gate H1, H-OPT, 10 Sept |
| Optimizer: sizing is deterministic in `lib/`, the model writes prose only, coverage target 1.00. The hourly shape is a fixed standard profile (`nightShare 0.2157`, `darkHours 9`); the web labels it "Typical Daily Usage Pattern" (D20) | H-OPT, 10 Sept; 11 Sept report |
| Web monthly chart: "Monthly Generation vs Consumption" plus a "Surplus not used" series. PDF table has 6 columns. The mix donut comes from recorded flows | H-D8D52, 1 Oct |

---

## Claims in A0 — status from the record, to be confirmed from code in A.1

| # | Claim in A0 | Status from the record |
|---|---|---|
| C1 | Location found via OpenStreetMap | Expected true (Nominatim) |
| C2 | Long-term monthly irradiance **and temperature** from NASA POWER | Expected true; confirm temperature is fetched and used |
| C3 | "or a latitude-based fallback" | **SUSPECT**: no such fallback on record in the TypeScript app |
| C4 | Full year hour by hour; typical household profile built from annual kWh | Expected true |
| C5 | Orientation (S/E/W/N) and tilt adjust generation | Expected true (D13 constants) |
| C6 | Battery ≈90% round-trip | **CHECK**: record the default and whether the user sets it |
| C7 | Monthly charts of generation, **self-consumption, grid import** and surplus | **SUSPECT**: the recorded chart shows generation, consumption, surplus |
| C8 | Mix of Direct Solar, From Battery, Grid Import | Expected true |
| C9 | CO₂ from official data for Spain and the UK; "elsewhere it notes no figure" | **WRONG**: legacy factor, or a 400 that rejects the calculation |
| C10 | Own tariff, or national where available; otherwise no monetary value | Expected true |
| C11 | Payback and 25-year ROI from the supplied cost "or on sourced PV-only costs for Spain/UK" | **WRONG**: the UK only |
| C12 | PDF report; history of past runs "in the same browser" | **CHECK**: history is keyed to the browser's `X-Session-Id`; state what is true |
| C13 | Optimizer tailored to "your daily load pattern" | **WRONG**: fixed standard profile |
| K1–K3 | The three L2-A slips in the ground-truth table | **WRONG** |

---

## Session-open reads

1. `HEATSHIELD_CONTRACT.md` (repo root).
2. `contracts/AMENDMENTS.md` at the tip.
3. This file.
4. `contracts/rulings/h-asst-d16-n3.md`, the last ruling. It holds the L2-A questions and conversations 36–44.

---

## Branch

`heatshield/asst-accuracy` off the tip at block open. First commit: this file, byte-identical to the operator's copy (sha256 in the operator's prompt). One commit per step (A.2 tests, A.3 implementation, ruling).

---

## Fence

**IN**
- The Assistant's system prompt and any sibling seed message; their tests.
- A new facts module the prompt is built from, and its pin tests.
- A transcript checker (test utility) and its tests. A0 goes into the fixtures byte-for-byte as copied from Appendix A0.
- The `temperature` request parameter on the chat completion call, only as A.3 says.

**OUT**
- Every code behaviour a claim describes: irradiance source and failure path, carbon resolution, registry values, install cost, tariff, the Optimizer profile, charts, the PDF. A.1 **records** them. If one is a defect, it goes to the operator as a §5 note with a ticket and is never fixed here.
- Provider, model and endpoint config (D26 territory).
- Response shapes the web parses, and all web code.

---

## Part A — facts from the code, the prompt from the facts

**A.1 Read.** For each of C1–C13 and K1–K3, find the code that decides it at the tip and record TRUE / FALSE / PARTIAL with file:line. Write one fact sentence per feature **from the code, not from this file's tables**. If C3 finds a live fallback, the fact sentence states it truthfully and the fallback goes to the operator as a §5 note, since it would breach G5. It is not removed here.

**A.2 Tests first, failing on the unmodified prompt:**
- **TF1 Pins.** Every fact sentence has a test asserting the code fact it describes. Where the fact is a constant in code, the sentence imports the constant instead of restating it. A pin that still passes when its fact changes is a failure (G9).
- **TF2 Rule.** The prompt tells the model to describe features only with the fact sentences, add no detail of its own, and say plainly when it doesn't know.
- **TF3 Checker.** A pure function that flags known false claims in a transcript. Run on A0, it must flag every claim A.1 classified FALSE. Run on a corrected rewrite of A0, it must flag nothing. Its patterns come from A.1's FALSE list plus K1–K3.
- **TF4** H-ASST-D16-N3's feature map and B1's pins pass unchanged.

**A.3 Implement:** the facts module, the prompt built from it, and the TF2 rule. Temperature: record the current value. If none is set or it is above 0.3, set it to 0.3 or lower and pin it.

**Failure modes**
- **A-a** A fact sentence written from this file or from memory instead of from the code.
- **A-b** A vacuous pin: it passes when its fact changes.
- **A-c** Over-correction: an Assistant that won't describe Voltura, or buries every answer in caveats.
- **A-d** Fixing a code defect found in A.1 inside this block.
- **A-e** Closing on the checker alone. It only catches errors already known.
- **A-f** Closing on a grep. This block closes on live transcripts only.

---

## G9 mutations

Commit first (G13). Restore each file and hash-check it after its mutation.

- **M1** Change a pinned constant (for example the NASA temporal resolution) → TF1 fails.
- **M2** Give Spain an install cost in the registry → TF1 fails.
- **M3** Delete the legacy carbon path → TF1 fails.
- **M4** Delete the TF2 rule → TF2 fails.
- **M5** Put "latitude-based fallback" (or A.1's equivalent FALSE claim) back into the prompt → TF1 or TF3 fails.
- **M6** Drop one checker pattern → TF3 fails on A0.

---

## Gate

**Pre-merge:** suite and typecheck green, M1–M6 caught, A.1's claim table committed as evidence, ruling written OPEN.

**§Merge — run by the operator by hand in Git Bash (ruled 5 Oct 2026).** The executor does the dry run on a scratch ref: the evidence merge of `heatshield/asst-d16-n3-live-evidence`, then this block, both `--no-ff`. Then Tier B. Then it writes the exact commands into the ruling and STOPS. The executor merges and pushes nothing.

**Post-merge** (evidence on unmerged `heatshield/asst-accuracy-live-evidence`):
- **L1** Both services serve the merge sha.
- **L2** Live, fresh conversations under a probe session: "What is Voltura?" three times, plus the eight L2-A questions from the last ruling (11 paid calls). Each transcript is annotated claim by claim against A.1's fact table. Pass = zero factual misstatements, and the checker passes. None of A0's FALSE claims may recur.
- **L3** One exchange in the built-in browser.
- **Tier B** at the real merge. The deploy path is UNPROVEN; A13's debt stands.

---

## STOP

- Block file hash mismatch.
- Any step needs a change outside the fence: record it, raise it under §5, and ask.
- A database migration.

---

## Appendix A0 — the live answer (operator, 5 Oct 2026)

If it matches one of conversations 36–44, record its id. Otherwise record it as operator-supplied.

```
Voltura is an online tool that lets homeowners model a residential solar + battery system for their specific site. It: * Finds the exact location you enter (via OpenStreetMap) and pulls long‑term monthly solar irradiance and temperature data for that point (NASA POWER or a latitude‑based fallback). * Simulates a full year hour‑by‑hour, combining the solar generation with a typical household consumption profile built from the annual kWh you provide. * Adjusts the generation for panel orientation (south, east, west, north) and tilt angle, and runs the battery charge‑discharge cycle (≈90 % round‑trip efficiency). * Shows you the annual energy saved (kWh), monthly charts of generation, self‑consumption, grid import and any surplus that can’t be used, plus the overall mix of Direct Solar, From Battery and Grid Import. * Estimates CO₂ avoided using location‑specific grid emission factors (official data for Spain and the UK; elsewhere it notes no figure). * Values the savings with your own electricity tariff (or a national tariff where available); otherwise it displays the energy benefit without a monetary value. * Calculates a pay‑back period and a 25‑year ROI curve based on the installation cost you supply (or on sourced PV‑only costs for Spain/UK). * Generates a downloadable PDF report of the whole calculation and keeps a history of your past runs in the same browser. * Includes an AI Optimizer that can recommend a PV size and battery capacity tailored to your annual usage, daily load pattern and local irradiance, explaining the reasoning behind the numbers. In short, Voltura helps you predict how much solar and battery power you’ll actually use, how much you’ll save on your electricity bill, and what the environmental impact will be—all for your own address and usage data.
```
