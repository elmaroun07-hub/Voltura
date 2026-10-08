# H-ASST-ACC2 — gate ruling

**Ruling:** OPEN, at the pre-merge gate. Every pre-merge criterion is met:
- suite and typecheck green;
- M1–M5 caught;
- A.1's table and the list of 13 facts committed as evidence;
- §Merge dry run and Tier B done.

The block closes on live transcripts only (A-f), after **§Merge, which the operator runs by
hand**. The executor merged nothing and pushed nothing.

| | |
|---|---|
| BLOCK / GATE | H-ASST-ACC2 / pre-merge gate |
| DATE | 5 Oct 2026, observed today unless dated otherwise |
| COMMIT (before) | `dc2aa67`, the tip at block open (`main` == `origin/main`, both services live on it) |
| Branch | `heatshield/asst-accuracy-2`, unpushed |
| Precondition | H-ASST-ACC's post-merge record at `aba05a5` (`heatshield/asst-accuracy-live-evidence`, unmerged) |
| Ruled standard (5 Oct 2026, option (b)) | **Material = the 13 feature facts.** Misstating any of them fails L2, and a PARTIAL that renders one false counts. Errors outside them are recorded, not failed |

## Commits

| Commit | What |
|---|---|
| `189b4a6` | The block file, unmodified. sha256 `0fa625e1ff1c5621a65567c4bf0b28127dd038016de09d67ec51f30721a62a45`, 7,471 B, checked before copying. The blob hash equals the operator's |
| `5f0ae60` | A.1's evidence (`contracts/evidence/h-asst-acc2/a1-facts.md`), the fixtures, and the A.2 tests, written before any implementation |
| `ba09c7f` | A.3: the five sentences and the five checker patterns |
| this commit | This ruling |

## A.1

The full record, with file:line, is `contracts/evidence/h-asst-acc2/a1-facts.md`.

- **The 13 facts, by id:**
  `geocoder`, `nasa` (E1), `simulation`, `orientation`, `monthly-chart`, `energy-mix`,
  `carbon`, `tariff` (P2), `payback`, `pdf` (P1), `history` (E2), `optimizer` (E3),
  `assistant`. The battery-efficiency and currency lines are guidelines, not feature facts.
- **E1** `nasa`: the estimate runs only when `nasaData` is null (`routes.ts:586-590`). That
  covers an HTTP error, an unreadable body, a non-numeric value or no reply (`:374, 377, 380,
  324, 407`). A fill value or absent months give a 422 and no result (`:557`).
- **E2** `history`: rows are inserted on the server with their `sessionId` (`storage.ts:30`)
  and read back by it (`:49-53`). The browser keeps only `voltura.sessionId`
  (`queryClient.ts:3,53-56`).
- **E3** `optimizer`: `optimalPv` and `optimalBattery` come from `sizePvAndBattery`
  (`routes.ts:1257,1330-1331`). The model supplies only `explanation` (`:1332`).
- **P1** `pdf`: eight summary rows (`routes.ts:873-882`), with no installation cost.
- **P2** `tariff`: a typed tariff is used in a registry country (`money.ts:115`); the UK's own
  tariff is `pending` (`countries.yaml:122-123`).
- **The other eight facts:** no misstatement traced to them. They are unchanged, and no §5
  note was needed.

**Self-reported against H-ASST-ACC.** That ruling counted E2 at 4 conversations. It is in all
**nine** "What is Voltura?" answers (46–53 and 57). The verdict there (FAIL) stands; the
count was wrong.

**Interpretation, recorded.** TF7 reads "with only the feature-map key text of the five lines
changed". TF1's **text** assertions for the same five facts were updated as "their tests and
pins", which the fence puts IN. No **code** assertion in TF1 changed. TF2, TF3, the feature
map's logic and B1's pin are unchanged.

## A.2 / A.3

**Sentences.** The text of the five facts is in `a1-facts.md` and `facts.ts`. Each states its
fact on its own terms:
- **E1:** the estimate's trigger stands on its own, ahead of and apart from the no-data case,
  and the word "missing" is gone.
