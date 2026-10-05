# Block H-ASST-ACC2 — reword the three facts the model misread

Written 5 Oct 2026 (chat) for execution in Claude Code. Operator: Houssain.

Follow-up to H-ASST-ACC under the operator's ruling of 5 Oct 2026, **option (b)**: reword the fact sentences behind E1–E3, and narrow the L2 standard to the facts the operator rules material. **Material facts, ruled 5 Oct 2026: all 13 feature facts.**

**Precondition:** H-ASST-ACC's post-merge record is committed (`aba05a5` on `heatshield/asst-accuracy-live-evidence`, unmerged, 5 Oct). Branch off the tip at block open. The rollback target is named "the tip at block open", never a literal sha written here.

---

## Ground truth — every line dated; re-verify each in A.1 before relying on it

| Fact | Source, date |
|---|---|
| Production `main` = `dc2aa67`, live on both services | H-ASST-ACC L1, 5 Oct |
| The prompt's 13 feature lines are built from `chat/facts.ts`; temperature is 0.2 and pinned; the transcript checker and the A0 fixture exist | H-ASST-ACC `341d0d3`, 5 Oct |
| **E1** The model says "if NASA data are missing, it falls back to a latitude estimate". The code: missing data gives no result; the estimate runs only when NASA doesn't reply, errors, or replies malformed. 7 of 8 "What is Voltura?" answers, and L3 | H-ASST-ACC ruling, conversations 46–57, 5 Oct |
| **E2** The model says history is "stored locally in your browser". The code: calculations are stored on the server; the browser keeps only the id. Conversations 46, 49, 53, 57 | same |
| **E3** The model says the Optimizer "only provides the recommendation text, not a numeric result". The code: it returns the PV size and battery capacity as numbers, computed by a formula; the model writes only the explanation. Conversations 49, 51, 52 | same |
| **P1** The model says the PDF holds "all inputs". The code: it does not print the install cost | same |
| **P2** One answer contains a contradictory sentence about UK tariffs. The code: the UK has no national tariff; a tariff the user types counts | same |
| The executor traced all five to the wording of the fact sentences, not to a code defect. The checker missed all of them (A-e) | same |

---

## The L2 standard (ruled 5 Oct 2026)

- **Material = the 13 feature facts in `facts.ts`.** A statement that misstates any of them fails L2. A PARTIAL that renders one of them false counts as a misstatement.
- A wrong statement about anything **outside** the 13 facts is recorded in the ruling, and does not fail L2.
- A.1 lists the 13 facts by id in the ruling, so every L2 annotation names the fact it is judged against.

---

## Session-open reads

1. `HEATSHIELD_CONTRACT.md` (repo root).
2. `contracts/AMENDMENTS.md` at the tip.
3. This file.
4. `contracts/rulings/h-asst-accuracy.md`, the last ruling. It holds A.1's claim table, E1–E3, P1–P2 and conversations 46–57.

---

## Branch

`heatshield/asst-accuracy-2` off the tip at block open. First commit: this file, byte-identical to the operator's copy (sha256 in the operator's prompt). One commit per step (A.2 tests, A.3 implementation, ruling).

---

## Fence

**IN**
- The fact sentences in `chat/facts.ts` behind E1, E2, E3, P1 and P2, and the prompt lines built from them.
- Their tests and pins; the feature map's key text for those lines only (logic unchanged).
- The transcript checker: new patterns for E1–E3 and P1–P2, and fixtures holding the failing sentences from conversations 46–57.

**OUT**
- Every other fact sentence, unless A.1 finds it also misstated: then a §5 note, and ask.
- Every code behaviour a fact describes: the NASA fallback, history storage, the Optimizer, the PDF, tariffs.
- Temperature (stays 0.2), provider, model and endpoint config.
- Response shapes the web parses, and all web code.

---

## Part A — the five sentences, rewritten from the code

**A.1 Read.** For each of E1, E2, E3, P1 and P2, re-read the code that decides it at the tip, with file:line. Write the corrected sentence **from the code, not from this file**. Each must state its fact on its own terms:
- **E1:** the condition that triggers the latitude estimate, stated separately from what missing data does.
- **E2:** where calculations are kept, and what the browser keeps.
- **E3:** that the Optimizer returns the PV size and battery capacity as numbers, and that the AI writes only the explanation.
- **P1:** what the PDF prints, including that it omits the install cost.
- **P2:** the UK tariff fact, in one non-contradictory sentence.

Also list the 13 feature facts by id for the L2 standard.

**A.2 Tests first, failing on the unmodified prompt:**
- **TF5 Pins.** Each rewritten sentence has a pin that checks the code behaviour as well as the sentence, as TF1 does. A pin that still passes when its fact changes is a failure (G9).
- **TF6 Checker.** Run on the failing sentences recorded from conversations 46–57, it must flag E1, E2, E3, P1 and P2 each at least once. Run on a corrected rewrite of those answers, it must flag nothing. It must still flag everything in A0.
- **TF7** TF1–TF4 and B1's pins pass, with only the feature-map key text of the five lines changed.

**A.3 Implement** the five sentences and the checker patterns.

**Failure modes**
- **A-a** A sentence written from this file or memory instead of from the code.
- **A-b** A vacuous pin.
- **A-c** Over-correction: an Assistant that won't describe these features, or buries them in caveats.
- **A-d** Changing a code behaviour inside this block.
- **A-e** Closing on the checker alone. It only catches errors already known.
- **A-f** Closing on a grep. This block closes on live transcripts only.

---

## G9 mutations

Commit first (G13). Restore each file and hash-check it after its mutation.

- **M1** Put E1's old sentence back → TF5 or TF6 fails.
- **M2** Put E2's old sentence back → TF5 or TF6 fails.
- **M3** Put E3's old sentence back → TF5 or TF6 fails.
- **M4** Change the fallback trigger in code so missing data also triggers the estimate → E1's pin fails.
- **M5** Drop one new checker pattern → TF6 fails.

---

## Gate

**Pre-merge:** suite and typecheck green, M1–M5 caught, A.1's table and the list of 13 facts committed as evidence, ruling written OPEN.

**§Merge — run by the operator by hand in Git Bash (ruled 5 Oct 2026).** The executor does the dry run on a scratch ref: the evidence merge of `heatshield/asst-accuracy-live-evidence`, then this block, both `--no-ff`. Then Tier B. Then it writes the exact commands, with the expected tips, into the ruling and STOPS. The executor merges and pushes nothing.

**Post-merge** (evidence on unmerged `heatshield/asst-accuracy-2-live-evidence`):
- **L1** Both services serve the merge sha.
- **L2** Live, fresh conversations under a new probe session: "What is Voltura?" three times, plus the eight L2-A questions (11 paid calls). Each transcript is annotated claim by claim, naming the fact id each claim is judged against. **Pass = zero misstatements of the 13 feature facts.** Errors outside them are recorded, not failed. The checker must pass.
- **L3** One exchange in the built-in browser, judged by the same standard.
- **Tier B** at the real merge. The deploy path is UNPROVEN; A13's debt stands.
- The ruling also records H-ASST-ACC's L2 and L3 as re-run under this block.

---

## STOP

- Block file hash mismatch.
- Any step needs a change outside the fence: record it, raise it under §5, and ask.
- A database migration.
