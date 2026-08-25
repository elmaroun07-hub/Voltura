> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H1c — Claims inventory · week 2

**Fence.** In: taking claims down. Out: writing new marketing. Branch: `heatshield/h1c`.

**Must come down** (architecture-v2 §7): the "8760-hour hour-by-hour" claim, "adjusted for your panel tilt and orientation", "1.5% annual inflation", "35+ countries", "EU AI Act — Fully compliant", the hardcoded ROI, "Typical Daily Usage Pattern", the chat prompt's compliance assertion, "Computation CO₂", any post-timeout location result, any Python test count, and any CO₂ factor until H1b closes.

**Language discipline — enforce in code and copy:**

| Never say | Say instead |
|---|---|
| "Summer is unregulated in Spain" | "Solar-control compliance is not the same as knowing whether a dwelling is dangerously hot for the person in it" |
| "HeatShield grade" / "habitability rating" | "Screening index, benchmarked to recognised methods" |
| "TM59-compliant" | "Benchmarked against CIBSE TM59" |
| "We calculate indoor temperature" | "We prioritise; assessment follows survey" |
| "38% of southern Spanish social housing overheats" | Nothing — that figure is [REPORTED] from an abstract |

**Specific constraint.** `qsol;jul` is a real obligation with real limits — 2.00 kWh/m²·month private residential, 4.00 other uses, for reforms renewing more than 25% of the thermal envelope. Anyone at AVRA knows this. Claiming summer is unregulated loses the room in one sentence.

**IP flag.** CIBSE TM52/TM59 numerical thresholds in the research came from secondary reproductions, not licensed documents. Citing TM59 as a technical reference is fine. Reproducing its pass/fail criteria inside a commercial product is a licensing question to resolve before it reaches code. Flag it at H4; do not code it now.

**Gate H1c.** Every row of the inventory is either removed from the deployed UI or has a code path proving it — checked against the live URL, not the local build. Grep for the P7 words returns nothing in code or rendered output.
