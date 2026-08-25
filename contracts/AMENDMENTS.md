# Amendments — append-only, newest last

Per `HEATSHIELD_CONTRACT.md` §14.4. Never regenerate the contract for a two-line change.
Fold an amendment into its block file only when that block next opens.

Amendments **v1.1 – v1.3** predate this file and are recorded in the root contract's §13.
Everything from here forward appends below.

---

## 2026-08-25 · §14.1 execution — §10–§12 kept in root

**Raised by:** executor, during the 14.1 split.
**Class:** gap in an operator amendment, not a refusal.

14.1 says the root contract "keeps §0–§8 and §13–§14" and that §9 splits to
`contracts/blocks/`. It is silent on **§10 (out of scope for the executor)**,
**§11 (open questions this contract cannot answer)** and **§12 (the standard)**.

Kept in root. All three are short, invariant, and read every session — §12 in particular
carries the line the whole contract reduces to. Dropping them would have removed
operator-only material from the file the operator reads.

Trivially reversible: move the three sections to a block file or delete them.

---

## 2026-08-25 · Gate H-∅ self-ruled CLOSED

Under §14.2. All three Gate H-∅ criteria are mechanical — `ls contracts/rulings/`,
contract readable at root, `git diff --stat` confined to those paths.

Ruling file: `contracts/rulings/h-groundwork-gate.md`.

---

## 2026-08-25 · Gate R3 self-ruled CLOSED

Under §14.2, as directed retroactively by v1.3 §13: *"Gate R3 is self-ruled under 14.2 —
all eight of its criteria are mechanical."*

Ruling file: `contracts/rulings/block-r-gate-r3.md`.

**Note the boundary.** Self-ruling Gate R3 closes the *gate*. It does not merge Block R.
§14.2 reserves **any merge to `main`** and **any block that deletes files** to the
operator, and Block R is both — 21 files, 6,967 deletions. The merge remains operator-only
and is not taken here.

---

## 2026-08-25 · Gate R self-ruled CLOSED — H0 is empty

Under §14.2. All five R-task criteria mechanical.

Ruling file: `contracts/rulings/h-r-gate-r.md`.

**Task lists amended by the reconciliation, per Gate R's own terms:**

- **H0 — all ten tasks DONE.** Satisfied by `78c26d5..b9ce581`, already in production. H0's
  fence reads "0.1–0.10, minus whatever Gate R marked DONE", so its scope is now empty.
  The block should be closed administratively rather than opened. C4 anticipated 0.9; the
  reconciliation finds all ten.
- **H1 — 1.0, 1.5, 1.6, 1.7, 1.8, 1.9, 1.x OPEN; 1.1 PARTIAL; 1.3 DONE by relocation.**

Two H1 tasks cannot be executed from inside the fence and need an operator decision:

- **1.3** — the four `*_deploy.md` files are in `Desktopdev/`, the parent directory, not in
  the repository. Not tracked, not shipped, not deletable from inside any fence this
  contract defines.
- **1.1** — LinkedIn, ENISA and Rising UP drafts are not in this repository. The in-repo
  half (`artifacts/greencalc/templates/*`, `static/lang/*`, `docs/`) is inventoriable and
  remains to be done.

**`-999` fixture found and committed** — `contracts/fixtures/nasa-power-daily-fillvalue-20260813-20260823.json`.
Real NASA response, unedited: `ALLSKY_SFC_SW_DWN` is `-999` on 2026-08-21/22/23 and `T2M`
on 2026-08-23, at Fuengirola's coordinates. Caveat recorded in the ruling: it is the
**daily** endpoint; the app calls **monthly**, and no monthly fill value was obtainable —
the monthly endpoint rejects out-of-range periods rather than filling them.
