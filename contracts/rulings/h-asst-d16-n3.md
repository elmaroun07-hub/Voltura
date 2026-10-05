# H-ASST-D16-N3 — gate ruling

**Ruling:** CLOSED (self-ruled, §14.2) on L1–L3, after the operator's merge `0192cd6`. That
merge was run by hand in Git Bash on 5 Oct 2026 and pushed as `0f9f7a1..0192cd6`. The
post-merge record is in **§After the merge**, below.

**At the gate (pre-merge, `b61121d`):** CLOSED (self-ruled). Parts A, B and C met every
mechanical criterion: the tests, the G9 mutations, the §Merge dry run and G8 Tier B. Part B
ran under the operator's ruling (b) on refusal B.1, 5 Oct 2026. The pre-merge text below is
unchanged from `b61121d`, apart from this header and the sections added after it.

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

## After the merge — §2 and L1–L3 (5 Oct 2026, 02:33–02:37Z)

Recorded on `heatshield/asst-d16-n3-live-evidence`, off `0192cd6`. That branch is unmerged
and unpushed, and it rides the next code merge. The raw evidence is under
`contracts/evidence/h-asst-d16-n3/`, byte-exact, with sha256 at the end of this section.

**§Merge, as the operator ran it, verified from git after `git fetch`.**
- `main` == `origin/main` == `0192cd6`.
- `9f751ea` is "Merge heatshield/d8-d52-live-evidence: H-D8D52 gate evidence", parents
  `0f9f7a1` + **`109bc19`**, 02:31:13Z. It touches nothing under `artifacts/`.
- `0192cd6` is "Merge heatshield/asst-d16-n3: H-ASST-D16-N3 (Assistant, D16, N3)", parents
  `9f751ea` + **`b61121d`**, the block tip, 02:31:15Z.
- Both are `--no-ff` merges and carry the tips the gate ruled on. The tree of `9f751ea` is
  `b084f81a…`, the same as the dry run's evidence merge `6512c20`.

**§2 — read from the Render API after the merge,** not at merge time: the merge ran before
this session resumed.

| Service | `autoDeploy` | Trigger | Branch | Deploy for `0192cd6` | Started | Live |
|---|---|---|---|---|---|---|
| Voltura-api `srv-d8q8vumgvqtc73a1ik90` | yes | commit | main | `dep-db1go3g473hc73934ku0` | 02:31:42.821Z | **02:32:46.014Z** |
| Voltura-web `srv-d8pk09sm0tmc73avtk60` | yes | commit | main | `dep-db1go3g473hc73934l3g` | 02:31:42.882Z | **02:32:14.773Z** |

- One deploy per service, both on `0192cd6`, both started at 02:31:42Z as the operator said.
  The `0f9f7a1` deploys are now `deactivated`.
- **The web went live 31.2 s before the API.** This block changed no web code (the bundle is
  still `index-Be0JX2ta.js`) and no response shape, so the gap carries none of #7's risk this
  time. That conclusion is reasoned, not observed: no request was made in the gap.
- The poll found both services serving `0192cd6` at its first reading, 02:33:11Z, before any
  L-check.

| | Status | Probe rows / conversations |
|---|---|---|
| L1 | **PASS** | — |
| L2-A | **PASS** on the criterion. Paraphrase slips are recorded below | conversations **36–43** |
| L2-B | **PASS** | row **108** (Atlanta). Egypt and Singapore wrote none |
| L2-C | **PASS** | row **109** (€200,000); old rows 102 and 105 read, not written |
| L3 | **PASS**: built-in browser, as accepted for H-D8D52 | conversation **44**; row 109's PDF |

Session for L2: `probe-asst-d16-n3-2026-10-05-0192cd6`.

**L1.**
- 02:33:11Z: `/api/version` →
  `{"sha":"0192cd6","shaFull":"0192cd62400975e1a3cb08a1000f825a59120dce","source":"render"}`.
- The web page carries `<meta name="build-sha" content="0192cd6" />` and bundle
  `/assets/index-Be0JX2ta.js`.
- **CI on `main`:** run `37255756507` ("CI", push, `0192cd6`): completed, **success**,
  02:31:44Z–02:32:58Z.

**L2-A — eight paid calls, each in a fresh conversation, 02:33:29–02:33:48Z.** The raw SSE
stream and the stored conversation are both saved. Each was checked against TA1's
13-line map:

