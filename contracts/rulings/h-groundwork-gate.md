# H-∅ — Gate H-∅

**BLOCK / GATE** — H-∅ (Groundwork) / Gate H-∅

**DATE** — 2026-08-24 (executed), ruling file written 2026-08-25

**COMMIT (before)** — `b9ce581` (production `main`; branch cut from here)

---

## TASKS CLAIMED CLOSED

- **∅.1** — `contracts/` and `contracts/rulings/` created.
- **∅.2** — `HEATSHIELD_CONTRACT.md` written to the repository root. Written at v1.1 in `dc1769d`; updated in place to **v1.2** after the operator issued that revision. §0 makes the on-disk file the fence, so a stale copy is a defective fence.
- **∅.3** — `contracts/rulings/00-backfill-index.md` written. Index only — gate, date, commit, outcome — marked retroactive, per §6 "Backfill, once". No evidence reconstructed.
- **∅.4** — Committed to `heatshield/h-groundwork`. Not merged.

## DIFF SUMMARY

`dc1769d` — 2 files changed, 539 insertions(+), 0 deletions(-)

```
HEATSHIELD_CONTRACT.md                 | 453 +++
contracts/rulings/00-backfill-index.md |  86 +++
```

Subsequent v1.2 update to `HEATSHIELD_CONTRACT.md` and this ruling file are a second
commit on the same branch. No source file, schema, config or dependency touched in either.

## TEST EVIDENCE

**None applicable, and none claimed.** H-∅ adds two Markdown files and touches no code.
The suite was not run because nothing in it could be affected. Recording the absence
rather than pasting an unrelated green result as though it evidenced this block.

## LIVE EVIDENCE

**None applicable, and none claimed.** H-∅ ships nothing to any server. G12 requires live
evidence where behaviour changes; no behaviour changed.

Gate checks, run locally:

```
ls contracts/rulings/         →  00-backfill-index.md
HEATSHIELD_CONTRACT.md        →  readable at repository root, 14 sections §0–§13
git diff --stat               →  the two paths above and nothing else
```

## ROLLBACK COMMAND

```
git branch -D heatshield/h-groundwork
```

**Not executed.** Per G8 as amended in v1.2, a block that has not merged demonstrates the
rollback is *available* rather than running it. Demonstrated:

- `main` unchanged at `b9ce581`, local and remote
- `heatshield/h-groundwork` unmerged and never pushed
- deleting the branch would restore the repository exactly, and would destroy this block's
  only output

This was raised at the gate as amendment **A6** and upheld — G8 previously required
execution at every gate, which for H-∅ meant deleting the branch holding the work.

## RESIDUE

- `0001-feat-api-web-AI-Assistant-Optimizer-on-Mistral-chat-.patch` — untracked, predates
  every fence in this project, never in scope, not touched.
- `docs/` — untracked, contains `VOLTURA-GROUND-TRUTH.md`. Same status.
- **Gate R3 (Block R) is submitted and unruled.** Not residue of this block, but the
  repository carries an open branch `phase1/block-r-replit` at `84f94a1` that H-∅ did not
  touch and does not resolve.
- `heatshield/h-groundwork` is itself unmerged by design — ∅.4 says it may ride with
  Block R or land alone. That decision is open.

## FINDINGS RAISED AT THIS GATE

Both were upheld by the operator in contract v1.2 §13.

- **A6 — G8 defect.** Executing a destructive rollback to satisfy a checklist destroys the
  block's output and serves nothing. G8 now scopes execution to blocks that reach `main`.
- **A7 — R.4 defect.** R.4 demanded live evidence of `-999`, which is unobtainable: the
  value cannot enter through any user-controlled path while `irradianceYear` is hardcoded
  to a fully-processed 2022. The underlying finding stands — **`-999` is latent, not
  live** — and C6 was amended to record that task 1.8 is what *activates* it, making the
  1.0/1.8 pairing a safety ordering rather than a convenience.

## RULING

**OPEN — awaiting operator ruling.**

Written under §7's close protocol, which requires the gate ruling to exist with whatever
is proven so far, marked OPEN, rather than waiting for a verdict to create the file.
Contract v1.2 §13 upheld both findings raised at this gate, but no explicit CLOSED ruling
for Gate H-∅ has been issued, and §0 requires a written ruling in `contracts/rulings/`
before the next block opens. H-R therefore has not started.
