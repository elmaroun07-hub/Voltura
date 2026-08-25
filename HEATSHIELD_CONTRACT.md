# HeatShield — Master Execution Contract (H-series)

**v1.1 · 24 August 2026 · Houssain El Marouni**
Amended 24 Aug 2026 following two executor refusals at session open. See §13.
Authority: `heatshield-architecture-v2.md` (19 Aug 2026) + the Voltura Phase 1 remediation record (22–23 Aug 2026).
Location: repository root. **This file is the fence. A session without it on disk has no fence.**

---

## 0. How to read this

You are Claude Code executing against a written contract. This is not a task list. It is a set of gates you may not pass without evidence.

- Read this file in full before your first tool call. Every session. No exceptions.
- Work proceeds in blocks: H-∅, H-R, H0, H1, H1b, H1c, H2, H2b, H3, H4.
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
| G8 | Every gate has a rollback command, and the rollback is **executed** at the gate — not merely written down. A gate was once closed on four of five tasks because the rollback step was skipped. |
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
| C6 | Task 1.8 (multi-year irradiance mean) and H1.0 (`-999` guard) touch the same code path. | One task, one branch, one gate. Do not split them across blocks. |
| C7 | The Optimizer quotes its own priors (~5.5 for Tétouan where the site computed 5.01) — a P3 violation shipping today, addressed only at 4.7. | Note it in H1c's inventory as a known-open claim. Do not fix it early; it needs `simulate8760()` extracted (2.11) first. |

---

## 9. The blocks

Each block carries: fence (in and out of scope), precondition, tasks, failure modes, gate, rollback.

### H-∅ — Groundwork · first, and it is ten minutes

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

### H-R — Reconcile · blocking for the H-series, opens after H-∅

**Fence.** Read-only with respect to source, schema, configuration and dependencies. The block's own ruling file under `contracts/rulings/` is the sole permitted write — amended in v1.1; the original "no writes of any kind" contradicted §0 and §6. No DDL — and therefore, per G3, **no server boot**; `index.ts:23` calls `ensureChatTables()` before `listen()`. Use static inspection and the deployed Render URL, never a local listen.

**Tasks**

- **R.1** Diff `78c26d5..b9ce581`. List every architecture-v2 task the diff already satisfies.
- **R.2** For each of H0.1–0.10 and H1.1–1.9, mark: DONE / PARTIAL / OPEN — each with `file:line` or a live response as evidence.
- **R.3** Confirm the state of `phase1/block-r-replit`: what R1 deleted, what R2 holds.
- **R.4** Confirm `-999` is unguarded on the live API. Evidence: a request whose response shows the path is reachable.
- **R.5** Confirm which of the four `lib/cte` modules are imported by anything.

**Failure modes.** Assuming a task is done because it appears in a commit message. Booting the server and triggering DDL. Reporting "no issues found" without naming what was checked.

**Gate R.** A written reconciliation table for all twenty tasks, each with evidence. The contract's task lists are amended by this table before H0 opens.

**Rollback.** None needed. If any write landed outside `contracts/rulings/`, that is a fence breach: report it under §5.

### H0 — Stop the bleeding · week 1

**Fence.** In: 0.1–0.10, minus whatever Gate R marked DONE. Out: anything cosmetic, any refactor, any new feature. Branch: `heatshield/h0`.

| # | Task |
|---|---|
| 0.1 | Replace `useChat(1)` with a session-scoped conversation id |
| 0.2 | Authorize `GET`/`DELETE /api/conversations/:id` |
| 0.3 | Stop the orphan-row leak in `ChatInterface` |
| 0.4 | Scope `/history` to the requesting session |
| 0.5 | Delete the "Estimated ROI — 7.5 Years" card |
| 0.6 | Lock CORS to the known web origin |
| 0.7 | Rate-limit `/api/optimize` and chat |
| 0.8 | Apply the existing Zod schema on `/api/optimize` |
| 0.9 | Remove the silent geocode fallback — typed error, never lat 45 / lon 10 |
| 0.10 | Remove "Computation CO₂" — duration × 50 W × carbonIntensity floored at 1 mg is fabricated |

**Specific constraints.** 0.1–0.4 are live personal-data exposure on a public URL, and the intended buyer is governed by public-sector data-protection obligations. Treat them as the highest-priority items in the entire contract. 0.9 and 0.10 are the clearest P1/P2 violations currently shipping.

