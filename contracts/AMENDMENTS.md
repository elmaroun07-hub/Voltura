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

---

## A8 · 2026-08-25 — H0 runs as a verification-only block

**Operator ruling.** H0 is **not** closed administratively despite Gate R marking all ten
tasks DONE.

`file:line` proves the code exists. It does not prove two browsers in different sessions
cannot see each other's data, and that is H0's actual criterion. It is also the
highest-stakes assertion in the contract — live personal-data exposure on a public URL, in
front of a buyer with public-sector data-protection duties.

H0 therefore runs with **no code tasks and a live gate**: one two-session probe against the
deployed API plus the displayed-constant grep. Mechanical, so self-ruled.

Ruling file: `contracts/rulings/h0-gate-h0.md`. **CLOSED (self-ruled).**

**Generalise:** a task list marked DONE in code is not a closed gate. Where a gate's
criterion is behavioural, run the behaviour.

## A9 · 2026-08-25 — Block R merge, and merge ordering

**Operator ruling.** Block R merge approved. `voltura-web` Auto-Deploy **ON**, re-confirmed
on the operator's word of 24 Aug 2026 per §2, recorded here and in the Block R merge ruling.

Ordering, and the reason for it:

1. **Doc branches first** — `heatshield/h-groundwork`, `heatshield/h-r` (and `heatshield/h0`,
   which was stacked on `h-r` after the ruling was written). This puts the fence and the
   rulings on `main` where the next session finds them.
2. **Block R alone, after, `--no-ff`.** Alone so that `git revert -m 1` targets exactly
   6,967 deletions and nothing else. *A revert that has to disentangle doc commits is not a
   rollback.*
3. Execute the revert at the merge, re-apply, then verify the Assistant survived — G4,
   post-merge.

## A10 · 2026-08-25 — Both out-of-fence tasks move to the operator

**1.3** — the four `*_deploy.md` files stay for the operator to delete by hand. Widening a
fence to reach into a parent directory is a precedent worth more than four stale files, and
they cannot mislead a fresh clone. Low priority.

**1.1** — split. The executor inventories the **in-repo half**: the app and the GreenCalc
landing (`artifacts/greencalc/templates/*`, `static/lang/*`, `docs/`). The **external half**
is the operator's, and it shrank: **Rising UP was killed by decision on 24 Aug 2026**, so
that draft is shelved rather than inventoried. LinkedIn and ENISA remain.

## A11 · 2026-08-25 — The `-999` guard belongs at the parse boundary, and H1.8's real failure mode

**Operator ruling, two parts.**

**Guard at the parse boundary, not at a call site.** Every NASA response, every endpoint,
every parameter, filtered on the way in. Then the daily-versus-monthly question stops
mattering and the captured fixture tests it properly. **Stop hunting for a monthly
sighting** — the guard costs less than the search, and the cost of being wrong is a
fabricated euro figure.

**H1.8's dominant failure mode is not `-999`.** The reconciliation found that the monthly
endpoint *rejects* an out-of-range period rather than filling it:

> `"Please provide a correct end date. Your end date out of range. The data is available to 2025/12/31."`

So the likely H1.8 failure is **a rejected request silently becoming an average over fewer
years than requested** — the `4.0` defect's exact shape: a missing input quietly becoming a
plausible number.

**Added as a named failure mode for H1.8:** *silent partial coverage.* 1.8 must **error on
partial coverage** and **state the period it actually used**. A mean over three years when
five were requested, reported as five, is the same defect this contract exists to remove.
