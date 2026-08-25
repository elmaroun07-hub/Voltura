# Backfill index — gates closed before `contracts/rulings/` existed

**RETROACTIVE. Evidence in session transcript, not captured on disk.**

Written under H-∅.3, per `HEATSHIELD_CONTRACT.md` §6 "Backfill, once".

This file is an **index, not a record**. Every gate below was reviewed and ruled in a
chat session between 21 and 24 August 2026, against evidence that was produced live at
the time — diffs, test output, mutation runs, live server responses — none of which was
written to disk. §6 forbids reconstructing that evidence here, because a reconstructed
ruling is a manufactured one. What follows is what can be stated without invention:
which gate, when, which commit, and what the operator ruled.

Commit dates are `git log` author dates. Gate dates are the session dates and may differ
by a day where a session spanned midnight.

Baseline for the whole record: `78c26d5` (2026-08-14) — the architecture document's
stated ground truth.

---

## Voltura remediation — "Phase 0" in the old naming

Ten numbered tasks in three blocks, plus a pre-block lane. No H-series equivalent; this
work predates this contract. Listed because §2 requires knowing what already landed.

| Gate | Date | Commits | Ruling |
|---|---|---|---|
| Lane 0 (pre-block) | 2026-08-21 | `c1eeccf`, `a9e8379` | CLOSED — dependency install + 25 pre-existing typecheck errors cleared to 0 |
| Gate 1 (Block 1) | 2026-08-21 | `231a35e` (0.5), `613b8a8` (0.10), `e8fcacc` (0.3), `7693a58` (0.8) | CLOSED |
| Gate 2 (Block 2) | 2026-08-21 | `7cc6e88` (0.1), `962d8b8` (0.2), `da110a2` (0.4) | CLOSED |
| Gate 3 (Block 3) | 2026-08-22 | `0ed0167` (0.6), `60e1f01` (0.7), `7ec9671` (0.9) | CLOSED |

Pushed to `origin/main` on operator authorisation, 2026-08-22. Production schema DDL and
the disposition of pre-session rows were executed by the operator by hand, outside the
session.

## Phase 1 Block A — the NASA POWER key-format defect

| Gate | Date | Commit | Ruling |
|---|---|---|---|
| A0 — Inventory | 2026-08-22 | — (read-only) | APPROVED. Two contract errors found by the executor and upheld. |
| A1 — Trace | 2026-08-22 | — | APPROVED. Verdict **H4**: `2022JAN` requested against `202201` present; twelve fabricated `4.0` values for every location on Earth, reported as live NASA data. |
| A2 — Fail loud | 2026-08-22 | `d743dab` | APPROVED. Key format fixed; `\|\| 4.0`, `\|\| 15.0` and `lat \|\| 45` deleted; `resolution` provenance record added. |
| A3 — Tests | 2026-08-22 | `d743dab` | APPROVED. 10 tests, network-free fixtures. Mutation-tested: reintroducing the defect failed 6 of 10. |
| A3b — batteryEfficiency | 2026-08-22 | — (read-only) | APPROVED, Block A CLOSED. Parameter proven live. Operator corrected the executor's curtailment/conversion-loss split as asserted rather than measured. |

## Phase 1 Block B — make the claim true, then ship

| Gate | Date | Commit | Ruling |
|---|---|---|---|
| B0 — Claims inventory | 2026-08-22 | — (read-only) | APPROVED. Scope: NASA/irradiance claims only. Fence: four files. |
| B1 — Copy | 2026-08-22 | `45da79c` | APPROVED with B1.4 amended — PDF footer stops asserting rather than naming a year the persisted row cannot support. |
| B1a — Footer close-out | 2026-08-22 | `45da79c` | APPROVED, B1 CLOSED. |
| B2 (B2.1–B2.4) | 2026-08-22 | `45da79c` | APPROVED. B2.5 held on dashboard values. |
| B3 — Ship | 2026-08-23 | `b9ce581` (merge, `--no-ff`) | CLOSED. PR #1 merged on explicit operator word; API deployed and verified live; web deployed manually under the stagger. |

`b9ce581` is production `main`.

## Block R — remove Replit scaffolding

Branch `phase1/block-r-replit`. **Not merged. Not pushed.**

| Gate | Date | Commit | Ruling |
|---|---|---|---|
| R0 — Inventory | 2026-08-23 | — (read-only) | APPROVED. `replit_integrations/` excluded as shipped application code — now G4. |
| R1 — Inert and config-only | 2026-08-23 | `913e76d` | APPROVED. 11 paths, 1,382 deletions, including `scripts/post-merge.sh`, which ran unguarded `pnpm --filter db push` on every merge. |
| R3 — Full verification | 2026-08-23 | `84f94a1` | **SUBMITTED, AWAITING RULING.** 10 files, 5,585 deletions. |

---

## Known gaps in this index

Stated so the record is not mistaken for something more complete than it is.

- **No evidence is preserved for any gate above.** Diffs are recoverable from git; test
  output, mutation runs, live responses and rendered DOM are not.
- **Gate R2 has no separate row.** R2 was executed and committed as `84f94a1` but was
  ruled as part of Gate R3, which is still open.
- **Gate H-∅ is not listed here.** It is a live gate under this contract and gets its own
  ruling file.
- Three executor misclassifications at R0 (`.gitignore:47`, `pnpm-workspace.yaml:102`,
  and the `badge.tsx`/`button.tsx` `// @replit` comments called false positives without
  the files being opened) were self-reported and corrected before Gate R3. They are noted
  because the pattern — classifying a file from grep context without reading it — became
  a standing rule.