**Failure modes.** Fixing the type but not the render site (G7). Adding a rate limit whose fence you carried from a different route without checking — that error has been made. Replacing a silent fallback with a quieter fallback instead of an error.

**Gate H0.** Two browsers in different sessions cannot see each other's data — demonstrated live, two real sessions, response bodies shown. No displayed number is a constant — demonstrated by grep plus a rendered screenshot or DOM dump. Mutation evidence for each new test.

**Rollback.** `git revert -m 1 <merge>` — executed at the gate, output pasted, then re-applied.

### H1 — Truth · week 2

**Fence.** In: H1.0 plus 1.1–1.9. Out: `lib/emissions` (that is H1b), the claims takedown (H1c). Branch: `heatshield/h1`.

| # | Task |
|---|---|
| 1.0 | `-999` guard. NASA's fill value is finite and passes the current check. Reject it explicitly, as a typed error, not a substitution. Harvest the filter from `artifacts/greencalc/models/energy_model.py`. C1, C2. |
| 1.8 | Multi-year irradiance. 2022-only is not a climate normal. Move to a multi-year mean; state the period in the output and in the PDF. Same branch as 1.0 — C6. |
| 1.1 | Claims inventory across app, GreenCalc landing, LinkedIn, and any ENISA or Rising UP draft (scope check: Gate B0–B1a covered only NASA claims) |
| 1.3 | Delete `RATELIMIT_deploy.md`, `NASA_CACHE_deploy.md`, `POSTGRES_SWAP_deploy.md`, `VOLTURA_fix3b_fix6_patch.md` |
| 1.5 | Fix the substring match resolving "Indianapolis" to India |
| 1.6 | Correct the stale `ZONE_BY_PROVINCE_ALTITUDE` comment |
| 1.7 | GitHub Actions running the TypeScript suites on push |
| 1.9 | Remove `CARBON_INTENSITY_BY_COUNTRY` from `lib/db/src/schema/schema.ts` |
| 1.x | Salvage `artifacts/greencalc/static/lang/es.json` into the repo proper before H2 archives it. C2. |

**Specific constraints.** 1.0 must fail loudly on `-999`, never substitute. 1.8 must not hardcode the new period either — the year range is a parameter with a stated default, and the output states which period it used. 1.9: emissions constants do not belong in a schema package, and moving them is not the same as fixing them (that is H1b).

**Failure modes.** Guarding `-999` at one call site and not the others. Changing the year range but leaving `irradianceYear` hardcoded somewhere else. Salvaging `es.json` into a location nothing will find at H2b.

**Gate H1.** A live request against a location with a known missing month returns a typed error and no number. A live request against Fuengirola returns a multi-year figure with the period stated in the response and in the generated PDF. Mutation-tested: reintroduce `-999` acceptance, prove the test fails. Full suite green.

**Rollback.** `git revert -m 1 <merge>`, executed.

### H1b — lib/emissions · week 2

**Fence.** In: the module, its tests, its wiring. Out: the UI copy that quotes CO₂ — that is H1c. Branch: `heatshield/h1b`.

**Tasks.** Build to `lib/cte`'s standard.

- Store authority, edition, activity year, unit, GdO treatment, scope. Never a bare number.
- Seed: MITECO official workbook, revised 7 May 2026 — Mix sin GdO 0.283 kg CO₂e/kWh (activity year 2024), 0.258 (2025). Series back to 2007.
- Render as: `MITECO 2026-edition factor, activity year 2024: 0.283 kg CO₂e/kWh, Mix sin GdO`.
- Throw on unknown jurisdiction. No 400 default. No 0.4 default. G5.
- Country comes from the geocoder's structured response, never substring matching (see 1.5).
- Morocco: no national authority publishes a citable factor. Either label explicitly as non-Moroccan-authority data, or omit the market. Do not silently keep 0.543 or 638 g.
- The factor is a parameter, not a constant — the correct one depends on the accounting protocol a programme or contract specifies.

