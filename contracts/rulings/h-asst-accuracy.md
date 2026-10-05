# H-ASST-ACC — gate ruling

**Ruling:** OPEN, at the pre-merge gate. Every pre-merge criterion is met: suite and
typecheck green, M1–M6 caught, A.1's claim table committed as evidence, §Merge dry run and
Tier B done. The block closes on live transcripts only (A-f), after **§Merge, which the
operator runs by hand**. The executor merged nothing and pushed nothing.

| | |
|---|---|
| BLOCK / GATE | H-ASST-ACC / pre-merge gate |
| DATE | 5 Oct 2026, observed today unless dated otherwise |
| COMMIT (before) | `0192cd6`, the tip at block open (`main` == `origin/main`, both services live on it) |
| Branch | `heatshield/asst-accuracy`, unpushed |
| Precondition | H-ASST-D16-N3's post-merge gate CLOSED at `6a8eca4` (`heatshield/asst-d16-n3-live-evidence`, unmerged) |

## Commits

| Commit | What |
|---|---|
| `947dd14` | The block file, unmodified. sha256 `31fbf87594929e8166d09a1117ceb2bdebdc4315a203057c444a58e595c1db06`, 11,153 B, checked before copying. The blob hash equals the operator's |
| `800962e` | A.1: the claim table, `contracts/evidence/h-asst-accuracy/a1-claims.md`, and the §5 refusal on TF4 |
| `5ae215c` | A.2: the tests, written before any implementation |
| `341d0d3` | A.3: the facts module, the prompt built from it, the TF2 rule, the temperature |
| this commit | This ruling |

**Operator rulings, 5 Oct 2026, on run 1:**
- Every line the Assistant states must be TRUE per A.1, with none FALSE and none PARTIAL.
- **TF4 (a):** correct the text of every key A.1 marked FALSE or PARTIAL to A.1's wording. File,
  symbol and test logic stay the same, B1's pin stays byte-unchanged, and TF4 is recorded as
  "logic unchanged".
- **C3:** no ticket, and A11 stands. The fact states the labelled latitude fallback truthfully.
- **L2:** passes only on zero misstatements, and a PARTIAL counts as one.

## A.1 — the claims against the code

The full table, with file:line for each claim, is
`contracts/evidence/h-asst-accuracy/a1-claims.md`. In summary:

| TRUE | PARTIAL | FALSE |
|---|---|---|
| C1, C2, **C3**, C4, C5, **C7**, C8 | C6 (90 % is a default the user sets), C10 (a typed tariff counts only for Spain and the UK; the UK has no national tariff), C12 (the PDF has no charts; history is per browser) | C9 (27 legacy countries, else the whole calculation is refused), C11 (Spain's install cost is `pending`), C13 (the Optimizer uses a fixed profile), K1, K2, K3 |

- **Where A.1 disagrees with the block's expectations.** The block's table expected C3 and C7
  to be SUSPECT. The code says TRUE for both:
  - **C3:** the latitude fallback is live, used only when NASA gives no usable answer, and
    labelled in the API and on the page.
  - **C7:** the chart's "Savings" series is consumption minus grid import, which is
    self-consumption.
- **A0** is operator-supplied. It matches none of conversations 36–44.

**Self-reported, against H-ASST-D16-N3.** A0's three FALSE claims trace to four lines of the
prompt this executor wrote at `9f6c2cd`: the no-figure case, the UK tariff, Spain's install
cost, and the Optimizer's "daily load pattern". Those lines were written from `money.ts`'s
code paths, not from the registry data, which is this block's failure mode A-a. Neither that
block's L2-A, whose criterion only checked that features were on the list, nor its ruling
caught them.

## A.2 / A.3 — tests, then the prompt

**Built.**
- `replit_integrations/chat/facts.ts` holds the 13 feature sentences as data.
  - Constants the code exports are imported: `ROI_YEARS`, `ROI_INFLATION`,
    `SIZING_DEFAULTS.coverageTarget`, and the legacy carbon countries via
    `COUNTRY_KEY_BY_ISO` and `CARBON_INTENSITY_BY_COUNTRY`.
  - The NASA request's resolution and period aren't exported from `routes.ts`. They are
    stated as `NASA_FACT` and pinned against the request the route actually sends.
- The prompt's list is this array, verbatim.
- **TF2 rule:** "Describe Voltura's features only with the facts in this list, and add no
  detail of your own about how Voltura works, what it shows or where it applies. If you do not
  know whether or how Voltura does something, say plainly that you do not know."
- **Guidelines corrected:**
  - "~90%" became "an input the user sets, from 50% to 100% (90% by default)".
  - "Use EUR" became "the country's own currency: EUR for Spain, GBP for the UK".
  - Sizing advice points to the Optimizer, and any reasoning of the model's own is labelled as
    general advice.
- **Temperature:** none was set before, so the provider default applied. It is now
  `CHAT_TEMPERATURE = 0.2` (at most the block's 0.3) and pinned.

**The eight lines rewritten** (the key text in `feature-map.test.ts`, ruling (a)):

| Line | Reason |
|---|---|
| nasa | C3 (ruled wording), K1 |
| monthly chart | K3 |
| carbon | C9, K2 |
| tariff | C10 |
| payback | C11 |
| pdf | C12 |
| history | C12 |
| optimizer | C13 |

The geocoder, simulation, orientation, energy-mix and assistant lines are TRUE per A.1 and
unchanged.

**Tests.**

| Test | At A.2 (`5ae215c`, unmodified prompt) | At A.3 |
|---|---|---|
| TF1 `facts.test.ts`, 24 tests: each pin asserts the code behaviour (through `POST /api/calculate` on `calculate.fixtures.json`, pure functions, or the web source that decides it) **and** that the sentence says it | fails at collection: no facts module | 24/24 |
| TF2 `prompt-rule.test.ts`, 5 tests: list == facts module in order; the rule; checker finds nothing in the prompt; `temperature` 0.2; the model sees only the system turn and the stored conversation | fails at collection | 5/5 |
| TF3 `transcript-checker.test.ts`, 8 tests: A0 hash-pinned (1,834 B, `6d3aa0ea…c0ee`); on A0 it flags **C9, C11, C13** (FALSE) and C6, C12 (PARTIAL); on the corrected rewrite it flags nothing; K1, K2, K3 and C10 are flagged on their verbatim live lines; no dead pattern | 8/8 (a test utility, prompt-independent; the prompt check lives in TF2) | 8/8 |
| TF4 `feature-map.test.ts` (**logic unchanged**), 17 tests | 2 failed: the corrected keys vs the old prompt | 17/17 |
| TF4 B1 `system-prompt.test.ts` (**byte-unchanged**, `git diff 0192cd6` empty) | pass | pass |

**Self-reported.** Two TF1 pins were wrong at A.2, and were fixed in the A.3 commit:
- The temperature pin used a uniform temperature, which the annual scaling cancels.
- The fallback-label pin compared against CRLF source text.

Neither fix weakened a pin. M1–M6 below were run after them.

**Suite 308 → 345** (+24 TF1, +5 TF2, +8 TF3) across 27 files, and `lib/cte` stays at 72/72.
`pnpm -r typecheck` exits 0.

## G9 — mutations, each caught and restored

The work was committed first (G13). After each mutation, the file was restored by
`git checkout` and `git hash-object` matched the `HEAD` blob.

| # | Mutation | Caught by |
|---|---|---|
| M1 | NASA `temporal/monthly` → `temporal/daily` in the route | TF1 nasa pin: 1 failed |
| M2 | Spain `installCost` made `current` (banded, 1,200 €/kW) in `countries.yaml` | TF1 payback pin: 1 failed |
| M3 | the legacy carbon path deleted in `resolveCarbonSource` | TF1 carbon and tariff pins (Tétouan's calculation then refuses): 2 failed |
| M4 | the TF2 rule deleted from the prompt | TF2: 1 failed |
| M5 | "Payback can also use sourced PV-only costs for Spain/UK." put back into the prompt | TF2's checker-on-prompt test (C11): 1 failed |
| M6 | the C13 checker pattern dropped (made to match nothing) | TF3 on A0, and the dead-pattern check: 2 failed |

## §Merge — dry run on `scratch/asst-accuracy-merge-proof`, 5 Oct 2026

Run in a scratch worktree off `0192cd6` (since removed). The block tip was `341d0d3`; this
ruling's commit adds only this file, which is on neither side of the overlap.

| Step | Result |
|---|---|
| Overlap of the two diffs from `0192cd6` | **none**. The evidence branch touches `contracts/evidence/h-asst-d16-n3/**` and `contracts/rulings/h-asst-d16-n3.md` only |
| 1. `merge --no-ff heatshield/asst-d16-n3-live-evidence` (`6a8eca4`) | clean, `a7588d0`, tree `248d6081a938668f54d5e79ba9624a61be88e139` |
| 2. `merge --no-ff heatshield/asst-accuracy` | clean, `26ea3c5`, tree `904c5b2f71e9fba07698195231b7a04b838f2a96` |

**For the operator, in Git Bash, as ruled on 5 Oct.** Pre-flight first:
`git fetch`; `main` == `origin/main` == `0192cd6`; a clean tree.

```
git switch main
git merge --no-ff heatshield/asst-d16-n3-live-evidence -m "Merge heatshield/asst-d16-n3-live-evidence: H-ASST-D16-N3 post-merge evidence"
git merge --no-ff heatshield/asst-accuracy -m "Merge heatshield/asst-accuracy: H-ASST-ACC (the Assistant says only what the code backs)"
git push origin main
```

One push gives one Render deploy per service. The executor then reads §2 from the Render
API, polls until both services serve the merge sha, and runs L1–L3.

## ROLLBACK — G8, Tier B

Code ships to the API container (the prompt and the temperature). No drill is authorised, so
this is **Tier B**.

```
git revert --no-edit -m 1 26ea3c5          # the scratch block merge -> bebb72f
tree bebb72f = 248d6081a938668f54d5e79ba9624a61be88e139
tree a7588d0 = 248d6081a938668f54d5e79ba9624a61be88e139   # the evidence merge: identical
git diff --stat a7588d0 bebb72f            # (empty)
git diff --shortstat a7588d0 26ea3c5       # 11 files changed, 948 insertions(+), 23 deletions(-)
git diff --shortstat 0192cd6 341d0d3       # 11 files changed, 948 insertions(+), 23 deletions(-)
```

The revert takes back exactly this block's 11 files and leaves the evidence merge standing.
At the real merge the command is `git revert -m 1 <block merge sha>`, to be re-proven there.

**The deploy path is UNPROVEN.** Every proof here is git mechanics. No rollback deploy has
been executed and no production instance has been taken back. **A13's standing debt
stands.**

## RESIDUE

- **The chart title.** The web monthly chart is titled "Monthly Generation vs Consumption"
  but draws no consumption series (`ResultsDisplay.tsx:128` vs `:56-59`). That's web code,
  OUT of fence, and recorded only. The Assistant's fact names the four series, not the title.
- **C3:** A11 stands, as ruled. No ticket.
- **Carried, not touched:** D12, R1 #3, A4 #4, L-local #5, R2 #6, #7, #8, #9 N4, the `0.4`
  substitution, and the unwired "25-Year Net Gain" locale string.
- **Scratch ref** `scratch/asst-accuracy-merge-proof` (`bebb72f`) is kept, unpushed.
- **Clean tree** after this commit. The scratch probe test files used to print the prompt
  and to try the checker were deleted, not committed.

## RULING

**OPEN — pre-merge gate met.** Next: §Merge, run by the operator by hand with the commands
above. After it, the executor runs §2 from the Render API, then:
- **L1:** both services serve the merge sha.
- **L2:** 11 paid calls, fresh conversations under a probe session: "What is Voltura?" three
  times, plus the eight L2-A questions. Each transcript is annotated claim by claim against
  A.1. It passes only on zero misstatements, with PARTIAL counting as one, and with the
  checker clean.
- **L3:** one browser exchange.
- **Tier B** at the real merge.

The evidence goes on `heatshield/asst-accuracy-live-evidence`, unmerged.
