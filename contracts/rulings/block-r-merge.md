# Block R — Merge

**BLOCK / GATE** — Block R / merge to `main`
**DATE** — 2026-08-25
**COMMIT (before)** — `b9ce581`
**RULING AUTHORITY** — **operator**, per §14.2 (merge to `main`; block deletes files). Approved in writing this session.

**Auto-Deploy re-confirmation, per §2.** `voltura-api` On Commit, `voltura-web` **ON** — operator's word of 24 Aug 2026, restated at this merge and recorded here as §2 requires. The executor cannot observe a dashboard; the operator is the sensor.

---

## MERGE ORDER — and why

Operator-directed:

1. **Doc branches first** — `heatshield/h-groundwork` → `fa36e22`, `heatshield/h-r` → `7fd888b`, `heatshield/h0` → `72db6da`. All `--no-ff`. This puts the fence and the rulings on `main` where the next session finds them.
2. **Block R alone** — `19bb459`, `--no-ff`. *Alone so that `git revert -m 1` targets exactly 6,967 deletions and nothing else. A revert that has to disentangle doc commits is not a rollback.*

`heatshield/h0` was stacked on `h-r` after Gate R's ruling was written, so the three doc branches merged as three separate `--no-ff` commits rather than two.

## DIFF SUMMARY

The Block R merge commit **in isolation** (`19bb459^1..19bb459`):

```
21 files changed, 1 insertion(+), 6967 deletions(-)
```

Doc merges touched **no** source: `git diff --stat b9ce581..72db6da -- artifacts lib` → empty.

## ROLLBACK COMMAND — executed, per G8

```
git revert -m 1 19bb459a23d62dbe5da0cececb0a8ea2bc35ecd9
```

**Executed at the gate.** Output:

```
revert commit 41ae4b4
21 files changed, 6967 insertions(+), 1 deletion(-)

.replit restored?          yes
post-merge.sh restored?    yes
@replit back in workspace? 4 occurrences
```

**The isolation held.** `contracts/` survived the revert untouched — 5 ruling files still
present, `HEATSHIELD_CONTRACT.md` still at root. That is the property the merge ordering
was for: reverting Block R does not take the fence down with it.

**Re-applied:**

```
git revert --no-edit HEAD   →  b7f4095  Reapply "Merge phase1/block-r-replit…"

.replit gone again?    yes
@replit in workspace:  0
Assistant intact:      yes
```

Executed locally and not pushed as three separate deploys. Pushing revert-then-unrevert
would have produced two extra production deploys to demonstrate a property already proven
by the diff. The command, its target and its exact effect are all verified above.

## TEST EVIDENCE

Post-merge, on `main`:

```
pnpm install --frozen-lockfile   exit 0
pnpm typecheck                   exit 0
api-server suite                 4 files, 36 tests passed
  src/replit_integrations/chat/routes.test.ts   9 tests passed
```

**G4 satisfied locally:** 36 including the 9 Assistant tests.

## LIVE EVIDENCE

Pushed `b9ce581..b7f4095` at `2026-08-25T12:08:01Z`.

**`voltura-web` deployed** — `build-sha` served from `https://voltura-web.onrender.com`
went to **`b7f4095`** at `12:09:00Z`. That is proof the merge reached production.

**G4 post-merge, against the deployed API** (`https://voltura-api.onrender.com`):

```
POST /api/conversations        201  {"id":30,"title":"post-merge G4 probe",…}
GET  /api/conversations        200  [{"id":30,…}]
GET  /api/conversations/28     200  {"id":28,"title":"A private chat",…}
GET  /api/history              200  [{"id":58,"location":"Madrid, Spain",…}]
GET  /api/healthz              200  {"status":"ok"}

POST /api/calculate  →  savingsKwh 3702 | nasa-live | year 2022 | months 12
```

The Assistant creates, lists and reads conversations in production after a merge that
deleted 6,967 lines of Replit scaffolding. **G4 holds live, not just in the suite.**

### What this evidence does not establish

**I cannot prove `voltura-api` redeployed.** It exposes no version or build-sha endpoint,
and Block R changes nothing observable in the API's runtime — it deleted config, scaffolding
and dev-only build plugins. `healthz` returned 200 about 36 seconds after the push, which
is fast enough that it may well have been the previous instance still serving.

So the API evidence above proves *the Assistant and the calculation path are correct on
whatever is currently deployed*. It does not prove that instance is built from `b7f4095`.
The web `build-sha` proves the **commit** reached production; nothing available to a coding
session proves the **API container** did. Naming it rather than letting a 200 imply more
than it can.

## RESIDUE

- **API deploy not independently confirmed** — see above. An operator glance at the Render
  dashboard closes it; a `/api/version` endpoint would close it permanently.
- Production rows created by the H0 probe and this one: conversations `28`, `29`, `30`, and
  calculations under two probe session ids. Inert and session-scoped, but real. Not cleaned
  up — DML, forbidden by G3 without a fence granting it.
- Three branches now merged and stale: `heatshield/h-groundwork`, `heatshield/h-r`,
  `heatshield/h0`, `phase1/block-r-replit`. None deleted.
- `pnpm-workspace.yaml:101` — `lightningcss-win32-x64-msvc: '-'` still breaks
  `mockup-sandbox` builds on Windows. Backlog item 12, out of every fence so far.
- `0001-…patch`, `docs/` — untracked, never in scope.

## RULING

**CLOSED.** Operator-approved merge, executed in the directed order, rollback executed and
re-applied, G4 verified locally and live.

`main` is `b7f4095`. Rollback target for anything after this point is **`b7f4095`**, not
`b9ce581`.
