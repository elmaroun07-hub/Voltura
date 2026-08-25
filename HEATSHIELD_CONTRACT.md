# HeatShield — Master Execution Contract (H-series)

**v1.3 · 24 August 2026 · Houssain El Marouni**
Amended three times on 24 Aug 2026. See §13. **§14 governs process cost and overrides any procedure above it that costs more than it protects.**
Authority: `heatshield-architecture-v2.md` (19 Aug 2026) + the Voltura Phase 1 remediation record (22–23 Aug 2026).
Location: repository root. **This file is the fence. A session without it on disk has no fence.**

---

## 0. How to read this

You are Claude Code executing against a written contract. This is not a task list. It is a set of gates you may not pass without evidence.

- Read this file in full before your first tool call. Every session. No exceptions.
- Work proceeds in blocks: H-R, H0, H1, H1b, H1c, H2, H2b, H3, H4.
- A block does not start until its precondition block is CLOSED by a written gate ruling in `contracts/rulings/`.
- A gate closes on evidence, never on assertion. "I fixed it" is not evidence. A diff, a failing-then-passing test, and a live-server response are evidence.
- If this contract is wrong, refuse and say so. See §5. **Refusal is a success state, not a failure.**

---

## 1. Naming — resolving a live collision

Three documents in this repository use the word "Phase" to mean three different things. This has already caused one error (a scope fence carried from one route to another without checking it was the same route). It is resolved here:

| This contract | heatshield-architecture-v2.md | Aug-2026 Voltura remediation | Meaning |
|---|---|---|---|
| — | — | "Phase 0" | TypeScript errors 25→0, coverage 89→98%. Done. |
| — | — | "Phase 1" | The NASA POWER key-format defect. Done, shipped `b9ce581`. |
| H-∅ | — | — | Groundwork — put the contract and rulings on disk. New, v1.1. |
| H-R | — | — | Reconcile the doc against reality. New. |
| H0 | Phase 0 | — | Stop the bleeding |
| H1 | Phase 1 | — | Truth |
| H1b | Phase 1b | — | `lib/emissions` |
| H1c | Phase 1c | — | Claims inventory |
| H2 | Phase 2 | — | Consolidate |
| H2b | Phase 2b | — | Spanish |
| H3 | Phase 3 | — | Layer 1 — the product |
| H4 | Phase 4 | — | Layer 2 and governance |

**Rule:** in any session, in any commit message, in any ruling — say **H2**. Never say "Phase 2". If the operator says "Phase 2", ask which document he means before acting.

---

## 2. Ground truth

| | |
|---|---|
| Architecture doc's stated ground truth | `78c26d5` (19 Aug 2026) |
| Actual production `main` | `b9ce581` (23 Aug 2026) |
| Rollback target | `b9ce581` — **not** `7ec9671` |
| Open branch | `phase1/block-r-replit` at `84f94a1` — R1 = `913e76d` (11 files, −1,382); R2 = `84f94a1` (10 files, −5,585), committed 24 Aug, never pushed. Working tree clean apart from two untracked items. |
| Block R status | Gate R3 submitted, awaiting operator ruling. Not closed. Not merged. |
| Deploy | Render Frankfurt. `voltura-api` Auto-Deploy On Commit. `voltura-web` Auto-Deploy ON — operator statement, 24 Aug 2026. |

**On the deploy row.** Render dashboard settings are not observable from a coding session. The executor must neither assert nor assume either state — G5's rule against unmeasured values applies to configuration as much as to irradiance. **The operator is the sensor.** Re-confirm Auto-Deploy state at each merge gate, and record the confirmation in that gate's ruling. Not earlier; the merge is the only moment it changes an outcome.

The architecture document is four days older than production. Between `78c26d5` and `b9ce581`, work landed that overlaps its Phase 0 and Phase 1 task lists. Some tasks in this contract may already be complete. You do not know which. That is what H-R is for, and it runs first.

---

## 3. Global hard constraints

These bind every block. No block-level fence may relax them. If a task appears to require breaking one, refuse under §5.

