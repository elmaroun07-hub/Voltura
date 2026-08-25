> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H-∅ — Groundwork · first, and it is ten minutes

Added in v1.1 because §0 requires this contract at the repository root, §6 requires ruling files, and H-R's original fence forbade all writes. Those three could not hold together. This block resolves it.

**Fence.** In: creating `contracts/` and `contracts/rulings/`, writing this contract to the repository root, writing the backfill index. Out: every source file, every schema, every config, every dependency. Branch: `heatshield/h-groundwork` — G1 still applies.

**Tasks**

- **∅.1** Create `contracts/` and `contracts/rulings/`.
- **∅.2** Write this contract to the repository root as `HEATSHIELD_CONTRACT.md`.
- **∅.3** Write `contracts/rulings/00-backfill-index.md` per §6's backfill rule — index only, marked retroactive.
- **∅.4** Commit. Do not merge yet; it can ride with Block R or land on its own.

**Failure modes.** Reconstructing evidence for gates that closed in chat. Touching anything outside `contracts/` and the root contract file. Merging to `main`.

**Gate H-∅.** `ls contracts/rulings/` returns the index. The contract is readable at the repository root. `git diff --stat` shows changes to those paths and nothing else.

**Rollback.** `git branch -D heatshield/h-groundwork` — nothing shipped, nothing to revert.
