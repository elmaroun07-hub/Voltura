# H-ASST-D16-N3 — gate ruling

**Ruling:** CLOSED (self-ruled, §14.2) at the gate, before the merge. Parts A, B and C meet
every mechanical criterion: the tests, the G9 mutations, the §Merge dry run and G8 Tier B.
Part B ran under the operator's ruling (b) on refusal B.1, 5 Oct 2026.

**This ruling closes the gate, not the block.**
- §Merge is operator-ruled under §14.2, and nothing is merged or pushed. `main` is untouched.
- Part A closes only on L2-A's live transcripts (A-d).
- L1 to L3 run after the merge.

| | |
|---|---|
| BLOCK / GATE | H-ASST-D16-N3 / gate (self-ruled up to the merge, §14.2) |
| DATE | 5 Oct 2026. Every fact below was observed today unless dated otherwise |
| COMMIT (before) | `0f9f7a1`, the tip at block open |
| Branch | `heatshield/asst-d16-n3`, unpushed |

## Session open — precondition and §2, re-verified 5 Oct 2026

- **H-D8D52 is CLOSED.** `contracts/rulings/h-d8-d52.md` at `109bc19`, on
  `heatshield/d8-d52-live-evidence`. That branch is unmerged and rides this block's §Merge,
  step 1. The operator confirmed on 5 Oct that it is done and gets no additions.
- **Tip.** After `git fetch`, `main` == `origin/main` == `0f9f7a1`.
- **§2, read from the Render API** (`list_services` and `list_deploys`, workspace
  `tea-d7s87mv7f7vs73dg3eag`):

| Service | autoDeploy | Trigger | Branch | Live deploy | Commit |
|---|---|---|---|---|---|
| Voltura-api `srv-d8q8vumgvqtc73a1ik90` | yes | commit | main | `dep-dauq5j0473hc739v68n0`, finished 2026-10-01T00:02:24Z | `0f9f7a1` |
| Voltura-web `srv-d8pk09sm0tmc73avtk60` | yes | commit | main | `dep-dauq5j0473hc739v68tg`, finished 2026-10-01T00:01:50Z | `0f9f7a1` |

- **H-D8D52's Tier B, re-run** in a throwaway worktree off `0f9f7a1` (removed afterwards,
  nothing committed). The tree after `git revert -m 1 0f9f7a1` is
  `38ef72ed2aac7aaf859d4b7f9389fe836c8b2d8d`, the same as `5244e4b`'s tree.

## Commits

| Commit | What |
|---|---|
| `53dd625` | The block file, unmodified. sha256 `70394b40ed07e0595fb6f804de87e8d4fd128f8e086bf27b9501e268776b332a`, 10,996 B, checked against the operator's prompt before copying. The blob hash equals the file hash (LF only) |
| `9f6c2cd` | Part A |
| `813aad2` | Part C |
| `5f94d08` | This ruling (OPEN, at refusal B.1) and the B.1 evidence |
| `5fdbe09` | Part B, after ruling (b) |
| this commit | This ruling, gate CLOSED |

**DIFF SUMMARY** `0f9f7a1..5fdbe09`: 19 files, +1055 −132. Under `artifacts/` it's 10 files,
+620 −132. Code is five files:
- `replit_integrations/chat/routes.ts`: the prompt only.
- `routes/routes.ts`: the PDF money rows, and `geocode()` passing through `country_code`.
- `lib/carbon-intensity.ts`, `lib/emissions/carbon-source.ts`: the lookup.

The rest is tests, the block file, this ruling and the evidence.

**TEST EVIDENCE.** api-server goes **280 → 308** across 24 files:
- +17 for Part A (`feature-map.test.ts`);
- +5 for Part C;
- +9 for Part B (`d16-country.test.ts`);
- −3 net in `carbon-intensity.test.ts`, where 10 token-walk tests became 7 code tests.

`lib/cte` stays at 72/72. `pnpm -r typecheck` exits 0 before and after.

---

## Part A — the Assistant describes only what exists: DONE to the gate, closes live

