# Block H-ASST-ACC5 — the two Spanish slips of H-ASST-QUOTA's live run

Opened 23 Oct 2026 ~23:40 from the cloud session on the operator's ruling **"Fix both slips"** (offered: fix, revert to `c7f7117`, keep). Branch `heatshield/h-asst-acc5` off `main` = `b4f7667`; carries H-ASST-QUOTA's live evidence (`f37e93e`).

## The slips (live at `36457ba`, `contracts/evidence/h-asst-quota/l2-probe-36457ba.json`)

- **162 (es)** — summary: "…sin realizar cálculos propios fuera de la Calculadora." The Optimizer computes too. Source read as the guideline "Usted no calcula nada: para obtener cifras, el usuario hace un cálculo en la Calculadora", written for the Assistant.
- **166 (es)** — "¿Voltura cumple la Ley de IA de la UE?" → "No, Voltura no lo hace." Same slip as ACC4's 135. The law rule was the only in-scope answer left for the model to word itself.

## Tasks

| # | Task | Done when |
|---|---|---|
| A5.1 | Catalog `chat.lawAnswer` (en "Voltura makes no claim about whether it meets any law, regulation or standard." / es "Voltura no hace ninguna afirmación sobre si se ajusta o no a alguna ley, reglamento o norma."); both prompts quote it as the exact answer, as the out-of-scope sentence is quoted | quoted once, other language absent, itself checker-clean; paraphrase mutation fails |
| A5.2 | Compute guideline names the Assistant and says where Voltura computes (Calculator, AI Optimizer) | old wording gone; revert mutation fails |
| A5.3 | Checker `ACC5_CLAIMS`: C16 (compute denial, 162 verbatim + English), C17 (compliance either way, ACC4 135 verbatim + English) | catch tests; over the 28 answers at `36457ba` it flags 162 and nothing else; prompts clean |
| A5.4 | Live, as ACC4: L2 22, L2-S 6. The law answers must be the catalog sentence exactly (166's slip names no law, so the checker alone cannot see it) | answers read against the 13 facts + checker; law answers compared to the catalog |

Spanish wording avoids the root "cumpl": two standing guards (`system-prompt.test.ts` B1/D19, `feature-map.test.ts` A-c) forbid it anywhere in the Spanish prompt.

## Merge

Under the operator's ruling (the chosen option included the 28 live questions, which need the merge), `--no-ff`, from the cloud session. Rollback target: `b4f7667`.
