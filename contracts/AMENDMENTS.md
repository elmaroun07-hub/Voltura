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

---

## A12 · 2026-08-25 — Block R merged; rollback target moves

Merge ruling: `contracts/rulings/block-r-merge.md`. **CLOSED** (operator-approved).

`main` is now **`b7f4095`**. **The rollback target in §2 is superseded: `b7f4095`, not
`b9ce581`.** §2's table still reads `b9ce581`; fold this in when §2 is next revised.

**New residue, needs an operator eye or a small task:** `voltura-api` exposes no version
or build-sha endpoint, and Block R changed nothing observable in the API's runtime, so a
coding session cannot prove the API container redeployed. The web `build-sha` proves the
commit reached production; nothing proves the API did. A `/api/version` endpoint returning
the build sha would close this permanently and belongs with H4.8's governance work.

---

## A13 · 2026-08-25 — Rollback drills are production events (§14, G8)

**Operator ruling.** A revert executed on a branch that auto-deploys **is a deploy**.

G8's drill must either:

- run on a **non-deploying branch**, or
- be **declared in the ruling as two production deploys, with the window stated**.

**Never described as local.**

### Correction to the Block R merge ruling

`contracts/rulings/block-r-merge.md` said the revert was *"executed locally and not pushed
as three separate deploys."* Wrong, and corrected in place.

What actually happened, verified rather than recalled:

| | |
|---|---|
| `19bb459` merge, `41ae4b4` revert, `b7f4095` re-apply | **all on `origin/main`**, permanent production history |
| Push | one push, `b9ce581..b7f4095`, 13 commits, `2026-08-25T12:08:01Z` |
| Deploys | **one** — Render builds the branch head, not each commit |
| `voltura-web` `build-sha` | `b9ce581 → b7f4095` in a single step at `12:09:00Z`; no intermediate sha ever served |
| Did production serve the reverted state? | **No** — `41ae4b4` was never the tip on `origin` |

So the deploy count was one, not two. **That is an artefact of batching the push, not a
property of the drill**, and "local" was the wrong word for commits that are now permanent
production history.

**The substantive admission.** The drill tested **git mechanics**, not the **deploy path**.
A real rollback is a push that deploys. That was never exercised. `git revert -m 1` was
proven to target exactly Block R's 6,967 deletions and to leave `contracts/` standing —
real and worth having — but "the rollback works" in the sense that matters, a production
instance actually going back, remains **unproven**.

**Generalise:** the word "local" describes where a command ran, not where its effects land.
On a branch that auto-deploys, those are different places, and only the second one matters.

---

## A14 · 2026-08-26 — G4 narrowed to `chat/`; `audio/`, `image/`, `batch/` are deletable

**Operator ruling.** G4's delete exception was the whole subtree. It is now `chat/` only.

**Was:** never delete `artifacts/api-server/src/replit_integrations/`.
**Now:** never delete `artifacts/api-server/src/replit_integrations/chat/` — the shipped AI
Assistant (`MISTRAL_API_KEY`, Mistral base URL, `POST /api/conversations/:id/messages`).
`audio/`, `image/` and `batch/` are dead and **are** deletable.

**Evidence, re-verified 26 Aug 2026 rather than recalled:**

| Claim | Check |
|---|---|
| `registerAudioRoutes` / `registerImageRoutes` never imported | absent from `app.ts`, `index.ts`, `routes/index.ts`, `routes/routes.ts`; the only references are their own definitions and barrels |
| Never bundled | `AI_INTEGRATIONS`, `gpt-audio`, `gpt-image-1`, `gpt-4o-mini-transcribe` each appear **0 times** in `dist/index.mjs`; esbuild traces from `src/index.ts` |
| Deletion cannot break the Assistant | `chat/` imports only `express`, `openai`, `express-rate-limit`, `./storage`, `../../db`, `@workspace/db`, `drizzle-orm` — nothing from the three |
| Deletion moves no gate count | `chat/routes.test.ts` is the **only** test file in the subtree. `EXPECTED_API_TESTS=36` and `EXPECTED_ASSISTANT_TESTS=9` are unaffected |

**Consequence.** Architecture-v2 task 2.3 becomes permissible. Deleting `audio/` and
`image/` removes the OpenAI-fallthrough route permanently: both construct an `OpenAI` client
from `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`, and
`openai@6.35.0` fills an `undefined` argument from its own default parameters —
`OPENAI_API_KEY`, `OPENAI_BASE_URL`, then the literal `https://api.openai.com/v1`
(`client.js:71`, `client.js:142`). Wiring either module up with `AI_INTEGRATIONS_*` unset
would have silently routed to OpenAI with no code change and no log line. Deletion is the
only fix that cannot regress.

**`batch/`.** The ruling text names `audio/`, `image/` and `batch/` as deletable; the
consequence line names only `audio/` and `image/`. Recorded per the ruling text — all three
deletable. `batch/utils.ts` reads no environment variable and is imported by nothing outside
its own barrel, so it carries no fallthrough risk either way. Flagged for the operator in
case the omission was deliberate.

**Supersedes.** `contracts/rulings/block-r-gate-r3.md` rows 66–68 classify
`audio/client.ts`, `batch/utils.ts` and `image/client.ts` as **G4**. That ruling is closed
and is left standing as a record; those three rows no longer bind. `00-backfill-index.md:66`
("`replit_integrations/` excluded as shipped application code — now G4") reads the same way
and is likewise superseded, not rewritten.