| # | Conv | Question | Result |
|---|---|---|---|
| 1–5 | 36–40 | "What is Voltura?" | **No feature absent from the map** in any of the five. No feed-in, export, NPV, compliance, or any other off-list product feature. Each describes Voltura from the list |
| 6 | 41 | "Does Voltura calculate feed-in tariffs?" | **"No. Voltura does not calculate feed‑in tariffs."** |
| 7 | 42 | "Does it give net present value?" | **"Voltura does not calculate a net‑present‑value (NPV) figure."** It names payback and the 25-year ROI curve instead |
| 8 | 43 | "Is Voltura EU AI Act compliant?" | "Voltura does not make any claim regarding compliance with the EU AI Act." That is B1's position unchanged: the prompt line "say Voltura makes no such claim" is the same as at B1, and `system-prompt.test.ts` still pins it |

**Paraphrase slips, recorded rather than ruled away.** None of them names a feature that
isn't on the list, so the criterion holds. But they are model restatements, and they are not
all accurate:
- Conversation 38 says "hourly‑averaged solar irradiance". The data is a multi-year
  **monthly** mean; the prompt says "monthly".
- Conversations 37, 39 and 40 say other countries get "a generic statement". That drops the
  legacy table: the prompt says "an older unsourced table for some other countries, and
  otherwise a plain statement that it has no figure".
- Conversation 37 says the monthly breakdown shows "battery‑supplied energy". The monthly
  chart shows generation, savings, grid import and "Surplus not used"; the battery share is
  in the annual mix.
- Conversations 36, 38, 39 and 44 attach "≈90 % round‑trip efficiency". That is the
  prompt's own sizing guideline and the input's default, not a fixed property.

None of this is A-a, A-b or A-c. Whether paraphrase accuracy should become a criterion is the
operator's call. It isn't one in this block.

**L2-B — D16 live,** 02:34:25–33Z. Same body each time, sent as UTF-8:
`energyUsage 4000, pvWattage 3000, batteryCapacity 5`.

| Location | Response | Factor and provenance |
|---|---|---|
| "Little Italy, Cairo, Egypt" | **422 `geocode_failed`** | `carbonSource: not_reached`. Never Italy's |
| "Atlanta, Georgia, United States" | **200**, row 108, `nasa-live` | **0.386**, `unsourced_legacy` "United States". Not Georgia's (Georgia has none) |
| "Little India, Singapore" (added by ruling (b)) | **400 `unknown_carbon_country`**, no row | `unknown_country`, attempted "Singapore". At `0f9f7a1` this gave India's 0.708 |

**L2-C — N3 live.**
- **New row 109.** 02:35:09Z: Fuengirola, 5,000 kWh, 4,000 W, 10 kWh, install 200,000.
  The response gives 3,860 kWh, €1,030.34, ROI computed, payback `null`, lifetime 30,975, and
  curve year 25 `{cumulativeSavings 30975, netPosition -169025}`. This matches live row 102
  and the local fixture.
- **Row 109's PDF** (200, 4,202 B, 2 pages): "Est. 25-Year Savings" **€30,975**, and "Est.
  25-Year Net (after install cost)" **-€169,025**, whose first code point is **0x2D**. There
  is no U+2212, and the only non-ASCII characters are WinAnsi (`á € °`). No line contains
  "Gain". Payback reads "not within 25 years".
- **Old row 102** (session `probe-pdf-2026-09-28-ff44a9c`, written 28 Sep at `ff44a9c`): the
  PDF (200, 4,108 B, 2 pages) prints the same **€30,975 / -€169,025**, computed at render
  time. `/api/history` shows its stored figures unmoved: cost 200,000, lifetime 30,975,
  payback `null`, annual 1,030.34.
- **No install cost: row 105** (session `probe-d8d52-2026-10-01-0f9f7a1`, cost `null`,
  lifetime `null`). The PDF (200, 4,116 B, 2 pages) has savings "pending" and **no net row**.
  No new row was written for this case.

**L3 — the built-in browser.** Claude desktop `Claude/2.19675.0`, **Chromium 152.0.7977.130**,
cold profile, page `build-sha` `0192cd6`.
1. **Assistant.** "What is Voltura?" was typed into the page and sent with Enter. Conversation
   **44** is under the browser's own session `3dd07f62-699c-49f5-a181-cd5a542356e6`, read back
   from the API at 02:36:07Z. The answer is on-list, with the same "generic table" and "≈ 90 %"
   slips as above.
2. **PDF from the €200,000 row.** The page's session was set to the L2 probe session. History
   listed rows 109 and 108, and row 109's PDF button (`button-pdf-109`) was clicked with the
   pointer.
   - The bytes `downloadCalculationPdf` handed to its `<a download>` were captured as ruled on
     30 Sept: `energy-report-109.pdf`, 4,202 B. The sha256 was computed in the page and again
     on disk, and both read `38c8fa1c…262b`.
   - The browser's own save was suppressed by the capture hook, and no file was written by
     the browser. The page's session id was restored afterwards.
   - The PDF prints **€30,975** and **-€169,025** (0x2D) on 2 pages.
   - It differs in bytes from L2-C's copy of row 109 (`8d82e5a8…`, same size) only because
     each render stamps its own `CreationDate` and `/ID`. The extracted text is identical.

