# Block H-ASST-D16-N3 — three claims the product makes that its code doesn't back

Written 1 Oct 2026 (chat) for execution in Claude Code. Operator: Houssain.
Operator plan, 28 Sept 2026: D8 → D52 → **Assistant → D16 → N3**. This block is the last three, as three parts, one gate, one merge.

**Precondition: open this block only after H-D8D52 is CLOSED.** Branch off the tip at block open. Per the standing ruling, the rollback target is named "the tip at block open", never a literal sha written here.

---

## Ground truth — every line dated; re-verify each in P.1 before relying on it

| Fact | Source, date |
|---|---|
| **Assistant:** asked "What is Voltura?", it invented two features, feed-in tariffs and net present value, which exist nowhere in API or web source. Model-prior fabrication, the same family as the pre-H-OPT Optimizer | B1 transcript, conversation 35, messages 30–33, session `b1-probe-0000-4000-8000-000000000001`, 23 Sept |
| The Assistant's system prompt was at `artifacts/api-server/src/replit_integrations/chat/routes.ts:13`. B1 (`4aaeaec`) rewrote it to "Voltura models solar and battery savings using NASA POWER irradiance and grid carbon intensity data" plus a never-claim-any-regulation rule. `system-prompt.test.ts` pins it | B1 gate, 23 Sept |
| **D16:** countries not in the registry go through a free-text substring match on the location string. "Little Italy, Cairo, Egypt" gets Italy's factor. Cited: legacy carbon table | 11 Sept report — **last tested 11 Sept, before the ES/UK registry landed (`dfde7b7`, 23 Sept)** |
| H1 task 1.5 made the fallback whole-token and put the geocoded country first; Indianapolis → US 0.386, not India 0.708 | Gate H1, 10 Sept |
| The legacy lookup returns `null` on no match, and a `0.4` substitution sits in one visible place | H1 task 1.9, 26 Aug |
| **N3:** the PDF row "Est. 25-Year Net Gain" prints `lifetimeSavings`, which is gross savings, not net of install cost. Live, row 102 (€200,000 install): "Net Gain €30,975", while the ROI curve at year 25 is −€169,025 | H-PDF L2, 28 Sept |
| The route turns an install cost of 0 into `null` (`routes.ts:945` at the time) | H-PDF read phase, 28 Sept |
| PDFKit's standard fonts print only WinAnsi. U+2082 printed as garbage (N2), "Łódź" too (#5 L-local). **U+2212 (−) is not in WinAnsi** | H-PDF, 28 Sept |
| Open issues: #3 R1, #4 A4, #5 L-local, #6 R2 | 1 Oct |

---

## Session-open reads

1. `HEATSHIELD_CONTRACT.md` (repo root).
2. `contracts/AMENDMENTS.md` at the tip.
3. This file.
4. `contracts/rulings/h-d8-d52.md`, the last ruling.

---

## Branch

`heatshield/asst-d16-n3` off the tip at block open. First commit: this file, byte-identical to the operator's copy (sha256 in the operator's prompt). **One commit per part (A, B, C)**, so any single part can be reverted alone.

---

## Fence

**IN**
- **Part A:** the Assistant's system prompt and any sibling seed message; `system-prompt.test.ts`; a new test file for the feature map. **Edit only — `replit_integrations/` is shipped product code and is never deleted.**
- **Part B:** the carbon-factor lookup used when a country is not in the registry, and how it receives the country; its tests.
- **Part C:** the PDF renderer's money block; the web ROI card **only if** it also uses the words "Net Gain" for gross savings; tests.

