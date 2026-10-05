# H-ASST-ACC — gate ruling

**Ruling:** **OPEN — L2 and L3 FAIL** after the operator's merge `dc2aa67`.
- L1 passes, Tier B is proven at the real merge, and the checker is clean on all 12 live
  transcripts. None of A0's FALSE claims (C9, C11, C13) recurs.
- But reading each transcript claim by claim finds **three new recurring misstatements**,
  E1–E3 (§After the merge). Under the operator's ruling that a single misstatement fails L2,
  the block does not close.
- The pre-merge gate was met (below, unchanged). The executor merged nothing and pushed
  nothing. Any fix needs a ruling.

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

## After the merge — §2, L1–L3, Tier B (5 Oct 2026, 03:13–03:18Z)

Recorded on `heatshield/asst-accuracy-live-evidence`, off `dc2aa67`. That branch is unmerged
and unpushed. The raw evidence is under `contracts/evidence/h-asst-accuracy/`, with sha256 at
the end of this section.

**§Merge, as the operator ran it, verified from git after `git fetch`.** The operator's
message gave the sha as a placeholder (`<new sha>`), so it was read from git:
- `main` == `origin/main` == **`dc2aa67`**: "Merge heatshield/asst-accuracy: H-ASST-ACC (the
  Assistant says only what the code backs)", parents `99385d1` + **`6a922a2`** (the block
  tip), 03:12:26Z.
- `99385d1` is "Merge heatshield/asst-d16-n3-live-evidence: …", parents `0192cd6` +
  **`6a8eca4`**, 03:12:25Z. Its tree is `248d6081…`, **identical to the dry run's** evidence
  merge, and it touches nothing under `artifacts/`.

**§2 — read from the Render API after the merge.**

| Service | `autoDeploy` | Trigger | Branch | Deploy for `dc2aa67` | Started | Live |
|---|---|---|---|---|---|---|
| Voltura-api | yes | commit | main | `dep-db1hbj0ae00c73fi0hog` | 03:13:16.991Z | **03:14:15.358Z** |
| Voltura-web | yes | commit | main | `dep-db1hbj8ae00c73fi0hu0` | 03:13:17.041Z | **03:13:49.213Z** |

- At the first reading the API deploy was `update_in_progress`. A poll on `/api/version` found
  `dc2aa67` at 03:14:23Z, and no L-check ran before that.
- The web went live 26.1 s before the API. No web code changed (the bundle is still
  `index-Be0JX2ta.js`), so the gap carries none of #7's risk. That is reasoned, not observed.

**L1 — PASS.**
- 03:14:31Z: `/api/version` →
  `{"sha":"dc2aa67","shaFull":"dc2aa6753af02771eebe5b3c7623a02452136c63","source":"render"}`.
- Web `<meta name="build-sha" content="dc2aa67" />`.
- **CI on `main`:** run `37258552049`, push, `dc2aa67`, **success**, 03:13:17–03:14:09Z.

**L2 — FAIL.** Eleven paid calls, each in a fresh conversation (**46–56**), session
`probe-asst-acc-2026-10-05-dc2aa67`, 03:14:46–03:16:00Z: "What is Voltura?" 3 + 5 times, then
feed-in, NPV and the EU AI Act. The raw SSE and the stored conversation are both saved.
- **Checker:** `[]` on all 11.
- **A0's FALSE claims:** none recurs. The Optimizer is "a standard daily usage profile"; no
  Spanish install cost; "calculations are refused" elsewhere.
- **The 23 Sept inventions:** none recurs.
- **Corrected details that did land:** the monthly chart's four series, "no charts" in the
  PDF, the UK having no sourced tariff, payback pending without a cost, 2019–2023, the 50–100 %
  default-90 % efficiency, and EUR/GBP.

**Read claim by claim against A.1, the misstatements:**

| # | Misstatement | Conversations | What the code does (A.1) |
|---|---|---|---|
| **E1** | "If NASA data are **missing**, it falls back to a latitude-based estimate" (or "estimates from latitude if NASA data are missing") | **46, 47, 48, 49, 50, 51, 52**, and L3's 57 | Missing data (fill value, missing months) gives **no result**, a typed 422 (`routes.ts:557`). The latitude estimate runs only when NASA gives **no usable answer** (`:374-380`, `:588`). Conversation 53's "if NASA data are unavailable" matches the page's own label ("NASA data unavailable") and is not counted |
| **E2** | history "stored **locally** in your browser" / "stored locally in the browser under an ID" | **46, 49, 53**, and 57 ("in your browser") | Calculations are stored **on the server** (`storage.createCalculation`); the browser keeps only the session id (`queryClient.ts:55-56`) |
| **E3** | the Optimizer "only provides the recommendation text, not a full calculation" / "not a numeric result unless you run a full calculation" / "explained, not a full calculation" | **49, 51, 52** | `/api/optimize` returns `optimalPv` and `optimalBattery` as **numbers** from `sizePvAndBattery` (`routes.ts`, the optimize handler). The model writes only `explanation` |
| P1 (PARTIAL) | the PDF contains "**all** inputs" | 49 | the summary prints eight inputs. The install cost is not among them; it appears only through the net row |
| P2 (PARTIAL) | UK: "using a user-provided tariff; no sourced UK tariff, so savings stay unpriced" | 51 | contradictory as written: a typed UK tariff **is** used, and only an untyped UK saving stays unpriced |