**Failure modes.** Replacing two wrong constants with one wrong constant. Keeping a fallback "for safety" — that is the defect class this whole contract exists to remove. Rendering the bare number without the provenance string (G7's cousin: provenance is part of the value).

**Gate H1b.** Every emissions figure in the codebase resolves through this module — proven by grep showing no other source. An unknown jurisdiction throws, demonstrated live. The rendered string carries authority and year. **Until this gate closes, quote no CO₂ figure publicly, anywhere.**

### H1c — Claims inventory · week 2

**Fence.** In: taking claims down. Out: writing new marketing. Branch: `heatshield/h1c`.

**Must come down** (architecture-v2 §7): the "8760-hour hour-by-hour" claim, "adjusted for your panel tilt and orientation", "1.5% annual inflation", "35+ countries", "EU AI Act — Fully compliant", the hardcoded ROI, "Typical Daily Usage Pattern", the chat prompt's compliance assertion, "Computation CO₂", any post-timeout location result, any Python test count, and any CO₂ factor until H1b closes.

**Language discipline — enforce in code and copy:**

| Never say | Say instead |
|---|---|
| "Summer is unregulated in Spain" | "Solar-control compliance is not the same as knowing whether a dwelling is dangerously hot for the person in it" |
| "HeatShield grade" / "habitability rating" | "Screening index, benchmarked to recognised methods" |
| "TM59-compliant" | "Benchmarked against CIBSE TM59" |
| "We calculate indoor temperature" | "We prioritise; assessment follows survey" |
| "38% of southern Spanish social housing overheats" | Nothing — that figure is [REPORTED] from an abstract |

**Specific constraint.** `qsol;jul` is a real obligation with real limits — 2.00 kWh/m²·month private residential, 4.00 other uses, for reforms renewing more than 25% of the thermal envelope. Anyone at AVRA knows this. Claiming summer is unregulated loses the room in one sentence.

**IP flag.** CIBSE TM52/TM59 numerical thresholds in the research came from secondary reproductions, not licensed documents. Citing TM59 as a technical reference is fine. Reproducing its pass/fail criteria inside a commercial product is a licensing question to resolve before it reaches code. Flag it at H4; do not code it now.

**Gate H1c.** Every row of the inventory is either removed from the deployed UI or has a code path proving it — checked against the live URL, not the local build. Grep for the P7 words returns nothing in code or rendered output.

### H2 — Consolidate · weeks 3–5

**Precondition.** Block R merged (C3). `es.json` and the greencalc `-999`/multi-year logic already salvaged in H1 (C2).

**Fence.** In: 2.1–2.13. Out: any new capability. Branch: `heatshield/h2`.

**Tasks.** Architecture-v2 §8, with these amendments:

- **2.3** is scoped to the unregistered `audio`/`image`/`batch` subpackages only. **G4 governs. Do not touch the Assistant.**
- **2.1** archives `artifacts/greencalc/` — only after C2's salvage is committed. Tag `greencalc-final` first.
- **2.11** — extract `simulate8760()` out of `routes/routes.ts` (568 lines: geocoder, NASA client, PDF generator, optimize handler, all in one file). H4.7 must call it from a grid search; it has to be a module first.
- **2.13** may already be satisfied by R1 — check before acting.

**On ML.** Synthetic-data models go; a model trained on `default_rng(42)` cannot be defended to a public buyer. What survives is the architecture: `ML_TRAINING_BOUNDS` and the boundary-violation guard, the model-card endpoint shape, the confidence-interval rendering path, the audit fields recording model version and fallback. Port those to TypeScript as scaffolding with no model behind them. When customer data arrives under contract, the harness is already built and already compliant.

**Failure modes.** Deleting the Assistant under a "replit" grep — the single most expensive available mistake. Deleting greencalc before the salvage lands. Extracting `simulate8760()` without a characterisation test proving identical output before and after.

**Gate H2.** Repository builds, full suite green, api-server still reports 36 tests including the 9 Assistant tests. `simulate8760()` produces byte-identical output from its new module, proven by a fixture comparison against pre-extraction output.

### H2b — Spanish · set up during H2, enforced from H3 commit one

**Fence.** In: i18n infrastructure, locale files, domain vocabulary. Out: translating screens that H3 has not built yet. Branch: `heatshield/h2b`.

Every screen, label, PDF, error message and system prompt in this repository is in English. The buyer is a Spanish regional administration. This is a procurement precondition, not polish — retrofitting i18n after the UI is built costs several times what building with it costs.

| # | Task |
|---|---|
| 2b.1 | i18n in place before H3 starts. Spanish is the default locale; English is the translation. |
| 2b.2 | Salvaged `es.json` strings loaded (from C2) |
| 2b.3 | Domain vocabulary from official usage — *pobreza energética*, *rehabilitación*, *parque de viviendas*, *viviendas difíciles de refrigerar*, *cribado*. Taken from the Andalusian heat-health plan and the CTE, not translated. |
| 2b.4 | Assessment and screening PDFs in Spanish, with Spanish number and date formatting |
| 2b.5 | Assistant system prompt in Spanish, if the Assistant survives into the HeatShield product |

**Gate H2b.** A new string added anywhere fails the build if it has no Spanish entry. Demonstrated by adding one and showing the failure.

### H3 — Layer 1 · weeks 5–10 · this is the product

**Precondition.** H2b closed. Spanish from commit one — not retrofitted.

**Fence.** In: 3.1–3.10. Out: `qsol;jul`, U-value checks, surveys, accounts — all H4. G11: no other track opens during H3.

| # | Task |
|---|---|
| 3.1 | PostGIS. Ingest Catastro INSPIRE municipal WFS — parcels, buildings, addresses |
| 3.2 | Derive façade orientation from geometry. Record as inferred, not sourced |
| 3.3 | Resolve CTE climate zone per building via `cte-zones` (province + altitude) |
| 3.4 | Join `solar-irradiation` July values by zone and derived orientation |
| 3.5 | Ingest INE Censo 2021 section-level indicators |
| 3.6 | Ingest IECA 250 m energy-efficiency grid as regional EPC prior |
| 3.7 | Define the index. Climate severity × orientation exposure × age-band envelope proxy × EPC prior × vulnerability proxy. Every weight documented and justified |
| 3.8 | Completeness model. Each building carries which inputs were present. Score renders with bands, never a bare number |
| 3.9 | Portfolio view — ranking, filtering, aggregate gap, export |
| 3.10 | Methodology document — inputs, weights, sources, limitations, what the index is not |

**Specific constraints.**

- Only `cte-zones` and `solar-irradiation` wire in here. `qsol-jul` and `cte-u-limits` need survey data that does not exist at portfolio scale — C5.
- **NOT AVAILABLE** from any public register, at any price: glazed area, frame fraction, glazing solar factor, shading devices, window operation, night ventilation, internal gains, indoor temperature. If a task seems to need one of these, it belongs in H4. Refuse.
- Uncertainty is a first-class output, not a footnote. Cadastral-only scores wide. EPC record narrows. Survey collapses to a computed `qsol;jul` in H4.
- **P7 is absolute here.** Never "grade", "rating", or "compliance result" — in code, in the UI, in the PDF, in the methodology document.
- 3.10 is not documentation-after-the-fact. It is the deliverable a public body evaluates. Write it alongside the code.
- Design the methodology so it can be swapped, not assumed permanent. A national technical rule could arrive and define this thing.

**Gate H3.** A municipality's building stock loads, ranks, and every score traces to its inputs and its uncertainty — demonstrated live on one named municipality, one named building, end to end.

### H4 — Layer 2 and governance · weeks 10–14

**Fence.** In: 4.1–4.9. Out: anything not in that list. Branch: `heatshield/h4`.

| # | Task |
|---|---|
| 4.1 | Survey input form — openings, areas, frame fraction, glazing factor, shading, floor area |
| 4.2 | Run `calculateQsolJul`. Surface `MissingIrradiationError` and siblings as real UI states — the refusal is the feature |
| 4.3 | U-value check via `cte-u-limits` |
| 4.4 | Assessment report PDF — inputs, computation, formula, citation, verdict, timestamp, data vintage |
| 4.5 | Verify the irradiation tables against the ministry PDF. Record when, by whom |
| 4.6 | `CONSTRUCTION_DEFAULTS` — fill, or require caller-supplied. Not a TODO |
| 4.7 | Rebuild the Optimizer under P3 — grid search over `simulate8760()` computes; the LLM explains only. Requires 2.11 |
| 4.8 | Governance layer — audit log, override record, feedback, token-gated audit endpoint, data-deletion path |
| 4.9 | Accounts and roles |

**Specific constraints.** 4.5 is the item a procurement process will actually test: *word geometry, two independent passes, 279 cells agreeing, nothing hand-typed* is specific and falsifiable, which is why it is credible. Verify it and it becomes the strongest sentence in the technical documentation. 4.7 closes the P3 violation flagged at C7. Resolve the TM59 licensing question (H1c) before any threshold reaches code.

**Gate H4.** A surveyed dwelling produces a computed `qsol;jul` against the correct limit, with a PDF carrying formula and citation — and a dwelling with missing inputs produces a refusal state in the UI, not a number.

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