| # | Constraint |
|---|---|
| G1 | Never commit to `main`. It is live and the API deploys on commit. |
| G2 | One branch per block: `heatshield/<block>`. One merge at the end, with `--no-ff`. A fast-forward produces no merge commit and silently breaks `git revert -m 1`. |
| G3 | No DDL, no `db push`, no schema mutation unless the block's fence grants it in writing. Note: `index.ts` runs DDL before `listen` — booting the server is a schema write. If a fence forbids DB writes and also requires a live check, the fence contradicts itself. Refuse. |
| G4 | **Never delete `artifacts/api-server/src/replit_integrations/`.** It is the shipped AI Assistant — conversations routes, SSE stream, `chatStorage` — and 9 of the 36 api-server tests. Architecture-v2 task 2.3 refers only to the unregistered `audio`/`image`/`batch` subpackages. A task phrased as "delete replit_integrations" is a contract error. Refuse and report. |
| G5 | No `\|\|` numeric default. Anywhere. Not for irradiance, not for latitude, not for temperature, not for carbon intensity, not for a rate limit. Typed error instead. This is P2 and it is the defect that cost two days. |
| G6 | No number reaches the UI or a PDF unless a function computed it or a cited, dated source supplies it. |
| G7 | Machine enums never render to humans. Any enum that reaches a view needs an explicit label map, and the gate must inspect the **render site**, not the type definition. A previous branch would have shown users `nasa-live`. |
| G8 | Every gate has a rollback command. For any block that reaches `main`, the rollback is **executed** at the gate — not merely written down. A gate was once closed on four of five tasks because the rollback step was skipped. **Amended v1.2:** for a block that has not merged, the rollback is **demonstrated available** — `main` unchanged, branch unmerged, unpushed — and not executed. Deleting a branch to satisfy a checklist destroys the block's only output and serves nothing. Executing a destructive rollback for compliance is itself a breach of G8's purpose. |
| G9 | Tests are mutation-tested. Reintroduce the defect; prove the test fails; restore. A test that passes both ways tests nothing. |
| G10 | No network in tests. Fixtures only. The harness must raise if a live call leaks. |
| G11 | No new track opens until H3 ships. The repository already holds four abandoned integrations, three misleading status files and a second application. |
| G12 | Evidence comes from the live server, not from local assumption. |
| G13 | Never leave work uncommitted at session end. Commit WIP to the block branch. R2 was lost to a usage limit; uncommitted work is the most losable state there is. |

---

## 4. Standing principles

Carried from architecture-v2 §3. Every gate runs the review test.

| # | Principle | Review test the gate must run |
|---|---|---|
| P1 | Every number is computed by a function or read from a cited, dated source | Point at the line or the citation |
| P2 | Refuse to guess. Typed errors, never silent fallbacks. Where a score is uncertain, publish the uncertainty | Does any `\|\|` substitute a numeric default? Does any score hide its input completeness? |
| P3 | LLMs explain, never compute | Does any displayed number originate in a model response? |
| P4 | Nothing in the UI that is not in the code | Does the claims inventory pass? |
| P5 | One engine, one carbon table, one geocoder, one PDF path | Is there a second implementation of anything? |
| P6 | Not wired to a user path = not shipped | Would deleting it change behaviour? |
| P7 | Layer 1 outputs are never called grades, ratings, or compliance results | Grep the codebase and the rendered UI for those words |

**P7 is legal exposure, not style.** A screening index presented as a habitability grade to a public body is a misrepresentation made in a procurement context.

---

## 5. The refusal protocol

You are expected to refuse. The contract has been wrong before, and every time it was caught it was caught by the executor, not the author.

Refuse and report when:

- A task would break a global constraint (§3).
- Two clauses of the contract cannot both be satisfied.
- A specified value cannot be produced by any code path (a dead enum).
- An instruction contradicts what the code actually does — **the reading of the code wins over the literal instruction.**
- A task's stated location does not match where the thing actually lives.

Refusal report format:

```
REFUSAL — <block>.<task>
Instruction:   <what the contract said>
Reality:       <what the code / repo / server actually shows, with file:line>
Conflict:      <which clause it breaks, or which other clause it contradicts>
Options:       <2–3 ways forward, with consequences>
Recommendation: <one>
```

Then stop and wait. Do not pick one and proceed.

**Precedents — this has worked:**