Not covered live: the browser writing a file to disk, and the page's console. The first
pointer click failed because the pane wasn't drawing (a tooling state, not a page fault); the
retry clicked.

**Tier B at the real merge,** on scratch ref `scratch/asst-d16-n3-real-merge-revert-proof`
(worktree removed, nothing pushed):

```
git revert --no-edit -m 1 0192cd6          # -> 0040e95
tree 0040e95 = b084f81a16428481b8ed696f6acb87ca01f6cd33
tree 9f751ea = b084f81a16428481b8ed696f6acb87ca01f6cd33   # the evidence merge: identical
git diff --stat 9f751ea 0040e95            # (empty)
git diff --shortstat 9f751ea 0192cd6       # 19 files changed, 1159 insertions(+), 132 deletions(-)
git diff --shortstat 0f9f7a1 b61121d       # 19 files changed, 1159 insertions(+), 132 deletions(-)
```

The rollback is **`git revert -m 1 0192cd6`**. It takes back exactly the block's 19 files and
leaves H-D8D52's evidence merge standing. **The deploy path is UNPROVEN.** Every proof here
is git mechanics. No rollback deploy has been executed and no production instance has been
taken back. **A13's standing debt stands.**

**Probe rows and conversations left in production** (not deleted, G3):
- **Calculation rows:** **108** (Atlanta) and **109** (€200,000), both in session
  `probe-asst-d16-n3-2026-10-05-0192cd6`.
- **Conversations:** **36–43** (L2-A, the same session) and **44** (L3, session
  `3dd07f62-699c-49f5-a181-cd5a542356e6`).
- Publishing these session ids gives anyone with repository access those rows and
  conversations (F1). They hold probe data only.
- **Row 107** exists, between H-D8D52's 106 and this block's 108. It was **not** written by
  this session, and its owner is not known here.

**Post-merge evidence files** — `contracts/evidence/h-asst-d16-n3/`, sha256 of the bytes as
stored:

| File | What | Bytes | sha256 |
|---|---|---|---|
| `l1-api-version.json` | L1 API | 88 | `64004966633dc86c751d8430be4996e5b634d11eb6560d7f68c51e6da44c4fc0` |
| `l1-web-index.html` | L1 web | 2,976 | `f77694218bf993bf7f89d4256a57740931a42311136518ef53ebaa2bc2cd5d57` |
| `l2a-1-conversation.json` / `-sse.txt` | conv 36 | 2,044 / 9,615 | `65551ff085afe732ba993ffe83b45a1de721caffd62250b8079014fdce008584` / `fd30e5d1ae2cc59dd886d66fc0c940866e5d79ae643cdd77e57b1f0c3dd7c51e` |
| `l2a-2-…` | conv 37 | 1,841 / 8,466 | `db53ff43fd482881b9e9095cdc998ad7592878cbec7d5d43de296981feeead8d` / `aa5dc0ae6cff93cb3c242205b21f7ebb2ab360ca1e1662e8adb315066495a4c3` |
| `l2a-3-…` | conv 38 | 2,523 / 12,844 | `37e57a26d0835b61a24b78ab4c796bf8f1e17a0c90576b04e2e5f1dcfbc02ef8` / `0e3acbafafc96770434d6bd82174fdbe2fb995b9c50d288ebcc305a007b984b7` |
| `l2a-4-…` | conv 39 | 2,047 / 9,574 | `78ae5d5c88d2e8d21d6374eb4bdf6c4b653f743ad3ca4c091739a5c09b7a5ece` / `bb27a954d2639939f18ba56969ff4d512e6c2d705740a68f6398727c6cdb768d` |
| `l2a-5-…` | conv 40 | 1,904 / 9,277 | `85d445e33363fcc4a81ed46f0c770322cd019201237022634b8c7586e2ad12f9` / `e0624535546080d3605c160f6414e0b091be8d68ebb5eb02419b02a64fffd078` |
| `l2a-6-…` | conv 41, feed-in | 656 / 1,626 | `3f0cc3b1d428043953c74c91d513a5fe0a5ffccf786348657c9544b1ba85cb1f` / `f455b4a87ba2e3c6bb48f5bee80eea2d0e269e343b7552fdd24a870b2179f6d5` |
| `l2a-7-…` | conv 42, NPV | 805 / 2,663 | `28962756073ef3298d8411681a8542a6803203e1be1106fc4343fa742ae5e0f4` / `0e6aa4fe92e36405ea1a0fa03311dcc0986974f5a4950078ff8c5eb37b06b5fe` |
| `l2a-8-…` | conv 43, AI Act | 435 / 423 | `3870a29e7bad26852553ed8d97c535c7386cbd1e0d7afd9a9860fd98249dffa7` / `1bf0abca453bb8787f445621093eebfb468e22111e9e3a1e26ccb79f37aa10e6` |
| `l2b-1-calculate.json` | Egypt, 422 | 471 | `7fcd827cd18540bcb601fce1935dd1ef75bc55fd4fc3a179b5a9666915def151` |
| `l2b-2-calculate.json` | Atlanta, row 108 | 3,868 | `898ba9f94ef323959da217e36a08a7a0aa795b35d84e31382d7f4726341b5202` |
| `l2b-3-calculate.json` | Singapore, 400 | 657 | `642715e57c8a5c46168cd6758c387559998c9f35d18c6bb236b9c2b12c8c9f0d` |
| `l2c-1-calculate-200k.json` | row 109 | 6,060 | `92dd0295b3dbbff94baaa7770ef55d7f942b0bd448c4f38521c5cd88196e3191` |
| `l2c-1-pdf-109.pdf` / `.headers` | row 109's PDF | 4,202 / 471 | `8d82e5a8bfe923790f6a114b68e4b5a17a7b795f0a96fbd5f9d50cbdb09d6d9e` / `4e8d9738474d87bab4d99aa9b5efa464c57b677e13c35623cc819dd361da67d8` |
| `l2c-2-pdf-102.pdf` / `.headers` | old row 102's PDF | 4,108 / 471 | `551fb5ec01d42be6a3fa0c1f2ad4a8a9d91b63c064889ee1cc9a977500348db0` / `6632ef3d4e4532a91be569254b074a8e3de6c14b3ff23ef32c8edd5c7e60f4ca` |
| `l2c-3-pdf-105.pdf` / `.headers` | no-cost row 105's PDF | 4,116 / 471 | `1db20e13e2cdf8e8fccb5e9f964a7c379440c65f1b80a9799746284db56e3b21` / `628cd3629c29e5a620abd6e6b2c3fa9c9a57af60d820c7885b0d64a3ff71c6ca` |
| `l3-conversation-44.json` | L3 Assistant | 1,743 | `d501e21ecba833cbf61a26fea5ec9bdbff551d6c508df53aff66c3d8d99371a2` |
| `l3-history-blob-energy-report-109.pdf` | L3 download bytes | 4,202 | `38c8fa1ca1517573f6049921fdad26fab04c80845a5f41aca521bfea226a262b` |