**Mechanical guard narrowed with the rule.** `gate-check.sh` tested `[ -d "$PROTECTED_DIR" ]`
against the **parent**. While the whole subtree was protected that was a faithful proxy for
"nothing here was deleted". Once subdirectories are sanctioned deletion targets it stops
being one: deleting `chat/` and keeping `audio/` would have printed **PASS**. The hole
pre-dated this amendment but was unreachable, exactly the *latent, not live* shape C6
records for `-999` — and this amendment is what makes it reachable. `PROTECTED_DIR` now
points at `.../replit_integrations/chat`, which is strictly stronger and one line.

---

## A15 · 2026-08-26 — Session identity is unauthenticated (findings F1, F2)

**F-numbering starts here.** No F-register existed. Findings had been raised inside gate
rulings (`h-groundwork-gate.md:77`, "FINDINGS RAISED AT THIS GATE") and never carried
forward. They are numbered in this file rather than in a new one — a separate register is a
file the session-open read list does not include (§14.1).

### F1 · X-Session-Id is possession, not authentication — RULED

**Operator finding.** `X-Session-Id` is client-supplied, required, never defaulted, **never
verified**. H0 established there is no enumeration oracle: ids cannot be *discovered*. It did
not establish they cannot be *replayed*. **Possession of an id is possession of the session.**

**Severity:** low while there are no real users. **BLOCKING before any AVRA pilot carrying
occupant data.**

**Ruling:** out of scope for H1 — H1 is provenance, this is access control. Gated on **first
external user OR first real AVRA data, whichever comes first.** Recorded as **C8** in §8.

**Verified 26 Aug 2026, and wider than the citation.** The finding cites
`replit_integrations/chat/routes.ts:38-45`. The property holds at **three** live read sites,
all `req.get("x-session-id")` with no verification step:

| Site | Scope |
|---|---|
| `replit_integrations/chat/routes.ts:39` | Assistant — conversation list, read, create, delete, messages |
| `routes/routes.ts:444` | `POST /api/calculate` |
| `routes/routes.ts:638` | `GET /api/history` |

A fourth, `replit_integrations/audio/routes.ts:12`, is dead code and is deleted under A14.

**Three things that sharpen it.**

1. **The property is intentional and already documented at the call site.**
   `artifacts/green-energy-calculator/src/lib/queryClient.ts:14-16`: *"It is forgeable by
   design: it closes accidental cross-visitor exposure, it is not authorization."* F1 is not
   new information to the code. It is new information to the **contract**, which had no gate
   stopping an AVRA pilot from shipping on top of it. That is the gap C8 closes.
2. **Possession is permanent.** The id is `crypto.randomUUID()` — 122 bits of CSPRNG, so
   "cannot be discovered" is well-founded — persisted in `localStorage` under
   `voltura.sessionId`. There is no rotation, no expiry, no logout, and **no revocation
   path**. A leaked id is leaked for the lifetime of the row. Any XSS on the web origin is
   therefore full session takeover in one step, with no server-side means to invalidate.
3. **H0's own ruling contains a working demonstration, unremarked.**
   `h0-gate-h0.md` publishes two live session ids (`aaaa1111-…`, `bbbb2222-…`) and its
   RESIDUE section records that conversations **28** and **29** and two calculations were
   created on **production** and never cleaned up. Anyone with repository access can replay
   those headers and read or delete those rows. The content is probe data, so the harm is
   nil — but it is a concrete instance of F1 already on the record, and it means that
   residue is a **published-credential** residue, not merely an uncleaned-rows one. Not
   re-probed here: production is outside any open fence.

### F2 · The PDF route requires no session id at all — UNRULED, operator decision needed

**Raised by the executor while verifying F1. Not covered by F1's ruling, and it breaks the
premise F1's severity rests on.**

`GET /api/calculate/:id/pdf` (`routes/routes.ts:288`) reads **no session header**, applies
**no session filter**, and takes a **sequential integer**:

```
const id = parseInt(req.params.id);
const calc = await storage.getCalculationById(id);
```

`getCalculationById` is deliberately not session-scoped, and says so —
`storage.ts:17-20`: *"Its only caller is the PDF route, which is reached by `window.open`
and therefore cannot carry an `X-Session-Id` header at all."* The reasoning is recorded and
the exposure was accepted knowingly; what is missing is any gate that revisits it.

**Why this is not F1.** F1 says possession of an id is possession of the session. F2 needs
**no id**: `/api/calculate/1/pdf`, `/2/pdf`, `/3/pdf` walks every calculation ever made.
That **is** an enumeration oracle — over calculations rather than conversations. H0
Criterion 1 tested `/api/conversations/:id` and established byte-identical 404s there; it
never probed this route, and H0's OUT OF SCOPE section does not name it.

**Payload.** The PDF renders `calc.location`, annual energy usage, PV size, battery
capacity, tariff, panel orientation and roof angle (`routes.ts:313-320`) — a property-level
profile of a building. For AVRA occupant data that is the sensitive payload itself, not
metadata about it.

**Not mitigated by CORS.** `app.ts` restricts browser origins; CORS is not access control
and `curl` ignores it. The route carries no rate limiter either, so enumeration is
unthrottled — the limiters at `routes.ts:276` and `chat/routes.ts:58` do not cover it.

**Deliberately not ruled here.** F1's disposition — defer, gated on first external user or
first AVRA data — was made against replay. It may or may not be the right disposition for
an unauthenticated sequential-id document endpoint, and that is the operator's call. F2 is
recorded, gated with F1 under C8 as the conservative default, and flagged for a decision of
its own.
