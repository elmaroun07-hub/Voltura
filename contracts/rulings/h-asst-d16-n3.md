# H-ASST-D16-N3 — gate ruling

**Ruling:** OPEN. Parts A and C are done to the gate's mechanical criteria. **Part B is held
on a §5 refusal (below)**: the block's drop condition is met while the defect it tests
still reproduces. Nothing is merged and nothing is pushed. `main` is untouched.

| | |
|---|---|
| BLOCK / GATE | H-ASST-D16-N3 / gate (self-ruled up to the merge, §14.2) |
| DATE | 5 Oct 2026. Every fact below was observed today unless dated otherwise |
| COMMIT (before) | `0f9f7a1`, the tip at block open |
| Branch | `heatshield/asst-d16-n3`, unpushed |

## Session open — precondition and §2, re-verified 5 Oct 2026

- **H-D8D52 is CLOSED.** `contracts/rulings/h-d8-d52.md` at `109bc19`, on
  `heatshield/d8-d52-live-evidence`. That branch is unmerged and rides this block's §Merge,
  step 1. The operator confirmed today that it is done and gets no additions.
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
| this commit | This ruling (OPEN) and the B.1 evidence |

**DIFF SUMMARY** `0f9f7a1..813aad2`: 5 files, +526 −2. Code is two files:
`replit_integrations/chat/routes.ts` (+22 −1, prompt only) and `routes/routes.ts` (+22 −1,
the PDF money rows). The rest is tests and the block file.

**TEST EVIDENCE.** Suite **280 → 302** in api-server (23 files), and `lib/cte` stays at
72/72. `pnpm -r typecheck` exits 0 before and after.

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

## Part B — D16: HELD, §5 refusal

```
REFUSAL — H-ASST-D16-N3.B.1
Instruction:   "If 'Little Italy, Cairo, Egypt' no longer gets Italy's factor, record that
               with evidence and drop Part B. Don't fix what doesn't reproduce."
Reality:       That string no longer reaches the lookup. Nominatim, queried today with the
               app's own query (b1-nominatim-1.json), returns [] for it, so the route answers
               422 geocode_failed before any carbon figure exists. But the defect is in the
               lookup, not the string, and it still reproduces:
               - lookupCarbonIntensity (carbon-intensity.ts:73-101) at 0f9f7a1, given
                 geocodedCountry "Egypt" and that string, returns 0.351 (Italy). It is
                 labelled country "Egypt" in the provenance (b1-lookup-at-0f9f7a1.jsonl).
               - Live today: "Little India, Singapore" geocodes to Singapore (country_code
                 "sg", b1-nominatim-5.json). Singapore is in neither table, the free-text walk
                 hits "india", and the result is 0.708 kg/kWh, India's factor, shown as
                 unsourced_legacy "Singapore".
               - The other three strings geocode to "United States" (country_code "us") and
                 get US 0.386 from step 1's exact match. They are correct today.
Conflict:      The block's drop condition is met to the letter, but "don't fix what doesn't
               reproduce" doesn't hold: the defect reproduces. §5: the reading of the code
               wins over the literal instruction, and two clauses can't both be satisfied.
Options:       (a) Drop B as written. Record D16 as live through "Little India, Singapore"
                   and ticket it. Cost: a known wrong-country CO2 figure stays in production.
               (b) Run B with "Little India, Singapore" added to B.3's four strings. B.4 as
                   written: resolve by Nominatim's structured `address.country_code`, which
                   every successful response carries (b1-nominatim-2..6). That means the
                   geocoder returns one more field it already receives. The fence puts "the
                   geocoder itself" OUT and "how [the lookup] receives the country" IN, and
                   this sits between them, so it needs the ruling too.
               (c) As (b), but only delete the free-text walk (step 2) and pass no new field.
                   A country outside the table then goes to the existing no-match path. Cost:
                   step 1 still matches on the display name, and the "structured" half of B.4
                   isn't met.
Recommendation: (b).
```

**B.2 read so far.** `geocode()` (`routes.ts:76`) returns `country`, which is Nominatim's
English display name (`address.country`), and `regionCode` (`ISO3166-2-lvl4`). It doesn't
return `address.country_code`, even though the response carries it.

The no-match path today, end to end: `resolveCarbonSource` returns `unknown_country`, and
`/api/calculate` answers **400 `unknown_carbon_country`** with "We do not have a sourced
carbon-intensity figure for "<country>". Try including the country, or a nearby major city."
No row is written and there is no PDF.

**B-a note:** a fix must not derive the country from `display_name` or from the string in
`country`.

Part B has no code and no tests on the branch. MB1 and MB2 haven't run.

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

## G9 — mutations (A and C), each caught and restored

The work was committed before any mutation. After each one, the file was restored and its
`git hash-object` matched the `HEAD` blob.

| # | Mutation | Caught by |
|---|---|---|
| MA1 | add "- Feed-in tariff calculations." to the prompt's list | TA1 (feature not in map), A-c: 2 failed |
| MA2a | delete the PDF row from the feature map | TA1: 1 failed |
| MA2b | remove the mapped symbol (`name: "From Battery"` → `"Battery"` in `ResultsDisplay.tsx`) | TA1 symbol row: 1 failed |
| MB1, MB2 | — | **not run, Part B held** |
| MC1 | print `lifetimeSavings` as net | TC1, TC2, TC3: 3 failed |
| MC2 | treat a null cost as 0 (net row always, `lifetime − null`) | TC1, TC4, M1: 3 failed |
| MC3 | swap `-` for U+2212 | TC2, TC3, M3 (static WinAnsi scan): 3 failed |

## Not yet run

- **§Merge dry run:** both merges clean, no overlap.
- **G8 Tier B:** the revert on a scratch ref.

Both depend on the final branch tip, which waits on Part B. When they run, this ruling will
carry, verbatim: **the deploy path is UNPROVEN, and A13's standing debt stands.**

## Evidence — `contracts/evidence/h-asst-d16-n3/`, 5 Oct 2026 ~02:06Z

Byte-exact (`contracts/evidence/** -text`).

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

- **Part B:** held (above).
- **Unwired web locale.** `artifacts/green-energy-calculator/src/locales/en.json:27` still
  reads `"results_net_25yr": "25-Year Net Gain"`. It's imported by nothing, as its
  `README.md` says, so it's out of Part C's fence. It is a C-a hazard the day the locales are
  wired.
- **Carried, not touched:** D12, R1 #3, A4 #4, L-local #5, R2 #6, #7 deploy order, #8, #9 N4,
  and the `0.4` substitution.
- **Clean tree.** After this commit, `git status --porcelain` is empty. The two scratch probe
  test files used for B.1 and TC5's pin values were deleted, not committed. The worktree
  used for H-D8D52's Tier B re-run is removed.

## RULING

**OPEN.** Next: the operator rules on REFUSAL B.1, picking (a), (b) or (c). Then Part B,
MB1 and MB2, the §Merge dry run and Tier B. The executor stops there, before §Merge.
