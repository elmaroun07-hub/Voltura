# Ruling — Block H-PDF · Gate H-PDF

**Block file:** `contracts/blocks/h-pdf.md` · **Executed:** 28 Sept 2026
**Ruling:** OPEN — pre-merge criteria met; closes on L1–L3 after the operator's merge. The
merge is operator-ruled (§14.2), and the block file says to stop at this ruling.

---

## BLOCK / GATE

H-PDF — the report a buyer forwards is one document, not twelve pages. One gate. No §5
refusal was raised. Two readings of the code bound the literal task text and are recorded
as design decisions 5 and 6; three new findings are recorded for the operator (N3, R1, R2).

## DATE, COMMIT (before)

| | |
|---|---|
| Date | 2026-09-28 |
| `main` at block open | `45378e9` (`45378e9ae571255a060474e3034aa5b399dad636`) — local `main` = `origin/main` after `git fetch`. Live at 2026-09-28T00:33:33Z: `/api/version` → `{"sha":"45378e9",…,"source":"render"}`; web `<meta name="build-sha" content="45378e9" />`. Matches the block file. |
| §0 | `5c38aa1` on `heatshield/d51-live-evidence`: "Operator rulings, 28 Sep 2026" appended to `contracts/rulings/h-d51.md`, only that file staged, not pushed (`git ls-remote origin heatshield/d51-live-evidence`: empty). |
| Branch | `heatshield/pdf-report`, off `45378e9` |
| `481db9c` | the block file, committed unmodified as the branch's first commit — blob sha256 `e4f8fd89d90ecf250da14eb5467e276208465b4073281a66d09633103433a261`, identical to the file the operator placed |
| `9e3f4a4` | P.1–P.5 |
| next | this ruling |
| Session open | Latest ruling on disk: `h-d51.md`, CLOSED (self-ruled) on L1–L4 at `45378e9`, on the unmerged `heatshield/d51-live-evidence`. |

## TASKS CLAIMED CLOSED

| # | Evidence |
|---|---|
| P.1 | `ensureRoom(h)` (`routes.ts:755`) compares `y + h` with `doc.page.height - doc.page.margins.bottom` (`:753`); if the block does not fit it calls `addPage()` and sets `y = doc.page.margins.top`. It holds the renderer's only `addPage()` (`:757`). It runs before the Summary heading (`:766`), every summary row (`:791`), the Results heading (`:801`), every result row (`:841`), the Monthly heading together with the header row and first month (`:864`), every month row (`:873`) and the footer (`:885`). A month row that starts a page redraws the header row first (`:873`; `headerRow` at `:854`). |
| P.2 | Label `"CO2 Emissions Reduced"` (`routes.ts:836`). Guard: `pdf-report.test.ts` › *M3* parses `routes.ts` with the TypeScript compiler API, finds the handler of `app.get("/api/calculate/:id/pdf", …)`, and fails on any string or template literal in it that WinAnsi cannot draw as itself — 120 literals, every branch, rendered or not. User text (the location) is record-only: L-local below. |
| P.3 | `roi()` starts `paybackYears` at `null` (`countries.ts:433`); `RoiResult.paybackYears: number \| null` (`:409`). `RoiUsed` (`money.ts:86`), `shared-routes.ts:224` and the web mirror `lib/api.ts:234` take `null`. The writer is unchanged and now stores `null` (`routes.ts:1070`, comment at `:1068`); `payback_years` is already nullable (`schema.ts:35`) — no DDL. PDF: `routes.ts:823–828`. Web: `paybackText` (`ResultsDisplay.tsx:28`), rendered at `:189`. |
| P.4 | The three dead defaults are deleted — grep below. |
| P.5 | `artifacts/api-server/src/routes/pdf-report.test.ts` (7 tests) and three `roi()` tests in `countries.test.ts` (one rewritten, two added). G9 below. |

## Design decisions the block left open

1. **P.2 — plain `CO2`, not a drawn subscript.** The text layer then reads `CO2`, which is
   what L2 checks; a drawn subscript would split it across two text blocks.