- A boot was refused because `index.ts:23` runs DDL before `listen` while the fence forbade DB writes.
- An explicit instruction to use `Object.keys()` was overruled by reading the data: key `202213` is the annual mean, not a thirteenth month.
- `--no-ff` was raised unprompted; without it the approved rollback would have silently failed.
- Three of the executor's own misclassifications were reported against itself.
- Session open, 24 Aug 2026: §2's ground truth was stale on arrival (R2 already committed), and H-R's fence contradicted §0 and §6. Both refused, neither reinterpreted. The contract was wrong; the executor was right.

Report your own errors the same way. Self-reported errors are the cheapest kind.

**The rule runs both ways.** Do not assert unobservable state either — dashboard settings, another machine's filesystem, what the operator did between sessions. Say what you can see, name what you cannot, and ask. A refusal that asserts a fact it just admitted it cannot check is a weaker refusal than it needs to be.

---

## 6. Evidence schema

Every gate ruling is a file at `contracts/rulings/<block>-<gate>.md` containing:

```
BLOCK / GATE
DATE, COMMIT (before)
TASKS CLAIMED CLOSED       — one line each
DIFF SUMMARY               — files, insertions, deletions
TEST EVIDENCE              — suite result; mutation result per new test
LIVE EVIDENCE              — request, response, and what in the response proves it
ROLLBACK COMMAND           — and the output of actually running it
RESIDUE                    — anything touched but not finished
RULING                     — CLOSED / OPEN / REFUSED
```

**Backfill, once.** Gates A0–A3b, B0–B3 and R0–R2 closed in chat, with no file on disk. **Do not reconstruct their evidence** — that would be manufacturing a record. Write one `contracts/rulings/00-backfill-index.md` listing gate, date, commit and outcome per line, marked *retroactive — evidence in session transcript, not captured on disk*. An honest index beats an invented ruling.

**Residue is a field, not prose.** Untracked files, half-touched modules, anything opened and not closed goes in RESIDUE. A clean-tree claim with two untracked items is not a clean tree.

**Deletion blocks name their exclusions.** Any block whose gate reports "clean under permitted exclusions" must list the exclusions **by path** in the ruling. "Two permitted exclusions" is not a record. G4 is the reason.

**The trace rule.** Every field in a trace must be able to express the failure it exists to detect. A field reporting `nasaHttpStatus: 200` reads as success even when every key lookup missed — the trace had a hole and only the inventory caught it. Before adding a diagnostic field, ask: *what does this field look like when the thing it monitors is broken?* If the answer is "the same", the field is useless.

---

## 7. Session protocol

Sessions end abruptly — usage limits, not decisions. Design for that.

**Open:**

1. Read this contract.
2. Read the most recent file in `contracts/rulings/`. If the directory is absent or empty, say so and continue — a missing record is a finding to report, not a reason to stop.
3. State: current block, current gate, what closed last session, what you are about to do.
4. Do not begin until that statement is on screen.

**Close (or on any limit warning):**

1. Commit WIP to the block branch with message `WIP <block>.<task> — <one line>`. G13.
2. Write or update the gate ruling with whatever is proven so far, marked OPEN.
3. State in one line what the next session opens on.

---

## 8. Known collisions and ordering

Things the architecture document does not say, which will break execution if not handled in this order.

