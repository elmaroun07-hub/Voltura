# H2-MAP — dependency map for archiving `artifacts/greencalc/`

**Status:** Phase 1 deliverable. Read-only investigation. Nothing in `main`'s tree was
modified — the removal simulation ran on a throwaway branch (`throwaway/h2-sim`, based on
`main` at `b1f2c99`), which has since been deleted. `main` was verified clean and at
`b1f2c99` after every step below.

**Does not decide the sequence.** This document maps; it does not act. The recommended
sequence in §8 is a proposal for Houssain's ruling, not an execution order.

---

## 0. Question zero — resolved

**`artifacts/greencalc/` and `artifacts/green-energy-calculator/` are two entirely
separate packages. They share no code, no build step, and no deploy path.**

| | `artifacts/greencalc/` | `artifacts/green-energy-calculator/` |
|---|---|---|
| Stack | Python 3.11, Flask, SQLAlchemy, scikit-learn | TypeScript, React 19, Vite |
| pnpm workspace member? | **No** — no `package.json`, not listed by `pnpm -r list --depth -1` | Yes — `@workspace/green-energy-calculator` |
| What Render builds | Nothing. No Dockerfile, no Procfile, no Render service of any kind | **This is the service.** `voltura-web`'s `buildCommand` targets it by name |
| Deployed anywhere | No | Yes — live at `voltura-web.onrender.com` |

Evidence:

```
$ ls artifacts/
api-server/  green-energy-calculator/  greencalc/  mockup-sandbox/

$ ls artifacts/greencalc/            # Flask app: app.py, config.py, requirements.txt, pytest.ini
$ ls artifacts/green-energy-calculator/   # Vite app: package.json, vite.config.ts, src/

$ pnpm -r list --depth -1
... @workspace/api-server ...
... @workspace/green-energy-calculator ...
... mockup-sandbox ...
... (no greencalc entry — it is not a pnpm package)

$ cat artifacts/green-energy-calculator/package.json | head -5
{ "name": "@workspace/green-energy-calculator", ... }
```

**This resolves cleanly, but the block brief handed to this session got it wrong in two
specific places (§7). Both are corrected below rather than carried forward.**

---

## 1. The workspace tree

```
pnpm-workspace.yaml packages: artifacts/*, lib/*, lib/integrations/*, scripts

$ pnpm -r list --depth -1
workspace@0.0.0                         (root, private)
@workspace/api-server@0.0.0             artifacts/api-server        — Render builds this (voltura-api)
@workspace/green-energy-calculator@0.0.0 artifacts/green-energy-calculator — Render builds this (voltura-web)
mockup-sandbox@0.0.0                    artifacts/mockup-sandbox    — built by nothing (CI excludes it, see §2)
@workspace/api-client-react@0.0.0       lib/api-client-react
@workspace/api-spec@0.0.0               lib/api-spec
@workspace/api-zod@0.0.0                lib/api-zod
@workspace/cte@0.0.0                    lib/cte
@workspace/db@0.0.0                     lib/db
@workspace/scripts@0.0.0                scripts
```

`artifacts/greencalc/` is not in this list. It is a fifth directory under `artifacts/`
that the pnpm workspace glob (`artifacts/*`) would match structurally, but it never
resolves as a package because it carries no `package.json`.

---

## 2. Dependency graph, plus every non-graph reference

### 2.1 Package graph

```
$ pnpm why @workspace/green-energy-calculator -r   → (no output: nothing depends on it, it's a leaf app)
$ pnpm why @workspace/api-server -r                 → (no output: nothing depends on it, it's a leaf app)
```

`green-energy-calculator`'s own dependency is `@workspace/api-client-react` (workspace
link). `api-server`'s own dependencies are `@workspace/api-zod` and `@workspace/db`.
Neither references `greencalc` or `green-energy-calculator` as a workspace dependency —
expected, since `greencalc` isn't a workspace member at all and can't be `workspace:*`
depended on.

### 2.2 Non-graph references (grep), classified