- **E2:** the server stores the calculations; the browser keeps the id; a new browser gets an
  empty history.
- **E3:** "returns … as numbers"; the AI writes only the explanation and cannot change them.
- **P1:** the seven inputs plus location are named, and "the installation cost is not
  printed".
- **P2:** "The UK has no national tariff in Voltura, so a UK saving is priced only when the
  user types a tariff."

**Checker.** `LIVE_SLIP_CLAIMS` holds E1, E2, E3, P1 and P2. `checkTranscript` checks it
together with H-ASST-ACC's `KNOWN_FALSE_CLAIMS`, which is unchanged so TF3's dead-pattern
test runs as written.

| Test | At A.2 (`5f0ae60`, unmodified prompt and checker) | At A.3 |
|---|---|---|
| TF5 `facts-acc2.test.ts`, 11 tests: E1 ×6 (estimate on HTTP 500, malformed, non-numeric, request-failed; a 422 and no estimate on fill and on absent months), E2, E3 (`/api/optimize` numbers = the formula's; the stub's prose), P1 (a real PDF of a row with a 9,287 install cost: eight labels, no "9,287"), P2 (London typed vs untyped) | **11 failed** | 11/11 |
| TF6 `transcript-checker-acc2.test.ts`, 25 tests: the 22 verbatim lines each flagged with their id; each id at least once; the 19 corrected rewrites flag nothing; A0 is still exactly C6, C9, C11, C12, C13 | **23 failed** (the two pins passed) | 25/25 |
| TF1 text assertions for the five facts | 5 failed | pass |
| Feature map (logic unchanged, five keys) | 2 failed | 17/17 |
| TF2, TF3, B1 `system-prompt.test.ts` (byte-unchanged since `0192cd6`) | pass | pass |

- **Fixtures:** `contracts/fixtures/h-asst-acc2/` (`-text`):
  - `failing-lines.json`: sha256 `ffbae2957387703681d40d948712830fbc29f22a106db1660f182a33ec509899`;
  - `corrected-lines.json`: sha256 `73421323997dbdd8262ab37b2020f219e818c3e5f8913c47b51e05dd8397b96d`.
- **Suite 345 → 381** (+11 TF5, +25 TF6) across 29 files. `lib/cte` stays at 72/72, and
  typecheck exits 0.
- **No test file changed in A.3:** `git diff 5f0ae60 ba09c7f -- '*.test.ts'` is empty.
- **Temperature** stays 0.2. No code behaviour changed (A-d).

## G9 — mutations, each caught and restored

The work was committed first (G13). After each mutation, the file was restored by
`git checkout` and `git hash-object` matched the `HEAD` blob.

| # | Mutation | Caught by |
|---|---|---|
| M1 | E1's old two sentences back in `facts.ts` | TF5 E1 ×3, TF1 nasa ×4, feature map ×2: 12 failed |
| M2 | E2's old sentence back | TF5 E2, TF1 history, feature map ×2: 4 failed |
| M3 | E3's old sentence back | TF5 E3, feature map ×2: 3 failed |
| M4 | **code:** absent months (`partial-coverage`) no longer fatal, so they fall through to the latitude estimate (`routes.ts:557`) | TF5 E1 "absent months: no estimate, no result": 1 failed |
| M5 | the new E2 checker pattern dropped (made to match nothing) | TF6: the nine E2 lines and "each at least once": 10 failed |

## §Merge — dry run on `scratch/asst-accuracy-2-merge-proof`, 5 Oct 2026

Run in a scratch worktree off `dc2aa67` (since removed), with the block at `ba09c7f`. This
ruling's commit adds only this file, which is on neither side of the overlap; the merges are
re-checked at the final tip after it.

| Step | Result |
|---|---|
| Overlap of the two diffs from `dc2aa67` | **none**. The evidence branch touches `contracts/evidence/h-asst-accuracy/**` and `contracts/rulings/h-asst-accuracy.md` only |
| 1. `merge --no-ff heatshield/asst-accuracy-live-evidence` (`aba05a5`) | clean, `7210a6c`, tree `13c720c8feab5130bf14c573f3bc99032f0fdfc4` |
| 2. `merge --no-ff heatshield/asst-accuracy-2` | clean, `6bb88b5` |