**A.1 Read.** The prompt is `SYSTEM_PROMPT` in `replit_integrations/chat/routes.ts`, and the
server sends no other seed message. The web's empty-state copy in `ChatInterface.tsx:47,56-57`
("Ask about renewables, installation, or costs"; "Try asking: 'Is solar worth it in
Seattle?'") is never sent to the model and claims no feature. It is recorded here and left
unchanged.

**The feature list, built from code at `0f9f7a1`.** It has 13 lines, and each one maps to a
file and symbol in `feature-map.test.ts`:
- the Nominatim geocoder;
- the NASA POWER multi-year mean and the labelled latitude fallback;
- `simulate8760`;
- orientation and tilt;
- the monthly chart with "Surplus not used" (H-D8D52);
- the energy mix (H-D8D52);
- `resolveCarbonSource`;
- `resolveMoney`;
- `roi`;
- the PDF route;
- history;
- `sizePvAndBattery`;
- the Assistant itself.

The old context line also listed "CO2 factor" as a user input. It isn't one, so it was
dropped. Two lines needed wording choices, but none needed a judgement call on what exists:
- "Surplus not used" is described as unvalued, without the word "export", so A-c's check can
  stay a plain regex.
- The NASA period is written "several years", not 2019–2023, so the prompt can't go stale if
  the constants change.

**A.2 Tests:** `feature-map.test.ts`, 17 tests.

| Test | On the unmodified prompt | After |
|---|---|---|
| TA1: every listed feature is in the map | **fail** | pass |
| TA1: every map row is still listed | **fail** | pass |
| TA1: 13 rows, each symbol present in its file | pass (the code exists) | pass |
| TA2: the "say plainly that Voltura does not do it" rule, plus the A-b "describe it from this list" line | **fail** | pass |
| A-c: no feed-in, export, NPV, compliance | pass (a pin) | pass |
| TA3: B1's `system-prompt.test.ts`, unchanged | pass | pass |

**A-d: Part A is not closed.** It closes only on L2-A's live transcripts, after the merge.

## Part B — D16: DONE to the gate, under ruling (b)

### B.1 — reproduce first: §5 refusal, ruled (b) on 5 Oct 2026

```
REFUSAL — H-ASST-D16-N3.B.1
Instruction:   "If 'Little Italy, Cairo, Egypt' no longer gets Italy's factor, record that
               with evidence and drop Part B. Don't fix what doesn't reproduce."
Reality:       That string no longer reaches the lookup. Nominatim, queried today with the
               app's own query (b1-nominatim-1.json), returns [] for it, so the route answers
               422 geocode_failed before any carbon figure exists. But the defect is in the
               lookup, not the string, and it still reproduces:
               - lookupCarbonIntensity at 0f9f7a1, given geocodedCountry "Egypt" and that
                 string, returns 0.351 (Italy). It is labelled country "Egypt" in the
                 provenance (b1-lookup-at-0f9f7a1.jsonl).
               - Live today: "Little India, Singapore" geocodes to Singapore (country_code
                 "sg", b1-nominatim-5.json). Singapore is in neither table, the free-text walk
                 hits "india", and the result is 0.708 kg/kWh, India's factor, shown as
                 unsourced_legacy "Singapore".
               - The other three strings geocode to "United States" (country_code "us") and
                 get US 0.386 from the exact match. They are correct today.
Conflict:      The block's drop condition is met to the letter, but "don't fix what doesn't
               reproduce" doesn't hold. §5: the reading of the code wins.
Options:       (a) drop B and ticket it; (b) run B with "Little India, Singapore" added,
               keyed on Nominatim's country_code; (c) delete the walk only.
Recommendation: (b).
```

**Operator ruling, 5 Oct 2026: (b).**
- Run Part B with "Little India, Singapore" added to the probe strings.
- The country comes from Nominatim's ISO code, which the geocoder already receives. Passing
  it through is ruled IN.
- A code missing from the tables takes the existing no-figure path.
- The 0.4 behaviour stays unchanged.
- No response shape the web parses may change.

### B.2 — read

- **Before.** `geocode()` (`routes.ts:76` at `0f9f7a1`) returned `country`, Nominatim's
  English display name (`address.country`), and `regionCode` (`ISO3166-2-lvl4`).
  `resolveCarbonSource` tried the registry by that name, then
  `lookupCarbonIntensity(name, text)`: an exact name match first, then a whole-token walk
  over the name and the free text.
- **The no-figure path, end to end, unchanged.** `unknown_country`, then `/api/calculate`
  answers **400 `unknown_carbon_country`** with "We do not have a sourced carbon-intensity
  figure for "<attempted>". Try including the country, or a nearby major city." No row is
  written and there is no PDF. `attempted` is still the geocoded name, else the input.
- **The `0.4`.** The only `0.4` on these paths is the panel-efficiency floor
  (`routes.ts:72`, `Math.max(0.4, …)`). The carbon `0.4` became this typed 400 at
  H-SRC-ES (D15). Neither is touched.

### B.3 — tests first

`routes/d16-country.test.ts` runs `POST /api/calculate` on the raw Nominatim responses
recorded on 5 Oct, which are this block's evidence files, read as files. NASA answers 404,
so the route takes its labelled fallback; the carbon decision doesn't depend on irradiance.

| Case | Unmodified lookup | After |
|---|---|---|
| "Little Italy, Cairo, Egypt", as Nominatim answers today (`[]`) | 422 `geocode_failed`: pass | pass |
| the same string, geocoded to Egypt / `eg` (synthetic, labelled: the shape it had when D16 was found) | **fail**: 200 at Italy's 0.351 | 400 `unknown_carbon_country`, attempted "Egypt" |
| "Little India, Singapore" / `sg` | **fail**: 200 at India's 0.708 | 400 `unknown_carbon_country`, attempted "Singapore" |
| "Jordan, Minnesota, United States" / `us` | pass: US 0.386 | pass |
| "Lebanon, Pennsylvania, United States" / `us` | pass | pass |
| "Atlanta, Georgia, United States" / `us` | pass | pass |
| "Little Italy, Cairo" → Chicago / `us` (its display string names "Little Italy"; B-a) | pass | pass |
| unit: the code alone decides (empty name, "Estados Unidos", "España") | **fail** | pass |
| unit: a name with no code is the no-figure path ("Italy", "India", the D16 string) | **fail** | pass |

The three US strings and Chicago's "Little Italy" were already right at `0f9f7a1`. They pass
both ways and act as pins. The defect was only ever reachable for a country outside the
tables.

### B.4 — implemented

- `geocode()` also returns `countryCode: address.country_code ?? ""`, which it already
  received (ruled IN). It stays inside the server, so the resolution record, the response
  bodies and `shared-routes` are unchanged.
- `resolveCarbonSource(countryCode, geocodedCountry, locationInput, regionCode?)` keys on the
  code only, through `COUNTRY_KEY_BY_ISO`. That table maps codes to the existing keys of both
  tables: no value changes and no country added. The name and the input are labels in the
  existing states, and neither is parsed (B-a).
- `lookupCarbonIntensity(countryCode)` replaces `(name, text)`, and the token walk is
  deleted. A test pins that every legacy country, apart from the aliases `maroc`, `usa` and
  `us`, has a code, so no country silently lost its figure. Every registry key has one too.
- An empty or unmapped code is `unknown_country`: the existing path, unchanged.
- `carbon-intensity.test.ts`, `carbon-source.test.ts` and `shared-routes.test.ts` moved to
  the code-keyed signature with their intent kept. H1.5's Indianapolis case is now pinned on
  the code.

**What changes for a user, stated plainly.** A calculation for a place whose country is in
neither table now gets the 400 every time. Before, it sometimes got another country's factor
because the text happened to name a table country. A place Nominatim returns without a
`country_code` also gets the 400 rather than a guess. Of the 14 recorded responses, only
the hand-trimmed Thimphu fixture lacks one, and Bhutan has no figure either way.

## Part C — N3: DONE to the gate

**C.1 Read.**
- The money block is `routes.ts:900-934` at `0f9f7a1`.
- The curve is `roi()` (`countries.ts:425`). For `y = 0..25` it pushes the cumulative
  savings and `netPosition = round(cumulative − cost)`.
  `lifetimeSavings = curve[25].cumulativeSavings`.
- The install cost is persisted as `installationCostEur` exactly when the curve was computed
  from it (user cost or registry band, never a range; `routes.ts:1169-1176`). So
  `lifetimeSavingsEur` and `installationCostEur` are the pair the curve used.
- The web ROI card's labels already say "Net position (savings − cost)" for the true net, and
  it has no "Net Gain". It is out of fence and untouched.

**C.3 Implemented.**
- "Est. 25-Year Savings" (gross) is always shown, as "pending" when there's no ROI.
- "Est. 25-Year Net (after install cost)" equals `lifetimeSavingsEur − installationCostEur`.
  It's computed at render time and only when the cost is persisted. When the cost is known
  but the saving was never priced, it prints "pending".
- The minus is a literal ASCII `-`. It doesn't depend on ICU, which today also gives U+002D
  for en-GB EUR, GBP and plain numbers (checked).

| Test | Unmodified renderer | After |
|---|---|---|
| TC1 two rows; net only with a known cost; no "Gain" | **fail** | pass |
| TC2 net == the curve's year-25 `netPosition`, for costs 200,000 / 9,200 / 31,000 / 1 through `POST /api/calculate`; cost behind the net == the curve's | **fail** | pass |
| TC3 200,000 case: "€30,975" and "-€169,025", first code point 0x2D, no non-WinAnsi character in the text layer | **fail** | pass |
| TC4 cost null: savings row present, no net row (a net from 0 would print €30,975 twice) | **fail** (after making it non-vacuous; the first draft passed only because the old label differed) | pass |
| TC5 money pin: stored `savingsKwh` 3860, `annualSavingsEur` 1030.34, `installationCostEur`, `paybackYears` 8.4 / null, `lifetimeSavingsEur` 30975 / null, read at `0f9f7a1` | pass | pass |

The fixture reproduces live row 102's figures exactly: lifetime 30,975, year-25 net −169,025.

**Limit, stated rather than discovered later.** TC2 is exact for integer costs, and
`abs(float − integer)` keeps the fraction. Every registry-band cost is `Math.round`'d, and the
web form steps by 100.

A **fractional** user cost sent straight to the API (Zod allows one) can differ from the
curve's printed value by 1 unit. The reason is that the unrounded 25-year cumulative is never
stored, and keeping it would take a column, which needs a migration and is a §STOP.

Separately, a cumulative whose fraction is exactly .5 rounds differently for a negative net.
That isn't seen in practice.

## G9 — mutations, each caught and restored

The work was committed before any mutation. After each one, the file was restored and its
`git hash-object` matched the `HEAD` blob.

| # | Mutation | Caught by |
|---|---|---|
| MA1 | add "- Feed-in tariff calculations." to the prompt's list | TA1 (feature not in map), A-c: 2 failed |
| MA2a | delete the PDF row from the feature map | TA1: 1 failed |
| MA2b | remove the mapped symbol (`name: "From Battery"` → `"Battery"` in `ResultsDisplay.tsx`) | TA1 symbol row: 1 failed |
| MB1 | restore the free-text token walk, as a fallback after the code lookup | Egypt and Singapore route cases, the "name with no code" unit: 3 failed |
| MB2 | read the country from the display string (the key is the first table key found inside the geocoded name) | "the code alone decides" and "name with no code" units: 2 failed |
| MC1 | print `lifetimeSavings` as net | TC1, TC2, TC3: 3 failed |
| MC2 | treat a null cost as 0 (net row always, `lifetime − null`) | TC1, TC4, M1: 3 failed |
| MC3 | swap `-` for U+2212 | TC2, TC3, M3 (static WinAnsi scan): 3 failed |

## §Merge dry run — scratch ref `scratch/asst-d16-n3-merge-proof`, 5 Oct 2026

Run in a scratch worktree off `0f9f7a1` (since removed), as §Merge would run it:

| Step | Result |
|---|---|
| Evidence branch | `heatshield/d8-d52-live-evidence` at `109bc19` (confirmed by name and tip) |
| Block branch | `heatshield/asst-d16-n3` at `5fdbe09` |
| Overlap | none. The evidence branch touches only `contracts/evidence/h-d8-d52/**` and `contracts/rulings/h-d8-d52.md`, and no path is in both diffs |
| 1. `merge --no-ff heatshield/d8-d52-live-evidence` | clean, `6512c20` |
| 2. `merge --no-ff heatshield/asst-d16-n3` | clean, `762331a`, tree `eec6720e8be45ba760a8a35bfd730f73fcbb1a1a` |

This ruling's own commit comes after `5fdbe09` and touches only this file, which is on
neither side of the overlap. Pushed: nothing.

## ROLLBACK — G8, Tier B

Code ships to two production containers at the merge, and no drill is authorised: **Tier B**.

```
git revert --no-edit -m 1 762331a          # the scratch block merge -> c07d116
tree c07d116 = b084f81a16428481b8ed696f6acb87ca01f6cd33
tree 6512c20 = b084f81a16428481b8ed696f6acb87ca01f6cd33   # the evidence merge: identical
git diff --stat 6512c20 c07d116            # (empty)
git diff --shortstat c07d116 762331a       # 19 files changed, 1055 insertions(+), 132 deletions(-)
```

The revert takes back exactly this block's 19 files: the same count and line totals as
`0f9f7a1..5fdbe09`. It leaves the H-D8D52 evidence merge standing. At the real merge the
command is `git revert -m 1 <block merge sha>`, and it must be re-proven there.

**The deploy path is UNPROVEN.** Every proof in this section is git mechanics. No rollback
deploy has been executed and no production instance has been taken back. **A13's standing
debt stands.** It survives until one deploy-path rollback is executed deliberately under
Tier C, declared as production deploys with the window stated.

## Evidence — `contracts/evidence/h-asst-d16-n3/`, 5 Oct 2026 ~02:06Z

Byte-exact (`contracts/evidence/** -text`). Files 1–6 are also the fixtures of
`d16-country.test.ts`.

| File | What | sha256 |
|---|---|---|
| `b1-nominatim-1.json` | "Little Italy, Cairo, Egypt" → `[]` | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `b1-nominatim-2.json` | "Jordan, Minnesota, United States" → United States, `us`, `US-MN` | `69ec6cca2e844a9f48fd044b9f6517d711d868af7041ad7e99e4476c4496936c` |
| `b1-nominatim-3.json` | "Lebanon, Pennsylvania, United States" → United States, `us`, `US-PA` | `1b01fdeb45f0b52f83b83b0f76ef08226e3962de79daceb100918565a3a76ca7` |
| `b1-nominatim-4.json` | "Atlanta, Georgia, United States" → United States, `us`, `US-GA` | `da85c974d2a1bc8eb2ee8d156a66be4fe400f92d18825d9c77bfeba43677e79a` |
| `b1-nominatim-5.json` | "Little India, Singapore" → Singapore, `sg` | `fedee569d7ad12b46aee18829b68c44be57f3446d36b22171bbca04ce3cf4845` |
| `b1-nominatim-6.json` | "Little Italy, Cairo" → a kebab shop in Chicago, United States | `86ed74d5ee1440ce5c6aad8ee1e99cb7ddfdf6e388f90ea2981e19b5667698f4` |
| `b1-lookup-at-0f9f7a1.jsonl` | `resolveCarbonSource` at `0f9f7a1` on six (country, string) pairs | `8ad28e3a53a3b7ca23bb0d3eb61d6612176ddf07557a4c99648fdb4a67315952` |

## RESIDUE

- **Probe traffic.** Six Nominatim queries were sent from this machine on 5 Oct for B.1.
  Nothing was sent to production: no row and no conversation was written.
- **Unwired web locale.** `artifacts/green-energy-calculator/src/locales/en.json:27` still
  reads `"results_net_25yr": "25-Year Net Gain"`. It's imported by nothing, as its
  `README.md` says, so it's out of Part C's fence. It is a C-a hazard the day the locales are
  wired.
- **Carried, not touched:** D12, R1 #3, A4 #4, L-local #5, R2 #6, #7 deploy order, #8, #9 N4,
  and the `0.4` substitution.
- **Scratch ref** `scratch/asst-d16-n3-merge-proof` (`c07d116`) is kept, unpushed, as
  earlier blocks' proof refs were.
- **Clean tree.** After this commit, `git status --porcelain` is empty. The two scratch probe
  test files used for B.1 and TC5's pin values were deleted, not committed. The worktrees
  used for H-D8D52's Tier B re-run and for this block's dry run are removed.

## RULING

**CLOSED (self-ruled, §14.2)** at the gate.
- **A, B, C:** every new test failed first on unmodified code, except the pins (A-c, TA3,
  TC5, and B.3's four US cases, which were already right). All pass after.
- **Suite and typecheck:** 280 → 308, typecheck 0.
- **Mutations:** MA1, MA2, MB1, MB2, MC1, MC2 and MC3 are each caught and restored to the
  `HEAD` blob.
- **Merges:** both are clean in the dry run, with no overlap.
- **Tier B:** proven. **The deploy path is UNPROVEN; A13's standing debt stands.**

**Next: §Merge, operator-ruled.** It runs only on "merge authorised". Then §2 from the Render
API, and L1, L2-A (Part A closes here), L2-B, L2-C and L3, on
`heatshield/asst-d16-n3-live-evidence`.