**OUT**
- Registry values (ES/UK), the geocoder itself, the `0.4` substitution's behaviour (Part B records it, doesn't change it).
- Every stored money figure: savings, payback, `lifetimeSavings`, `roi()` and its curve (#3 R1 stays open).
- The chat model, provider or endpoint config (D26 territory).
- D12's "potential grid export" copy, unless the operator has ruled it into this block.
- Response shapes the web parses. If a part needs one changed, the web must tolerate the field being absent, because deploy order is not controlled (H-D8D52 finding).

---

## Part A — the Assistant describes only what exists

**A.1 Read.** Locate the prompt and every sibling seed message. List, from code at the tip, what the product actually does. That includes what H-D8D52 added: the recorded energy mix and "Surplus not used". **Build the list from the code, not from this file.**

**A.2 Tests first, failing on the unmodified prompt:**
- **TA1 Feature map:** a table in the test mapping every feature the prompt names to the file and symbol that implements it. A named feature with no implementation fails. A deleted implementation fails.
- **TA2** The prompt instructs: anything not on the list → say plainly that Voltura doesn't do it.
- **TA3** B1's pins still pass unchanged: no regulation claim.

**A.3 Implement:** the real feature list in the prompt, plus the TA2 rule.

**Failure modes**
- **A-a** Listing any feature without code behind it.
- **A-b** Over-correction: an Assistant that won't describe Voltura at all is also a failure.
- **A-c** Feed-in tariffs, export revenue, NPV, or compliance reappearing anywhere in the prompt.
- **A-d** Closing on a grep. **Part A closes on a live transcript only**, as B1 did.

---

## Part B — the country comes from the geocoder, never from the free text

**B.1 Reproduce first** at the tip, locally. Registry work landed after D16 was last tested. **If "Little Italy, Cairo, Egypt" no longer gets Italy's factor, record that with evidence and drop Part B.** Don't fix what doesn't reproduce.

**B.2 Read.** How the lookup gets its country; what the geocoder result carries (a structured country code or only a display string); what the no-match path does today, end to end, including how the response and the PDF show it.

**B.3 Tests first, failing on the unmodified lookup.** Each location string below must get **its own country's factor, or the existing no-match path — never another country's**:
- "Little Italy, Cairo, Egypt"
- "Jordan, Minnesota, United States"
- "Lebanon, Pennsylvania, United States"
- "Atlanta, Georgia, United States"

**B.4 Implement:** resolve by the geocoder's **structured** country. No token walk over free text.

**Failure modes**
- **B-a** Parsing the country out of the geocoder's display string. That is the same substring defect one layer down.
- **B-b** Replacing a wrong-country factor with an unlabelled default. The no-match path stays exactly as it is, and the ruling states what it prints.
- **B-c** Fixing only "Italy". The four strings are the minimum set.

---

## Part C — the PDF's net figure is actually net

**C.1 Read.** The money block in the renderer; how the ROI curve's year-25 value is computed; whether the install cost is persisted on the row; the web ROI card's labels.

**C.2 Tests first, failing on the unmodified renderer:**
- **TC1** Two rows:
  - "Est. 25-Year Savings" — gross, always shown;
  - "Est. 25-Year Net (after install cost)" — shown **only** when the install cost is known.
- **TC2** Net equals the ROI curve's year-25 value exactly, so the PDF and the web chart cannot disagree.
- **TC3** The €200,000 never case prints `-€169,025` with an **ASCII hyphen-minus**. The real-bytes check from H-PDF finds no U+2212.
- **TC4** Install cost absent (`null`) → no net row, never a net computed from 0.
- **TC5 Money pin:** stored savings, payback and `lifetimeSavings` are unchanged.

**C.3 Implement.** Net is computed at render time from persisted fields, so old rows get it too, with no migration.

**Failure modes**
- **C-a** Keeping the word "Gain" on a figure that can be negative.
- **C-b** A net built from a different cost than the curve uses.
- **C-c** A missing cost treated as 0. That's the `?? 0` family again.
- **C-d** Printing U+2212.

---

## §STOP — report and wait; do not work around

- Part B's structured country isn't available from the geocoder result.
- Any stored money figure moves.
- Any part needs a DB migration.
- Part A's feature list can't be mapped to code without judgement calls. List them for the operator.

---

## Gate (self-ruled up to the merge, per §14.2)

- **Tests:** new tests failed first on unmodified code (except the pins), pass after. Suite count before → after. Typecheck exits 0.
- **G13:** commit before any mutation. After each, restore and verify the file's hash matches the committed blob.
- **G9 mutations — each must be caught:**
  - MA1 add "feed-in tariff calculations" to the prompt's feature list
  - MA2 delete one mapped implementation's symbol reference
  - MB1 restore the free-text token walk
  - MB2 read the country from the display string
  - MC1 print `lifetimeSavings` as net
  - MC2 treat a `null` cost as 0
  - MC3 swap `-` for U+2212
- **§Merge dry run** on a scratch ref: both merges clean, no overlap.
- **G8 Tier B:** the ruling carries the deploy-path **UNPROVEN** line and A13's debt, verbatim.
- **Ruling:** `contracts/rulings/h-asst-d16-n3.md`.
- **Session budget (practice):** don't start §Merge with less than 40% of the usage window left. Stop at the gate instead.

---

## §Merge — operator-ruled; runs only on "merge authorised"

Pre-flight: `git fetch`; `main` == `origin/main` == the tip at block open; clean tree.

1. `git merge --no-ff heatshield/d8-d52-live-evidence` (the H-D8D52 evidence branch; confirm its name and tip first)
2. `git merge --no-ff heatshield/asst-d16-n3` — the tip
3. **One push.**

**§2 Auto-Deploy:** read from the Render API at merge time, recorded as observed. **Poll until both services serve the merge sha before any L-check.**

---

## Live checks — session `probe-asst-d16-n3-<date>-<sha>`

- **L1** `/api/version` and the web `build-sha` report the merge sha. CI on `main`: run id and result.
- **L2-A**
  - "What is Voltura?" in **five fresh conversations**: zero features absent from the TA1 map.
  - "Does Voltura calculate feed-in tariffs?" → no.
  - "Does it give net present value?" → no.
  - "Is Voltura EU AI Act compliant?" → B1's answer, unchanged.
  - Full transcripts saved; eight paid calls.
- **L2-B** (skip if Part B was dropped): POST `/api/calculate` for "Little Italy, Cairo, Egypt" and "Atlanta, Georgia, United States". Record the factor and the provenance each response states. Neither may be Italy's or Georgia's.
- **L2-C**
  - A new row at €200,000: PDF prints "Est. 25-Year Savings €30,975" and net `-€169,025`.
  - Old row 102 (session `probe-pdf-2026-09-28-ff44a9c`) renders the same, computed at render time.
  - A row with no install cost: no net row.
- **L3** Browser: one Assistant exchange, and the PDF download from the €200,000 row. If the save drops the connection, capture the page bytes, as ruled 30 Sept.
- List every probe row and conversation left in production.
- **Tier B at the real merge.** Carry the UNPROVEN line and A13.
- **Post-merge evidence** on `heatshield/asst-d16-n3-live-evidence`. Unmerged, unpushed; it rides the next code merge.

---

## Residue — record, do not fix

D12 (unless ruled in), R1 #3, A4 #4, L-local #5, R2 #6, the `0.4` substitution, the web schema's deploy-order dependency.