2. **P.2 — numbers the renderer formats take a pinned locale** (`num`, `routes.ts:763`:
   `toLocaleString("en-GB")`). They used the host default. A host locale such as `fr-FR`
   prints U+202F (narrow no-break space) as the thousands separator, which WinAnsi cannot
   encode. Render's host locale is not observable from here; pinning makes P.2's first
   sentence hold by construction. On an `en-US` host the output is identical.
3. **P.2 — the guard reads the source, not a rendering.** A render only exercises the
   branches its fixtures reach; the no-currency tariff string (`routes.ts:777`) is drawn by
   no test, and M3b below shows the guard still catches it (F-e). Boundary: a static string
   defined outside the handler and imported into it would not be scanned — there is none
   today. `typescript` (5.9.3) is the root workspace's devDependency, resolved by Node from
   the repository root; the api-server's own `package.json` does not declare it. No manifest
   or lockfile changed.
4. **P.1 — headings keep with what follows** (Summary and Results with their first row; the
   Monthly heading with the header row and the first month), so no heading is left alone at
   the foot of a page. Three `moveDown()` calls were removed: every draw passes its own `y`,
   so they moved nothing. **Page 1's geometry is unchanged** — every element sits where it
   sat at `45378e9`.
5. **P.3 — a zero install cost is paid back at year 0, not "never".** Reading the loop: its
   crossing test needs `cumulative < cost`, which a cost of 0 never meets, so a zero cost fell
   through to the "never" value — 25 before this block, and under the literal task text
   `null`, which would print "not within 25 years" for a system that cost nothing.
   `paybackYears` starts at `0` when `cost <= 0` (`countries.ts:433`). Reachability: none
   through the route — `routes.ts:987` maps a user cost of 0 to `null`, and the registry's
   band costs are positive — so no production output changes. Tested; mutation Z.
6. **P.3 — what `null` means, exactly.** Every `null` is "not paid back within 25 years",
   so the never-wording is always true. The converse does not hold (R1). `RoiResult`'s
   docstring (`countries.ts:403–408`) says so.