- **Clean:** conversations 54 (feed-in: "No… does not calculate feed-in tariffs"), 55 (NPV:
  "does not calculate a net-present-value"), 56 (AI Act: "Voltura makes no claim about
  compliance", B1's position), and 53 apart from E2.

**Why, stated against the executor's own wording.** All three trace to how the fact
sentences in `facts.ts` are phrased, not to a code defect:
- **E1:** the NASA fact puts "If NASA reports missing data…, there is no result" directly
  before "If NASA gives no usable answer…, Voltura estimates… from the latitude". The model
  fuses the two, and the page's own label ("NASA data unavailable") points the same way.
- **E2:** the history fact says "tied to an id stored in this browser" and never says where
  the calculations themselves are kept.
- **E3:** the Optimizer fact ends "the AI only writes the explanation", which the model reads
  as "the Optimizer only gives text".

The checker passed while the claim-by-claim read failed. That is A-e as the block wrote it:
the checker knows only errors already seen. Temperature 0.2 did not prevent any of the three.

**L3 — FAIL, on E1.** The built-in browser, Chromium 152.0.7977.130 (`Claude/2.19675.0`),
page `build-sha` `dc2aa67`. "What is Voltura?" was typed into the page under its own session
`3dd07f62-699c-49f5-a181-cd5a542356e6`, giving conversation **57** (03:17:16Z), read back
from the API.
- It repeats **E1** ("If NASA data are missing, it falls back to a latitude-based estimate")
  and **E2** ("Stores a history of past calculations in your browser").
- It says the Optimizer "does not perform the full simulation", which is true: sizing is a
  formula, not the 8760-hour run.

**Tier B at the real merge — proven,** on scratch ref
`scratch/asst-accuracy-real-merge-revert-proof` (worktree removed, nothing pushed):

```
git revert --no-edit -m 1 dc2aa67          # -> 0f40edf
tree 0f40edf = 248d6081a938668f54d5e79ba9624a61be88e139
tree 99385d1 = 248d6081a938668f54d5e79ba9624a61be88e139   # the evidence merge: identical
git diff --stat 99385d1 0f40edf            # (empty)
git diff --shortstat 99385d1 dc2aa67       # 12 files changed, 1145 insertions(+), 23 deletions(-)
```

The rollback is **`git revert -m 1 dc2aa67`**. It restores the pre-block prompt, which
carries the four wrong lines A.1 found, so it is not a remedy for E1–E3. **The deploy path is
UNPROVEN. A13's standing debt stands.**

**Left in production** (not deleted, G3):
- **Conversations:** **46–56** (session `probe-asst-acc-2026-10-05-dc2aa67`) and **57**
  (browser session `3dd07f62-…`).
- No calculation rows were written.
- **Conversation 45** exists between H-ASST-D16-N3's 44 and this block's 46. It was **not**
  written by this session.

**Options for the operator.** The executor does not pick one: these would be new code after a
merge.
- **(a)** A follow-up block that rewords the three fact sentences:
  - **nasa:** state the fallback condition first and separately, e.g. "Missing data … means
    no result; the latitude estimate is used only when NASA does not reply, replies with an
    error, or replies malformed".
  - **history:** "The calculations are stored on Voltura's server; this browser keeps only
    the id that links them".
  - **optimizer:** "returns a PV size and a battery capacity as numbers computed by a
    formula; the AI writes only the explanation".

  Add checker patterns for E1–E3 so they can't recur unseen, then re-run L2.
- **(b)** As (a), and narrow the L2 standard to the facts the operator rules material.
- **(c)** Revert with `git revert -m 1 dc2aa67`. Not recommended: the prompt it restores has
  four FALSE lines against these three paraphrase errors.

**Recommendation: (a).**

**Post-merge evidence** — `contracts/evidence/h-asst-accuracy/`, sha256 as stored:

| File | Bytes | sha256 |
|---|---|---|
| `l1-api-version.json` | 88 | `dcebaa67515870175198e994aae7e83cf1fd9291b18b820f83a198767636c2fc` |
| `l1-web-index.html` | 2,976 | `2c76d0029dea24eca98da7536bdec607d21c98b0334f7c0355dc15bda3c54fc0` |
| `l2-01-conversation.json` / `-sse.txt` (conv 46) | 2,484 / 12,501 | `f5f68ab95754af4fc3bdceb522b0620f55ddcd0d8246e70b460a51e36ef0b21a` / `8b5263e3f4d4ecf4df6cbc99a5469771431881974eaf3a384ddc43db5158534b` |
| `l2-02-…` (conv 47) | 2,856 / 14,501 | `b2479098ea91e69fbf5e40a5ee4d467bc1c74c07c4b8df05b48218af8cdfa698` / `90d3f75623096fb78ef3ad9aa34f483f74dec252e1c4154654089401a7f7f349` |
| `l2-03-…` (conv 48) | 2,446 / 11,979 | `83d6e99c7d5f0a5b2edaf5c5c00ed090a7a82c1e6cbe97165cb1c4adf937088e` / `86b954c97a2be3169cb01ee3f4c6d60e02977354551cacacb3b72ae65be720b8` |
| `l2-04-…` (conv 49) | 2,978 / 15,635 | `f3d7d35a373a3a251c0f16c59a033b111d203a85b3fc6afa1035595dfb6286a3` / `a3ccdbbedbb74eea13f3773cb26a4c87a90c14b67dba97666bee50e45b928deb` |
| `l2-05-…` (conv 50) | 2,465 / 12,372 | `9c505c1bd760869b279133193c2c26b1144c13fc6df37264e73b191bef35958b` / `5c0eb540fb84070173222fe64932b7486ee2c76cf81ab820b69d6e4f3fe81d25` |
| `l2-06-…` (conv 51) | 2,584 / 12,799 | `fd3b3ed9089027a5d29d82b81690c10b9b7085431ab7405b819f7385a7bc261d` / `8f9daa4371bf2557f8bea2d6f0d940695b0b2e287ce390a3ee616841c3a083ec` |
| `l2-07-…` (conv 52) | 3,014 / 16,111 | `d6d30fbf8a089dadd758bf41eca4e8a25dd7fdc264e507def9a9b5040d2fd65c` / `abc4b02a5be62fa45902493e9b7a2e49f947a99da4cdecff0f97003582c83818` |
| `l2-08-…` (conv 53) | 2,345 / 11,086 | `5cffb67813598d22081d45fa6b4e84829d9aeeaac4d436de1fd6a747e7090de8` / `a763a2af191b9c8a750caed062bb53e5a3fc1f8477eec001e3ffa5a6d4af6627` |
| `l2-09-…` (conv 54, feed-in) | 580 / 1,180 | `01157167e699f1fa438256153e3b3060d647c15fe78d80614455c97431d170ff` / `f8b51d9366d86193ea9c4ef8107ea273589cab6a75d9df2f33a2c675a4e387a2` |
| `l2-10-…` (conv 55, NPV) | 616 / 1,708 | `ba50a6b9beccc5ca381da731878f24e3ef7e87bed5f46a04c5ca3107ee9b81c0` / `7a93b7deb75b2cc5ac30ddebaa7bae916d489245259f172fb1da6abce3660b2e` |
| `l2-11-…` (conv 56, AI Act) | 418 / 366 | `51716864b5874970fe231e0da2ba32670574844634c0ec2a22b442ce5e370d5e` / `5bde16c965b05677502d038a4e0a4472b82af942feee517b1f3a4c2783fead8a` |
| `l3-conversation-57.json` | 2,586 | `3a4c13287e9ecc19a5e307c14090bc39326e92e308e7f7c005339beef3bb9845` |

## RESIDUE

- **E1–E3, P1–P2:** open, with options above, for the operator's ruling.
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

**After the merge: OPEN — L2 and L3 FAIL.**
- **What passed:** L1, and Tier B at the real merge. The checker is clean, A0's FALSE claims
  don't recur, and the B1 and feed-in/NPV answers are correct.
- **What failed:** three recurring misstatements, E1–E3, each traced to the wording of a fact
  sentence.
- **Next:** the operator rules on (a), (b) or (c) above. The deploy path is UNPROVEN; A13's
  standing debt stands.

**Pre-merge (kept as written at `6a922a2`): OPEN — pre-merge gate met.** Next: §Merge, run by the operator by hand with the commands
above. After it, the executor runs §2 from the Render API, then:
- **L1:** both services serve the merge sha.
- **L2:** 11 paid calls, fresh conversations under a probe session: "What is Voltura?" three
  times, plus the eight L2-A questions. Each transcript is annotated claim by claim against
  A.1. It passes only on zero misstatements, with PARTIAL counting as one, and with the
  checker clean.
- **L3:** one browser exchange.
- **Tier B** at the real merge.

The evidence goes on `heatshield/asst-accuracy-live-evidence`, unmerged.