**Dynamic imports, tsconfig aliases, vite aliases:** none found.

```
$ git grep -n 'import(' -- '*.ts' '*.tsx' | grep -i greencalc   → 0 hits
$ grep -n paths artifacts/green-energy-calculator/tsconfig.json  → "@/*": ["./src/*"]  (no greencalc alias)
$ grep -n alias artifacts/green-energy-calculator/vite.config.ts → present, none reference greencalc
```

**CI (`.github/workflows/ci.yml`):**

```
line 7:   # artifacts/greencalc/ is not run here: H2 archives that application, and
line 132:  run: pnpm --filter @workspace/green-energy-calculator build
```
CI never builds or tests `greencalc` today. Its own comment already documents the
planned archival. `mockup-sandbox` is separately excluded from CI (native-binary build
failure, deploys nowhere) — see the comment at `ci.yml:124-127`.

**`gate-check.sh`:** one reference, and it *excludes* `greencalc` from a repo-wide grep
scan (`--exclude-dir=artifacts/greencalc`, line 150). No build step touches it.

**Dockerfiles:** none exist in the repo (`find . -iname "Dockerfile*"` → empty). Render's
config is dashboard-managed, not in-repo — confirmed no `render.yaml`/`render.yml`
anywhere in the tree.

**`contracts/`:** extensive references — `h2.md`, `AMENDMENTS.md`, `h1.md`, gate rulings,
`docs/VOLTURA-GROUND-TRUTH.md`, and the 2026-09-11 heatshield report all discuss
`greencalc` at length. These are planning/audit documents, not code — they reference the
directory but nothing in them executes it. Full list in the raw `git grep -in greencalc`
output (kept in this session's transcript, ~90 lines, spanning contracts, docs, and one
`.gitignore`-adjacent instance file).

**`shared-routes.ts`:** one comment (`api-server/src/shared-routes.ts:18`) noting it's
"mirrored in artifacts/green-energy-calculator/src/lib/api.ts" — this is about
`green-energy-calculator`, not `greencalc`. Not a hit on the target.

### 2.3 What this means

Zero executable references to `artifacts/greencalc/` exist outside `artifacts/greencalc/`
itself. Every reference found is either a planning document, a CI comment describing the
plan, or a grep-exclusion already written in anticipation of the archive. This is
confirmed, not assumed — by removal, in §3.

---

## 3. Removal simulation — verbatim

```
$ git switch main -q                     # b1f2c99, verified clean
$ git switch -c throwaway/h2-sim
$ git rm -r --quiet artifacts/greencalc  # 41 paths removed (40 tracked files + directory)
$ pnpm install
Scope: all 10 workspace projects
Already up to date. Done in 582ms.        # unaffected — greencalc was never in the lockfile

$ pnpm --filter @workspace/api-server build
$ node ./build.mjs
  dist\index.mjs   2.6mb   ...
Done in 776ms                             # EXIT 0

$ pnpm --filter @workspace/green-energy-calculator build
vite v7.3.2 building client environment for production...
✓ 3169 modules transformed.
dist/public/index.html                  3.00 kB
dist/public/assets/index-*.css         93.87 kB
dist/public/assets/index-*.js       1,073.53 kB
✓ built in 11.26s                         # EXIT 0

$ ls artifacts/green-energy-calculator/dist/public
assets/  favicon.png  favicon.svg  index.html  opengraph.jpg
                                            # publish dir exists, unaffected

$ pnpm -r test
lib/cte test:          Tests  72 passed (72)
artifacts/api-server test:  Tests  127 passed (127)
                                            # 199 passed, 199 passed — IDENTICAL to baseline
```

**Nothing failed.** No error text, no missing module, no broken import. The build and
test surface Render actually exercises (`api-server` build, `green-energy-calculator`
build, `pnpm -r test`) is completely unaffected by the removal.

Cleanup:
```
$ git switch main -q
$ git branch -D throwaway/h2-sim
```