| # | Collision | Ruling |
|---|---|---|
| C1 | `-999` is not in architecture-v2 at all, and it is live in production. NASA POWER's fill value for missing months. It is **finite**, so the Block A guard does not catch it; it passes into `irradianceMonthly` and out into a euro figure a user reads. Same class as the defect that cost two days. | Insert as **H1.0** — the first task of H1, before anything else in that block. |
| C2 | **Harvest before archive.** Task 2.1 removes `artifacts/greencalc/`. But `models/energy_model.py` holds the correct `-999` filter and the 2019–2023 multi-year averaging shape (needed by H1.0 and 1.8), and `static/lang/es.json` holds the Spanish strings (needed by H2b). Archiving first destroys both. | Extraction is a precondition of H2, executed and committed in H1. Reject greencalc's per-month fallback, its `15.0` temperature constant, and its `source: "nasa"` label that lies when the fallback fired. |
| C3 | Block R must land before H2. Task 2.13 (`.replit` run target) and parts of 2.3 may already be done by R1 (`913e76d`, including `scripts/post-merge.sh`, which ran unguarded `db push` on every merge) or by R2 (`84f94a1` — vite plugins, catalog entries). | **Amended v1.1:** R2 is committed. Rule Gate R3, merge Block R with `--no-ff`, execute the revert at the merge, then open H2. Do not re-do R1's or R2's deletions. |
| C4 | Several H0/H1 tasks may already be closed by the 22–23 Aug work — notably 0.9 (the lat-45 geocode fallback: `lat \|\| 45` was deleted at Gate A2) and parts of 1.1/1.2 (a claims inventory ran at Gates B0–B1a, but only over the NASA/irradiance claims, not the GreenCalc landing, LinkedIn, or funding drafts). | H-R decides. Do not assume either way. |
| C5 | `lib/cte` is imported by nothing — 31 zones, 279 cells, 72 passing tests, orphaned. Architecture-v2 §2 splits it: `cte-zones` and `solar-irradiation` are Layer 1 and wire in at H3; `qsol-jul` and `cte-u-limits` are Layer 2 and wait for H4. | Do not attempt to wire all four at once. That was v1's error. |
| C6 | Task 1.8 (multi-year irradiance mean) and H1.0 (`-999` guard) touch the same code path. **Established at Gate H-∅ (v1.2):** `-999` is currently **latent, not live** — unreachable only because `irradianceYear` is hardcoded to a fully-processed 2022. **1.8 is what activates it.** The moment the year range becomes a parameter, incomplete or unprocessed periods become reachable and the missing guard begins fabricating numbers. | One task, one branch, one gate. This is a **safety ordering**, not a convenience. If 1.8 ever ships without 1.0, the product resumes fabricating — the `4.0` defect again, with a different constant. Do not split them. Do not let 1.8 land first "just to unblock". |
| C7 | The Optimizer quotes its own priors (~5.5 for Tétouan where the site computed 5.01) — a P3 violation shipping today, addressed only at 4.7. | Note it in H1c's inventory as a known-open claim. Do not fix it early; it needs `simulate8760()` extracted (2.11) first. |

---

## 9. The blocks

**Split out under §14.1.** One file per block at `contracts/blocks/<block>.md`:

| Block | File | Block | File |
|---|---|---|---|
| H-∅ | `h-groundwork.md` | H1c | `h1c.md` |
| H-R | `h-r.md` | H2 | `h2.md` |
| H0 | `h0.md` | H2b | `h2b.md` |
| H1 | `h1.md` | H3 | `h3.md` |
| H1b | `h1b.md` | H4 | `h4.md` |

Session open reads: this file + the current block file + the latest ruling. Never all ten.

---

## 10. Out of scope for the executor

The entity and access track (architecture-v2 §11) runs in parallel and is not code. Do not action E1–E8 from a coding session. One standing note only: **E1** — monitor the Junta CPI and AVRA project pages weekly for open *consultas preliminares*. Art. 115 LCSP market consultation is open to any natural or legal person, which means the conversation can start before the entity exists.

---

## 11. Open questions this contract cannot answer

These belong to the operator. Do not resolve them by choosing.

- What is HeatShield in twelve months? H4's scope depends on it. Asked three times, still open.
- Which municipality first? H3.1 ingests Catastro municipally. Pick one before H3 opens.
- Has AVRA ever run a *consulta preliminar* that could have been answered? E2 tells you.

---

## 12. The standard

`lib/cte` already behaves correctly: values computed or cited, archipelago required with no default, a test named *"does NOT rank south first in the Canaries"* proving the ranking comes from data rather than intuition, SHAP deleted with a comment explaining why, an offline harness that raises if a live call leaks.

**The whole contract is one instruction: make everything else behave the way `lib/cte` already does.**

---

## 13. Amendment record

**v1.1 — 24 August 2026.** Issued in response to two refusals and one unresolvable question raised at session open. All three were upheld.