**For the operator, in Git Bash, as ruled on 5 Oct.** First the pre-flight. After `git fetch`
the expected tips are:
- `main` == `origin/main` == **`dc2aa67`**;
- `heatshield/asst-accuracy-live-evidence` == **`aba05a5`**;
- `heatshield/asst-accuracy-2` == **the commit carrying this ruling**, whose parent is
  `ba09c7f` (the executor reports its sha in chat);
- a clean tree.

```
git switch main
git merge --no-ff heatshield/asst-accuracy-live-evidence -m "Merge heatshield/asst-accuracy-live-evidence: H-ASST-ACC post-merge evidence"
git merge --no-ff heatshield/asst-accuracy-2 -m "Merge heatshield/asst-accuracy-2: H-ASST-ACC2 (reword the three facts the model misread)"
git push origin main
```

## ROLLBACK — G8, Tier B

Code ships to the API container: the prompt's five sentences. No drill is authorised, so this
is **Tier B**.

```
git revert --no-edit -m 1 6bb88b5          # the scratch block merge -> 657845b
tree 657845b = 13c720c8feab5130bf14c573f3bc99032f0fdfc4
tree 7210a6c = 13c720c8feab5130bf14c573f3bc99032f0fdfc4   # the evidence merge: identical
git diff --stat 7210a6c 657845b            # (empty)
git diff --shortstat 7210a6c 6bb88b5       # 10 files changed, 718 insertions(+), 18 deletions(-)
git diff --shortstat dc2aa67 ba09c7f       # 10 files changed, 718 insertions(+), 18 deletions(-)
```

The revert takes back exactly this block's files and leaves the evidence merge standing. At
the real merge the command is `git revert -m 1 <block merge sha>`, to be re-proven there.

**The deploy path is UNPROVEN.** Every proof here is git mechanics. No rollback deploy has
been executed and no production instance has been taken back. **A13's standing debt
stands.**

## RESIDUE

- **The checker still knows only errors already seen** (A-e). The live read, fact by fact, is
  the gate.
- **Carried from H-ASST-ACC:** the chart title (web, out of fence); A11 stands on C3.
- **Carried, not touched:** D12, R1 #3, A4 #4, L-local #5, R2 #6, #7, #8, #9 N4, the `0.4`
  substitution, and the unwired "25-Year Net Gain" locale string.
- **Scratch ref** `scratch/asst-accuracy-2-merge-proof` (`657845b`) is kept, unpushed.
- **Clean tree** after this commit.

## RULING

**OPEN — pre-merge gate met.** Next: §Merge, run by the operator by hand with the commands
above. After it, the executor reads §2 from the Render API and polls until both services
serve the merge sha. Then:
- **L1:** both services serve the merge sha.
- **L2:** 11 paid calls, fresh conversations under a new probe session: "What is Voltura?"
  three times, plus the eight L2-A questions. Each claim is annotated with the fact id it is
  judged against. It passes on zero misstatements of the 13 facts, with the checker clean.
  Errors outside the 13 facts are recorded.
- **L3:** one browser exchange, judged the same way.
- **Tier B** at the real merge.
- H-ASST-ACC's L2 and L3 are recorded as re-run under this block.

The evidence goes on `heatshield/asst-accuracy-2-live-evidence`, unmerged.

---

## L2 and L3 — run 7–8 Oct 2026, after the H2b merge `306c4ab`

Run in both languages under A25. **L2 FAIL** (Spanish 5 of 11 answers, English 6 of 11, misstate
the `nasa` or `carbon` fact); **L3 PASS** (conversations 95, 96). The record — transcripts by
conversation id, verbatim misstatements, checker result, the Groq rate-limit 500 — is in
`contracts/rulings/h2b.md`, "Post-merge — H2b complete". Tier B for this block's own merge
`9990fbe` is still owed.