## RESIDUE

- **Probe traffic.** Six Nominatim queries were sent from this machine on 5 Oct for B.1.
  Nothing was sent to production then. The post-merge probes are listed in §After the merge.
- **L2-A paraphrase slips** (§After the merge). They are not a criterion here, and flagged
  for the operator.
- **Unwired web locale.** `artifacts/green-energy-calculator/src/locales/en.json:27` still
  reads `"results_net_25yr": "25-Year Net Gain"`. It's imported by nothing, as its
  `README.md` says, so it's out of Part C's fence. It is a C-a hazard the day the locales are
  wired.
- **Carried, not touched:** D12, R1 #3, A4 #4, L-local #5, R2 #6, #7 deploy order, #8, #9 N4,
  and the `0.4` substitution.
- **Scratch ref** `scratch/asst-d16-n3-real-merge-revert-proof` (`0040e95`) is kept,
  unpushed.
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

**After the merge: CLOSED (self-ruled, §14.2) on L1–L3.**
- **The merge.** It was run by the operator as `0192cd6` (evidence `9f751ea`) and pushed
  `0f9f7a1..0192cd6`.
- **§2.** Read from the Render API: both services autoDeploy on `main`, and both serve
  `0192cd6`.
- **L1.** CI run `37255756507` succeeded.
- **L2-A.** Part A closes on eight live transcripts: no off-list feature, and "no" to feed-in
  tariffs and to NPV. B1's answer stands. Paraphrase slips are recorded.
- **L2-B.** No wrong-country factor: Egypt gets no figure, Atlanta gets the US factor, and
  Singapore now gets the 400 rather than India's 0.708.
- **L2-C.** The new row and old row 102 both print €30,975 and -€169,025 with an ASCII
  hyphen. The no-cost row has no net row. Stored figures are unmoved.
- **L3.** Passed in the built-in browser.
- **Tier B at the real merge:** `git revert -m 1 0192cd6` restores `9f751ea`'s tree. **The
  deploy path is UNPROVEN; A13's standing debt stands.**
- **Probe rows** 108 and 109 and **conversations** 36–44 stay in production.

`heatshield/asst-d16-n3-live-evidence` stays unmerged and unpushed. It rides the next code
merge.