| # | Raised | Ruling |
|---|---|---|
| A1 | §2 ground truth stale — R2 committed as `84f94a1` before the contract arrived | Upheld. §2 and C3 amended. Block R needs a ruling and a merge, not a commit. |
| A2 | §2 asserts `voltura-web` Auto-Deploy ON; the executor cannot observe a dashboard | Upheld in part. State confirmed ON by the operator, 24 Aug. §2 now names the operator as the sensor and requires re-confirmation at each merge gate. §5 extended: the executor must not assert unobservable state either. |
| A3 | H-R's fence forbade all writes while §0 required the contract on disk and §6 required ruling files | Upheld — contract error. New block H-∅ added; H-R's fence narrowed to source, schema, config and dependencies. This is the same self-contradiction as Gate A0 (§2.2 forbidding DB writes while §2.6 required a live check), repeated. |
| A4 | No `contracts/` directory; no gate has ever been recorded on disk | Upheld. H-∅.3 backfills an honest index. §6 forbids reconstructing evidence that was never captured. |
| A5 | "Clean under the two permitted exclusions" — exclusions unnamed | New rule. §6: deletion blocks list exclusions by path. G4 is the reason. |

**v1.2 — 24 August 2026, after Gate H-∅.** Two amendments, both raised by the executor and both upheld.

| # | Raised | Ruling |
|---|---|---|
| A6 | G8 requires executing the rollback at every gate; for H-∅ that meant deleting the branch holding the block's only output. Flagged rather than skipped silently. | Upheld — contract defect. G8 scoped to blocks that reach `main`. Pre-merge blocks demonstrate the rollback is available rather than executing it. Executing a destructive rollback for compliance breaches G8's purpose. |
| A7 | R.4 demands live evidence of `-999`, but no location with a missing month is known, and a reachability proof is not a sighting. | Upheld — task defect. R.4 rewritten in three parts, live sighting dropped as unobtainable. The finding underneath it stands on the record: `-999` is latent because `irradianceYear` is hardcoded to 2022. C6 amended accordingly — 1.8 *activates* the defect, so the pairing is a safety ordering. |

**v1.3 — 24 August 2026. Operator amendment.** Two turns produced two amendments and no product code; the process began consuming the capacity it exists to protect. §14 added. Applies retroactively: **Gate R3 is self-ruled under 14.2** — all eight of its criteria are mechanical, as are the two additions requested at v1.1.

---

## 14. Cost discipline

**This section overrides any procedure above it that costs more than it protects.** Capacity is 3–5 hours a day and every session read is paid for twice — once by the executor, once by the operator reading the report.

### 14.1 Split the contract

- Root `HEATSHIELD_CONTRACT.md` keeps §0–§8 and §13–§14 — the invariants. Read every session.
- `contracts/blocks/<block>.md` — §9 split, one file per block. Read only the block you are on.
- Session open reads: invariants + current block + latest ruling. Nothing else. Never all nine blocks.

> **Executor note, 25 Aug.** 14.1 names §0–§8 and §13–§14 but is silent on §10 (out of scope), §11 (open questions) and §12 (the standard). All three are short, invariant and read every session, so they were **kept in root**. Recorded in `contracts/AMENDMENTS.md`, trivially reversible.

### 14.2 Gates self-rule

A gate whose criteria are entirely mechanical — test counts, greps, diff stats, build results, live HTTP responses — is **ruled by the executor**. Write the ruling file, mark it `CLOSED (self-ruled)`, open the next block.

The operator rules only on:

- any merge to `main`
- any block that deletes files
- contract amendments
- refusals under §5
- a gate with a criterion requiring judgment rather than a check

Everything else proceeds without asking. The contract exists so a session can run without its author. Asking for a ruling that the criteria already answer is a cost, not a courtesy.

### 14.3 Reports live on disk

The ruling file **is** the report. In chat, emit:

```
<block>.<gate> — CLOSED (self-ruled) | <commit> | next: <block>
```

Detail stays in the file. Do not reproduce a gate report in chat. A report written to be pasted is paid for twice.

### 14.4 Amendments append

`contracts/AMENDMENTS.md`, append-only, newest last. Never regenerate the contract for a two-line change. Fold an amendment into its block file only when that block next opens.

### 14.5 One chat turn per session

Batch. Three clean gates are three lines in one message at session end — not three messages. Interrupt mid-session only for a §5 refusal or an operator-only ruling under 14.2.