**Operational near-miss during cleanup, recorded honestly because it is exactly the
"quiet loss" class this document exists to catch:** `git rm` on `throwaway/h2-sim` was
never committed. `git switch main` therefore carried the *uncommitted* working-tree
deletion across onto `main`, because git preserves uncommitted changes across a switch
when there's no conflict with the target branch. The throwaway branch was deleted before
this was noticed. `main`'s working tree briefly held an uncommitted, unstaged-for-push
deletion of all 40 `greencalc` files. Caught immediately by running `git status` next
(habit, not luck), fixed with `git restore --source=HEAD --staged --worktree --
artifacts/greencalc`, and reverified: `git status` clean, `git diff --stat HEAD` empty,
`git log -1` still `b1f2c99`, `git ls-files artifacts/greencalc | wc -l` → 40. **Nothing
was ever committed or pushed, so no production exposure — but the lesson is real: a
`git rm` simulation on a disposable branch must either be committed on that branch before
switching away, or `git status` must be checked clean on the target branch before the
disposable branch is deleted.** Future executions of this kind of simulation should
`git stash -u` before switching back, or use `git worktree add` for true isolation instead
of `git switch` on the same working copy.

---

## 4. Test delta

| Suite | Before | After | Delta |
|---|---|---|---|
| `pnpm -r test` (`lib/cte` + `api-server`, the only suites with a `test` script) | 199 (72 + 127) | 199 (72 + 127) | **0 — byte-identical test files, byte-identical pass counts** |
| `artifacts/greencalc` (pytest, Python — not part of `pnpm -r test`, not run by CI) | 192 test functions, most-recently verified 190 passed / 2 skipped (fresh DB) | 0 (directory deleted) | **-192, all deleted, classified below** |

**Classification of the 192 lost Python tests:** all 192 test Flask-specific code —
routes (`test_routes.py`), the ML pipeline (`test_ml_model.py`), and the energy model
(`test_energy_model.py`) inside `artifacts/greencalc/`. None of them exercise code that
survives the deletion under a different name:

- The `-999` fill-value filter and the 2019–2023 multi-year averaging shape *were*
  ported from `energy_model.py` to TypeScript in H1 (commit `e43b4cb`, "H1.0 + H1.8:
  guard -999 at the parse boundary, multi-year mean"), but the TS port has its **own**
  independent test coverage — `nasa-fillvalue-fixture.test.ts`, `calculate.test.ts`'s
  "A3.6" describe block, `optimize.test.ts`, `sizing.test.ts` — none of which are Python
  tests reused or translated; they are new tests against new TS code, already counted in
  the 127 `api-server` tests above and unaffected by this removal.
- The three locale files (`ar/en/es.json`) were copied byte-identical into
  `green-energy-calculator/src/locales/` in H1 (commit `88b7b0a` / `c261620`) — verified
  again this session with `diff`, all three pairs empty. They carry no tests either side.
- Everything else — the Flask routes, the SQLite persistence layer, the scikit-learn
  model wrapper, the ReportLab PDF export, the GDPR consent/delete-my-data flow, the
  audit-trail table, the model-card endpoint — has no TypeScript equivalent today (see
  §5 on what H2 has *not* yet ported) and is deleted along with its tests. No dropped
  test here is silently losing coverage of surviving behavior; it is losing coverage of
  behavior that stops existing at the same moment.

**No silent loss.** 199/199 on the suite that Render's build and any future CI gate
actually run. -192 on a suite CI has never run and that (per its own header comment) it
already treats as scheduled for archival.

---

## 5. The eight behaviours — corrected against evidence, not assumed

The brief for this block asserted that items 3 and 5 below "are the Article 50 surface"
and that deleting `greencalc` "deletes them." **That claim is false, and it is corrected
here rather than carried forward** — see §7.

| # | Behaviour | How checked | Result after simulated removal |
|---|---|---|---|
| 1 | `voltura-web` serves at its URL | Static build succeeds, `dist/public` exists | **survives** — build succeeded, `dist/public/index.html` present |
| 2 | Optimizer page renders | Route loads | **survives** — `/optimizer` route is in `green-energy-calculator/src/App.tsx`, untouched |
| 3 | "The assistant explains the result; it does not choose it." still appears | String present in built output | **survives, and was never at risk** — this string lives at `green-energy-calculator/src/pages/Optimizer.tsx:52`, the live deployed app, not in `greencalc` at all |
| 4 | Run AI Optimization returns a result with its provenance block | Live call | **survives** — `api-server`'s 127 tests including `optimize.test.ts` (16 tests) pass unchanged; the provenance chain (`routes.ts:587-598`) is entirely TS, no `greencalc` dependency |
| 5 | Energy Assistant page renders | Route loads | **survives, and was never at risk** — `/assistant` is a `green-energy-calculator` route backed by `api-server/src/replit_integrations/chat/`; both are untouched by removing `greencalc` |
| 6 | The calculator computes from real NASA values | The NASA suite passes untouched | **survives** — `calculate.test.ts`, `optimize.test.ts`, `nasa-fillvalue-fixture.test.ts` all pass, 0 delta |
| 7 | The `-999` guard still executes | Its test passes | **survives** — `nasa-fillvalue-fixture.test.ts` and the `A3.6` block in `calculate.test.ts` pass unchanged; this is the TS port, independent of `greencalc`'s own copy |
| 8 | The API starts from its own build | `pnpm --filter @workspace/api-server build` then start | **survives** — build succeeded (`dist/index.mjs`, exit 0); start command was not separately exercised this session (no live start/smoke test was run — see "not sure about" in §9) |

**Net: eight for eight survive the simulated removal.** Not because the removal is safe
in every sense (see §6), but because none of these eight *live, deployed* behaviours were
ever routed through `artifacts/greencalc/`.

---

## 6. What actually breaks, and what doesn't

**Nothing in the deployed product breaks.** Confirmed by simulation, not by reading.

**What is genuinely lost, and matters for a different reason:** `artifacts/greencalc/`
is the only place in the repository holding a *working, if undeployed,* implementation
of the Article 50/10/14/73 compliance surface — labelled AI output with a stated
confidence interval, a model-card endpoint, a consent/delete-my-data flow, an audit
table recording model version and fallback, and disclaimer copy. `contracts/blocks/h2.md`
itself says the *architecture* of this (not the working code) should be ported to
TypeScript as scaffolding before archival — `ML_TRAINING_BOUNDS`, the boundary guard, the
model-card endpoint shape, the audit fields. This session confirmed that port **has not
happened**: `git grep -in "ML_TRAINING_BOUNDS"` and `git grep -in "model.card"` against
`*.ts`/`*.tsx` both return zero hits.

This is not a "does the site still work" risk — it doesn't touch any of the eight
behaviours above, because the deployed product currently has **no** Article 50 surface
of its own (confirmed independently by the 2026-09-11 report, `docs/reports/voltura-
heatshield-2026-09-11.md:481`: the served HTML has no disclaimer, no AI-disclosure text,
no consent, no model card). It is a *reference-implementation* risk: archiving `greencalc`
without first porting its compliance architecture removes the one artifact anyone would
build that port from. `h2.md`'s own gate does not require the port to happen before 2.1
— it only requires the H1 salvage (locale + `-999`/multi-year logic, both done) before
2.1, and separately asks for the architecture port as "on ML" guidance without gating
archival on it. Whether that's the right ordering is not this document's call — it's
flagged in §8 as a question for the ruling.

---

## 7. Corrections to the block brief handed to this session

Two claims in the instructions for this block do not hold against the repository as it
exists today. Recording them here rather than silently working around them, per this
block's own "trusting grep… is not sufficient" standard — these weren't grep misses,
they were unverified assertions in the brief itself.

1. **"Items 3 and 5 are the Article 50 surface... deleting the package deletes them."**
   False. Both live in `artifacts/green-energy-calculator/` (the deployed app), not
   `artifacts/greencalc/`. Deleting `greencalc` does not touch either. See §5.

2. **"gate-check.sh (its §9 builds mockup-sandbox)."** `gate-check.sh` has no numbered
   sections and no reference to `mockup-sandbox` anywhere (`grep -in sandbox
   gate-check.sh` → 0 hits). `mockup-sandbox` is excluded from CI, not built by
   `gate-check.sh` — see `.github/workflows/ci.yml:124-127`.

3. **§5 of the block brief ("the gap that isn't in the repo") assumes Render's
   `buildCommand`/`publishPath` need repointing after this deletion, and proposes a
   three-step cutover (stand up a replacement package, repoint Render, then delete).**
   This does not apply here. Render already points at `green-energy-calculator`, which
   `greencalc`'s removal does not touch in any way — confirmed by the build/test
   simulation in §3. **No Render field changes old → new for this deletion. Both fields
   stay exactly as given in this block's own preamble.** The three-step cutover shape
   would be the right method if `greencalc` were what Render deployed — it isn't, so it
   doesn't apply. This is Question Zero's answer working all the way through: the entire
   danger this block was built to guard against (a Render config pointing at a deleted
   package) cannot occur from this specific deletion.

---

## 8. Recommended sequence — for the ruling, not self-executed

Given the above, the correct shape is simpler than the block brief assumed, but one
precondition genuinely is not yet met:

1. **Port the Article 50 architecture scaffolding** (`ML_TRAINING_BOUNDS`, boundary
   guard, model-card endpoint shape, audit fields — `h2.md`'s "On ML" section) into
   TypeScript, even as inert scaffolding with no model behind it. This is the one thing
   `greencalc`'s deletion would make impossible to recover without `git log` archaeology.
   Not gated by `h2.md` today, but doing it first costs nothing and removes the only real
   objection to archiving.
2. **Tag `greencalc-final`** at the pre-deletion commit, per `h2.md:13`'s own instruction
   — this is the actual "archive, not delete" mechanism: the code is fully recoverable
   from the tag forever, and history is preserved regardless.
3. **Delete `artifacts/greencalc/`** on a real (non-throwaway) branch, gated the same way
   every other block in this repo is gated: branch off `main`, PR, `gate-check.sh` +
   full suite green, `--no-ff` merge. No Render change is required as part of this step —
   confirmed in §3 and §7.
4. **No cutover, no staged rollout, no "both build side by side" step is needed**,
   because `green-energy-calculator` was never affected in the first place. The three-
   step cutover in the block brief's §5 does not apply to this deletion.

**What I am not sure about, stated plainly:**

- Whether step 1 (the architecture port) is a hard precondition in Houssain's judgment or
  a nice-to-have — `h2.md` itself does not gate 2.1 on it, only on the H1 salvage (done).
  This document surfaces the gap; it does not resolve whether it blocks.
- The API *start* command (`node --enable-source-maps artifacts/api-server/dist/index.mjs`)
  was not exercised live this session — only `pnpm --filter @workspace/api-server build`
  was run and verified to exit 0 with `dist/index.mjs` present. Item 8 in §5 is marked
  "survives" on build evidence, not a live start.
- `h2.md:21`'s gate line says "api-server still reports 36 tests including the 9
  Assistant tests" — the suite reports **127** tests today (9 of them the Assistant's),
  not 36. This is very likely a stale number left over from when `h2.md` was written
  (the suite has grown since — `optimize.test.ts`, `calculate.test.ts`,
  `pdf-session-scope.test.ts` etc. did not exist yet), not a discrepancy this removal
  caused. Flagging it because an out-of-date gate number is the same defect class as
  everything else this file is built to catch.
- This document did not attempt task 2.11 (extracting `simulate8760()`) or 2.3 (the
  `audio`/`image`/`batch` subpackage scoping) — both in-scope for H2 per its block file,
  out of scope for this map, which was asked only to resolve the `greencalc` question.

**Sequence NOT recommended:** deleting `greencalc` today without tagging
`greencalc-final` first, or treating this map as authorization to proceed — it is not.
Houssain rules the sequence after reading this.