7. **P.3 — the web's never-wording names the curve's own last year** ("not within 25
   years", from the final `year` of `money.roi.curve`), so no literal 25 decides or prints
   it. An empty curve — `roi()` never returns one — renders "not reached". A genuine payback
   of 25.0 now prints `25y`; it used to print `>25y`.
8. **Location of `roi()`.** The block cites `lib/emissions/countries.ts:418`; the file is
   `artifacts/api-server/src/lib/emissions/countries.ts`, and `:399` and `:418` matched at
   `45378e9`. The path is relative to `artifacts/api-server/src/` and names one file, so this
   is not a §5 location conflict.

## DIFF SUMMARY

`git diff --numstat main heatshield/pdf-report` at `9e3f4a4` — **9 files, +667 −35** (this
ruling adds a tenth):

| + | − | file |
|---|---|---|
| 394 | 0 | `artifacts/api-server/src/routes/pdf-report.test.ts` |
| 145 | 0 | `contracts/blocks/h-pdf.md` |
| 71 | 27 | `artifacts/api-server/src/routes/routes.ts` |
| 21 | 1 | `artifacts/api-server/src/lib/emissions/countries.test.ts` |
| 17 | 2 | `artifacts/api-server/src/lib/emissions/countries.ts` |
| 13 | 2 | `artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx` |
| 2 | 1 | `artifacts/api-server/src/lib/emissions/money.ts` |
| 2 | 1 | `artifacts/api-server/src/shared-routes.ts` |
| 2 | 1 | `artifacts/green-energy-calculator/src/lib/api.ts` |

Fence checks:

- `routes.ts` hunks: the import (`:23`), the PDF route (`:744–885`), and a two-line comment
  in the calculate handler's insert (`:1068`). No hunk touches the energy, carbon or money
  computation — the calculator's numbers are out of fence and unchanged.
- Out of fence and untouched: D11's `/ 20` (only its dead `?? 0` went, P.4); the "Green
  Energy Savings Report" title and footer name (B3); page size (below); D8.
- `git diff --stat main heatshield/pdf-report -- lib gate-check.sh artifacts/green-energy-calculator/src/pages artifacts/greencalc package.json pnpm-lock.yaml artifacts/api-server/package.json artifacts/green-energy-calculator/package.json`
  → empty.
- No file deleted, no DDL, no DB write, no dependency change. Every touched file is stored LF
  (`git ls-files --eol`: `i/lf`).

## TEST EVIDENCE

| Suite | Block open (`481db9c`, `45378e9`'s code) | After (`9e3f4a4`) |
|---|---|---|
| `lib/cte` | 72 | 72 |
| `artifacts/api-server` | 242 (20 files) | **251** (21 files) |
| **`pnpm -r test`** | **314** — matches the block file | **323** (+9, none removed) |
| root `pnpm run typecheck` | exit 0 | exit 0 |

+9 = the 7 tests of `pdf-report.test.ts`, plus two added to `countries.test.ts` (M6's
boundary, the zero cost). A third, *"roi reports >25y (payback stays 25) when the saving
never covers the cost"*, asserted the defect (`toBe(25)`); it is rewritten to assert `null`
and not counted as new.

**Failing, then passing.** `pdf-report.test.ts` was written first and run against the
unmodified renderer: **7 of 7 failed**, each on the defect it names.

| Test | Against `45378e9`'s renderer |
|---|---|
| M1 | `expected 12 to be 2` — N1 confirmed by rendering, not by the block's arithmetic |
| M2 | `expected [ 'Nov' ] to deeply equal ArrayContaining{…}` — a page holding one cell |
| N2 | `expected [ Array(99) ] to include 'CO2 Emissions Reduced'` |
| M3 | one literal: `routes.ts:804 "CO₂ Emissions Reduced" — U+2082` |
| M4 | `expected 25 to be null` |
| M5 | `expected 'pending' to be 'not within 25 years'` — the never row printed "pending" |
| L-local | `expected 12 to be 2` |

G10: `pdf-report.test.ts` stubs `fetch`; Nominatim and NASA come from
`calculate.fixtures.json`, any other outbound URL throws, and only `http://127.0.0.1` (the
server under test) passes through. Storage is a map in the test file, scoped by session like
the real query.

**Reading the real bytes (F-b).** The tests read the route's response, not a model of the
layout. Objects are located through the xref table PDFKit writes; each page's `/Contents`
stream is inflated with `zlib`; each `BT…ET` block's hex strings are decoded as windows-1252
(an odd digit count takes its implied trailing 0). The production renderer keeps compression
on.

### Mutations (G9) — one at a time on the committed tree, full api-server suite, restored with `git checkout -- <file>`

Each mutation is an exact one-line replacement that must match once. After each restore,
`git status --porcelain` was empty and `git hash-object` equalled the `HEAD` blob
(`routes.ts` `6ee223a`, `countries.ts` `d337caa`).

| # | Mutation | Result (api-server, 251) |
|---|---|---|
| M1 | remove the fit check: `if (y + h <= pageBottom()) return false;` → `return false;` | **Caught**, 3 fail: M1 (`expected 12 to be 2`), M2, L-local (`expected 12 to be 2`) |
| M2 | drop the header repeat: `if (ensureRoom(18)) headerRow();` → `ensureRoom(18);` | **Caught**, 1 fail: M2 (`expected [ 'Nov', '273.2 kWh', …(9) ] to deeply equal ArrayContaining{…}`). M1 still passes — the page count cannot see it |
| M3 | `"CO2 Emissions Reduced"` → `"CO₂ Emissions Reduced"` (U+2082) | **Caught**, 2 fail: M3 (the guard) and N2 (the real bytes) |
| M4 | `roi()` starts at `ROI_YEARS` again for never | **Caught**, 2 fail: `pdf-report` M4 and `countries` *"roi returns null …"*, both `expected 25 to be null` |
| M5 | `calc.lifetimeSavingsEur == null` → `calc.paybackYears == null` (pending read off the payback alone) | **Caught**, 2 fail: M5 and M4, both `expected 'pending' to be 'not within 25 years'` |
| M6 | `roi()` returns `null` when `paybackYears >= ROI_YEARS` | **Caught**, 1 fail: `countries` M6 (`expected null to be 25`) |
| M3b *(supplementary, F-e)* | U+2248 put into the no-currency tariff string (`routes.ts:777`), which no test renders | **Caught** by the guard alone, 1 fail |
| Z *(supplementary)* | zero-cost start removed: `… <= 0 ? 0 : null` → `null` | **Caught**, 1 fail: `countries` zero cost (`expected null to be +0`) |

G9 per new test — `pdf-report` M1: M1. M2: M1, M2. N2: M3. M3 (guard): M3, M3b. M4: M4, M5.
M5: M5. L-local: M1. `countries` *"returns null"*: M4. M6 boundary: M6. Zero cost: Z.

**Self-reported.** M3b's first run planted the ASCII text `2248`, not U+2248: the mutation
was written through GNU `sed`, whose `\u` in a replacement upper-cases the next character and
consumed the escape. All 251 passed — correctly, since nothing outside WinAnsi had been
planted. That run was discarded; the result above is the re-run with the real character.

## `??` grep — D6 residue (P.4)

Before — `45378e9`, the PDF route (`routes.ts:715–860`):

```
$ git show 45378e9:artifacts/api-server/src/routes/routes.ts | awk 'NR>=715 && NR<=860 && /\?\?/'
routes.ts:764:        ["Battery Efficiency", `${((calc.batteryEfficiency ?? 0.9) * 100).toFixed(0)}%`],
routes.ts:800:        ["Annual Energy Saved", `${(calc.savingsKwh ?? 0).toLocaleString()} kWh`, "#10b981"],
routes.ts:804:        ["CO₂ Emissions Reduced", `${(calc.co2Reduction ?? 0).toLocaleString()} kg`, "#059669"],
routes.ts:805:        ["Trees Equivalent", `${Math.round((calc.co2Reduction ?? 0) / 20)} trees/year`, "#059669"],
```

After — `9e3f4a4`, the whole handler (`routes.ts:715–902`): **no `??` and no `||`.**

All three columns are `.notNull()` (`schema.ts:27, 30, 31`), so none of the defaults could
fire; the typecheck accepts the direct reads.

## L-local — record only

`pdf-report.test.ts` › *L-local* renders a row whose location is `Łódź, Poland`, in the
harness, with no production write.

- The report still renders, on 2 pages.
- The location prints as **`\x14\x1f6Az, Poland`**: two control characters, then `6Az`.
  PDFKit writes `Ł` (U+0141) as the three hex digits `141` and `ź` (U+017A) as `17a`, so
  `Łódź` becomes `141 f3 64 17a` → bytes `14 1f 36 41 7a`. From the first three-digit code,
  every byte is misaligned until the digit count is even again, here after `ź`, which is why
  `, Poland` survives.
- The mechanism is N2's, with a worse outcome: U+2082 is four digits and only adds a stray
  `" ‚"`, while an odd digit count garbles every character after it until the count evens
  out.

Not fixed (block text). Any location with a character outside WinAnsi — Polish, Czech,
Turkish, Romanian or Greek names, for instance — prints wrong on the PDF. Spanish, French,
German and Portuguese names are inside WinAnsi: `Fuengirola, Málaga, Spain` prints correctly.

## F-f — old rows

Rows written before this block for a system never paid back carry `payback_years = 25` with
`lifetime_savings_eur` set, and still print **"25.0 years"**. They cannot be told from a
genuine 25.0 without recomputing from the row's inputs, so they are left alone — no guess, no
backfill (G3). How many such rows production holds was not measured: production's database
is outside every fence here.

Checked from history, not assumed. No version of the writer ever stored
`lifetime_savings_eur` without `payback_years`: both columns arrived together (`ac6d02d`,
26 Jun 2026), were written together from the same ROI result (`81014f6`, then `75fdf42`),
and are both `null` when no ROI was computed. After this block, the pair (lifetime set,
payback null) therefore means "never" and nothing else, and every older row prints what it
printed before. The horizon has been 25 in every version (`YEARS = 25` since `769474b`,
4 May 2026; `ROI_YEARS = 25` since `75fdf42`), so printing `ROI_YEARS` on an old row cannot
misstate the horizon it was computed with. A19's shape was checked for here and is not
present.

## Findings raised at this gate — recorded, not fixed

**N3 — "Est. 25-Year Net Gain" prints gross savings.** The row prints `lifetimeSavingsEur`
(`routes.ts:834`), which is the curve's last `cumulativeSavings` (`countries.ts:446`) —
savings before the install cost, not net of it. It matters most on the never-paid-back case:
the harness render of Fuengirola at a €200,000 install cost prints **"Est. 25-Year Net Gain
€30,975"** beside "not within 25 years", for a system whose net position at year 25 is about
−€169,000. The label predates H-SRC-ES-UK (`75fdf42^`, `routes.ts:813`, same gross figure).
It is a claim, so B3's by this block's routing (D11 went there). The L2 second probe will
show it live.

**R1 — `roi()` tests one year past its curve.** The loop runs `y = 0..ROI_YEARS` and each
pass tests for a crossing during the following year, so the last pass tests the 26th year of
savings, which is on neither the curve (26 points, years 0–25) nor in `lifetimeSavings`. A
cost first covered in that year comes back as a number in (25, 26] — at 1.5 % a year, any
cost between 30.06 and 31.51 times the first year's saving. So `null` implies "not within 25
years", but "not within 25 years" does not imply `null`. Nothing false is printed (25.4
years is what the model computed), but the payback can sit past the end of the curve drawn
beside it. Unchanged: the calculator's numbers are out of fence. The fix, if the operator
wants it, is to test the crossing only while `y < ROI_YEARS`; that band would then read "not
within 25 years".

**R2 — long user text can still trigger PDFKit's own page break.** The location has no
maximum length (`schema.ts:63`: `.min(2)` only). It is drawn right-aligned across x 0–542 at
10 pt, so a value that wraps overlaps the next summary row, and one long enough to reach the
page bottom would make PDFKit add a page by itself — N1's mechanism, reached through user
text, with `y` again unaware. In practice the calculate route rejects a location Nominatim
cannot resolve (422 before the insert), which bounds it; that bound was not probed. User
text is record-only in this block.

**Page size — Letter, measured.** Every page's MediaBox is `[0 0 612 792]`, US Letter and
PDFKit's default. For the operator's Letter-vs-A4 decision: on A4 (595.28 × 841.89) the same
layout would hold all twelve months on page 1 — December's row would end at 764, inside A4's
limit of 791.89 — but the footer (a 30 pt gap plus 22 pt) would not fit and would sit **alone
on page 2**. That is arithmetic from the layout constants, not a render. A switch to A4
changes M1's asserted count, or needs a layout change with it.

**Deploy skew.** One push deploys both services, not atomically. If the API goes live
before the web, a never-paid-back calculation submitted from the old page in that window
fails the old web schema (`paybackYears: z.number()`), and that request shows an error. The
window is seconds (H-D51: web 20:59:23Z, API 20:59:43Z — the web first, that time), and it
needs a user to enter an install cost the savings never cover within those seconds.

**Known limit — the web schema.** Nothing local checks that `lib/api.ts:234` admits `null`:
the web has no test runner (D44), and `paybackText`'s `!== null` type-checks either way. L3
is the check.

## Layout, from the real bytes

No rasteriser is installed on this machine and the browser pane would not open a local
file, so no page was looked at. Instead, each text block's position was read from the
content stream of the harness render of the never-paid-back case (scratch analysis, not a
gate). Page 1 carries the header, the 8 summary rows, the 6 result rows, the table heading,
the header row and January–October, the lowest baseline at 721.1 pt against a bottom margin
of 742. Page 2 carries the header row again (baseline 62.5), November (81.1), December (99.1)
and the footer (152.5). L3 opens the real download.

## LIVE EVIDENCE — G12

**Pre-merge, read-only. No production row was written before the merge.**

| Request | Response | What it proves |
|---|---|---|
| `GET https://voltura-api.onrender.com/api/version`, 2026-09-28T00:33:33Z | `{"sha":"45378e9","shaFull":"45378e9ae571255a060474e3034aa5b399dad636","source":"render"}` | Production is `main` at block open |
| `GET https://voltura-web.onrender.com/` | `<meta name="build-sha" content="45378e9" />` | …on both services |

The defects are already on the production record: H-D51 L4, rows 98 and 99, 12 pages each,
"CO ‚ Emissions Reduced" (`h-d51.md` on `heatshield/d51-live-evidence`).

### After the merge — L1–L3: PENDING

| | Status | Probe row ids | Session |
|---|---|---|---|
| L1 | pending | — | — |
| L2 | pending | — | `probe-pdf-<date>-<sha>` |
| L3 | pending | — | — |

§2 Auto-Deploy is re-confirmed at the merge and recorded here then.

## §Merge — proven on a scratch ref

File overlap, re-checked at `9e3f4a4`: `heatshield/h-src-es-uk-live-evidence` (7 files, all
under `contracts/`), `heatshield/d51-live-evidence` (16 files: `contracts/` and
`.gitattributes`) and this branch (9 files) share no path pairwise, and the first shares none
with `main`'s changes since its base `dfde7b7`.

On `scratch/pdf-merge-proof`, created at `main` (`45378e9`), local and never pushed, §Merge's
three merges in order:

```
git merge --no-ff --no-edit heatshield/h-src-es-uk-live-evidence   # ae2a3bf — parents 45378e9 b7eb259
git merge --no-ff --no-edit heatshield/d51-live-evidence           # 7fb1cfa — parents ae2a3bf 5c38aa1
git merge --no-ff --no-edit heatshield/pdf-report                  # cb29fa9 — parents 7fb1cfa 9e3f4a4
```

All three exit 0, no conflict. Per merge: 7 files +203 −4; 16 files +296 −68; 9 files
+667 −35 — the block merge touches exactly the 9 files of `main..heatshield/pdf-report`.

## ROLLBACK — G8, Tier B

Code ships to two production containers at the merge, and no drill is authorised: **Tier B**.

On the same scratch ref, after the three merges:

```
git revert -m 1 --no-edit cb29fa9                    # 7ff9af8, exit 0
git diff --shortstat 7fb1cfa cb29fa9                 # 9 files changed, 667 insertions(+), 35 deletions(-)
git diff --shortstat cb29fa9 7ff9af8                 # 9 files changed, 35 insertions(+), 667 deletions(-)
git diff --stat 7fb1cfa 7ff9af8                      # (empty)
```

The revert mirrors the block merge file for file and line for line (numstat), and the tree
after it is the tree after the two evidence merges (`046cfc33c6c1bcb439c97beddf34c494006057de`
for both): the evidence stays standing. The evidence merges then revert independently —
`git revert -m 1` of `7fb1cfa`, then of `ae2a3bf`, both exit 0 — and the tree is `main`'s
again (`c23d0e4c5faba40764df46c062a3b45921aa8948`). `main` and `origin/main` stayed at
`45378e9` throughout.

This proof is computed at `9e3f4a4`. The real block merge also carries this ruling, which a
revert removes along with the code; the proof is re-run at the ruling commit below.

**The deploy path is UNPROVEN.** Every proof in this section is git mechanics; no rollback
deploy has been executed and no production instance has been taken back. **A13's standing
debt survives this block: it stands until one deploy-path rollback is executed deliberately
under Tier C.**

After the merge, the rollback is `git revert -m 1 <block merge>` and a push. That is a
production deploy of both services (A13), and must be declared as one if run.

### Re-verification at the ruling commit

Re-run at `d431e64` (the commit that added this file) on a second scratch ref,
`scratch/pdf-ruling-merge-proof`, created at `main`, local and never pushed:

```
git merge --no-ff --no-edit heatshield/h-src-es-uk-live-evidence   # 5e79aa3
git merge --no-ff --no-edit heatshield/d51-live-evidence           # 554b771
git merge --no-ff --no-edit heatshield/pdf-report                  # b621eed — parents 554b771 d431e64
git revert -m 1 --no-edit b621eed                                   # e6a548a, exit 0
git diff --shortstat 554b771 b621eed                                # 10 files changed, 1065 insertions(+), 35 deletions(-)
git diff --shortstat b621eed e6a548a                                # 10 files changed, 35 insertions(+), 1065 deletions(-)
git diff --stat 554b771 e6a548a                                     # (empty)
```

The block merge is the 10 files of `main..heatshield/pdf-report`, the revert mirrors it, and
the tree after it is the evidence-merge tree again (`046cfc33c6c1bcb439c97beddf34c494006057de`).
The only later commit on the branch fills in this subsection, which a revert of the real merge
removes with the rest.

## Named failure modes — checked against

| | |
|---|---|
| **F-a** shrinking to fit | Not taken. Row heights are unchanged (22, 22, 20, 18) and the table breaks after October. A layout squeezed onto one page fails M1's exact count of 2. |
| **F-b** a page count from a model | M1 counts pages in the bytes the route returns: the page tree's `/Count`, checked against the `/Kids` it lists. |
| **F-c** a new sentinel | `null` plus the `lifetimeSavingsEur` discriminant; no number means "never". M6 pins a real 25.0 as a number, and a zero cost is a real 0 (design decision 5). |
| **F-d** pending and never collapse | M5: two rows, both with a null payback, print "pending" and "not within 25 years". On the web, pending has its own card ("Payback: pending") and never shows in the computed card ("not within 25 years"). |
| **F-e** a guard on one label | The guard reads all 120 literals of the handler; M3b is caught in a branch no test renders. |
| **F-f** old rows | Recorded above. |

## RESIDUE

- **Scratch refs:** `scratch/pdf-merge-proof` (at `81635d0`, after the three reverts) and
  `scratch/pdf-ruling-merge-proof` (at `e6a548a`) — local, never pushed, deletable at will,
  following `scratch/d51-*`.
- **Evidence branches** `heatshield/h-src-es-uk-live-evidence` (`b7eb259`) and
  `heatshield/d51-live-evidence` (`5c38aa1`): unmerged and unpushed; §Merge merges them.
- **N3, R1, R2**, the page size and the deploy skew: findings above, for the operator.
- **F-f:** old "never" rows print "25.0 years"; their count was not measured.
- **Untouched in the renderer:** the session-header comment appears twice (`routes.ts:717`
  and `:720`), and an orphaned comment with blank lines sits at `:807–811` ("Payback +
  lifetime for PDF — read persisted values…"). Neither is a task here.
- **Literal 25s left in labels:** "25-Year ROI Curve" (`ResultsDisplay.tsx:184`), "25-Year
  ROI and payback" (`:245`), and the PDF's "Est. 25-Year Net Gain" (`routes.ts:834`, N3).
  Labels, not D7's decision sites.
- **`typescript` is an undeclared dependency of the api-server tests** (design decision 3).
- **Line endings.** The repository stores LF; working copies are CRLF under
  `core.autocrlf=true`, so the block file's working copy hashes `5d4cd4b5…` while its blob
  hashes `e4f8fd89…`, the operator's file. The content is identical.
- The mutation runner and its JSON reports, the dumped harness PDFs and the layout script
  live in the session scratchpad only, not in the repository.

## RULING

**OPEN — pre-merge criteria met.** It closes on L1–L3 after the operator's merge (§14.2), and
is self-ruled then: L1–L3 are HTTP responses, PDF bytes and a browser check.

- P.1–P.5 done. M1–M6 caught, plus M3b and Z. 314 → 323. Typecheck exit 0.
- §Merge proven on a scratch ref: three clean merges; the block merge is the block's 9 files.
- G8, Tier B: the block revert is proven to apply and to leave the evidence merges standing.
  **The deploy path is UNPROVEN; A13's standing debt stands.**
- For the operator: the merge (§14.2). N3 before or with B3; R1; page size.
