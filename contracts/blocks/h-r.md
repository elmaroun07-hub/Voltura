> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H-R — Reconcile · blocking for the H-series, opens after H-∅

**Fence.** Read-only with respect to source, schema, configuration and dependencies. The block's own ruling file under `contracts/rulings/` is the sole permitted write — amended in v1.1; the original "no writes of any kind" contradicted §0 and §6. No DDL — and therefore, per G3, **no server boot**; `index.ts:23` calls `ensureChatTables()` before `listen()`. Use static inspection and the deployed Render URL, never a local listen.

**Tasks**

- **R.1** Diff `78c26d5..b9ce581`. List every architecture-v2 task the diff already satisfies.
- **R.2** For each of H0.1–0.10 and H1.1–1.9, mark: DONE / PARTIAL / OPEN — each with `file:line` or a live response as evidence.
- **R.3** Confirm the state of `phase1/block-r-replit`: what R1 deleted, what R2 holds.
- **R.4** **Amended v1.2.** Confirm `-999` is unguarded, and establish its **reachability condition**. Three parts: (i) static proof of the missing guard — `Number.isFinite(-999) === true`, no explicit rejection at the parse site, with `file:line`; (ii) a live response proving `irradianceMonthly` reaches the user unfiltered; (iii) a written reachability condition — under what input a fill value enters, and why the current hardcoded `irradianceYear` prevents it today. **No live `-999` sighting is required, because none is obtainable.** The value cannot enter through any user-controlled path while the year is hardcoded to a fully-processed 2022. Do not present a reachability proof as a sighting. **Separate deliverable — the fixture.** Query NASA POWER directly, not through the app, as Gate A1 corroborated Fuengirola at 2.6544. Recent unprocessed periods are the most likely source of a fill value; verify that, do not assume it. A location and period that genuinely returns `-999` becomes a permanent regression fixture for H1.0. G10 still holds — the test consumes the fixture, never the network. **Finding that pair is R.4's most valuable output.**
- **R.5** Confirm which of the four `lib/cte` modules are imported by anything.

**Failure modes.** Assuming a task is done because it appears in a commit message. Booting the server and triggering DDL. Reporting "no issues found" without naming what was checked.

**Gate R.** A written reconciliation table for all twenty tasks, each with evidence. The contract's task lists are amended by this table before H0 opens.

**Rollback.** None needed. If any write landed outside `contracts/rulings/`, that is a fence breach: report it under §5.
