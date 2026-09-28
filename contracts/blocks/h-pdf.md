> Block file, split from `HEATSHIELD_CONTRACT.md` §9 under §14.1.
> Invariants (§0–§8, §10–§14) live in the root contract and are read every session.

# H-PDF — the report a buyer forwards is one document, not twelve pages · 28 Sep 2026

**Fence.** In: the PDF renderer in `GET /api/calculate/:id/pdf` (`routes.ts:715–860` at
`45378e9`); the "never paid back" value in `roi()` and everything its type change forces
(money block, persisted row, the ROI card on the web). Out: D11's trees-per-`20` (claims,
B3); the "Green Energy Savings Report" title and footer name (branding, B3); page size
Letter vs A4 (recorded for the operator, not changed); D8 (next block); the calculator's
numbers. Branch: `heatshield/pdf-report`, off `main` at the tip at block open (`45378e9`
when written — re-verify). G1 — no commits to `main`.

## §0 — carried from H-D51, done FIRST, on `heatshield/d51-live-evidence` (not on this block's branch)

Append to `contracts/rulings/h-d51.md` a section **"Operator rulings, 28 Sep 2026"**:

1. **Decision 1 (dropping `credentials: "include"` from `apiRequest`/`getQueryFn`) — UPHELD.**
   The operator's words, in chat to Claude (Cowork), replying to three numbered
   recommendations of which the second was "uphold it": *"1/2/3 lrt's do it now"*. Quote
   them as written.
2. **§2 Auto-Deploy re-confirmation — secondhand, say so.** Before the 20:58Z push on
   27 Sep, Claude (Cowork) read the Render API (`list_services`): `Voltura-api` and
   `Voltura-web` both `autoDeploy: yes`, trigger `commit`, branch `main`, previews off,
   not suspended. The executor did not observe this; record it as reported.

Stage **only** that file, commit on `heatshield/d51-live-evidence`, do not push. Then open
this block's branch from `main`.

## The defects — read from the code at `45378e9` on 28 Sep 2026

**N1 — every PDF is 12 pages (found at H-D51 L4).** The renderer tracks `y` by hand from
`let y = 130` (`routes.ts:770`) and never compares it with the page bottom. PDFKit starts
a new page on its own when a `text()` call would cross the bottom margin — but the
hand-kept `y` keeps growing, so every later draw also lands past the bottom and forces
another page. Read from the code: on Letter with `margin: 50` (`routes.ts:733`) the limit
is 742, and the November row (`routes.ts:832` loop) is the first to cross it. November and
December are ten cells → pages 2–11, footer (`routes.ts:842–853`) alone on page 12. That
matches what L4 observed; **confirm by rendering, not by this arithmetic.**

**N2 — "CO₂" prints as "CO‚".** `routes.ts:804` passes U+2082 to a standard Helvetica font
(WinAnsi). The glyph comes out as `‚` (WinAnsi 0x82 — the low byte of 0x2082). Same class
wherever the renderer is handed a character WinAnsi cannot encode.

**D7 — "never paid back" is the number 25.** `roi()` starts `paybackYears = ROI_YEARS`
(`lib/emissions/countries.ts:418`, `ROI_YEARS = 25` at `:399`) and keeps it when the
curve never crosses the cost. The loop runs `y = 0..25` inclusive, so a genuine payback
can also be 25.0 — the "never" value and a real value are the same number. The PDF prints
it as **"25.0 years"** (`routes.ts:797`); the web prints `">25y"` via a literal `25`
(`ResultsDisplay.tsx:178`). Reachable today whenever a user types an install cost large
enough that the savings never cover it.

**D6 residue — three dead defaults.** `batteryEfficiency ?? 0.9` (`routes.ts:764`),
`savingsKwh ?? 0` (`:800`), `co2Reduction ?? 0` (`:804`, `:805`). All three columns are
`.notNull()` (`lib/db/src/schema/schema.ts:27, 30, 31`), so the defaults can never fire.
Delete them. Nothing tests a line that cannot run; the evidence is the grep.

## Tasks

| # | Task |
|---|---|
| P.1 | Paginate. One helper decides "does the next block of height `h` fit?" against `doc.page.height - doc.page.margins.bottom`; if not, `addPage()` and reset `y` to the top margin. Every section, every table row and the footer go through it. A table that continues on a new page **repeats its header row**. |
| P.2 | Every string the renderer draws must be WinAnsi-encodable. Fix the label (`CO2`, or a drawn subscript — your choice, recorded). Add a guard that fails a test when a **static** string handed to the renderer contains a character WinAnsi cannot encode. User text (the location) is **record-only** — see L-local below. |
| P.3 | D7: "not paid back within the horizon" becomes a **state, not a number**. `roi()` returns `paybackYears: number \| null` (`null` = not within `ROI_YEARS`); the money block, shared-routes schema and web schema (`api.ts:233`) follow. Persist `null` (no DDL — G3: the column is already nullable). The PDF tells *pending* from *never* by `lifetimeSavingsEur` (written only when ROI was computed, `routes.ts:1026–1027`): `lifetimeSavingsEur == null` → "pending"; `lifetimeSavingsEur` set and `paybackYears == null` → "not within 25 years". The web card renders the same state without the literal `25`. |
| P.4 | Delete the three dead `??` defaults (D6 residue). |
| P.5 | Tests, G9 and G10. |

## Failure modes, named before building

- **F-a — shrinking to fit.** Tightening row heights until twelve months fit on one Letter page hides N1 until the next row is added. Paginate.
- **F-b — a page count read from a model of the layout only.** At least one test must count pages **in the real bytes** the route returns (the H-S harness in `pdf-session-scope.test.ts` already reaches the route with mocked storage).
- **F-c — "never" gets a new sentinel.** `-1`, `Infinity`, `999`, `ROI_YEARS + 1`: any number meaning "never" is D7 again. `null` plus the `lifetimeSavingsEur` discriminant, or a typed field — never a number.
- **F-d — "pending" and "never" collapse.** Both are non-numbers; they must print differently, in the PDF and on the web.
- **F-e — a guard that only checks one label.** P.2's guard covers every static string the renderer draws, not just the CO₂ line.
- **F-f — old rows.** Rows written before this block carry `25` for "never". They cannot be told apart from a genuine 25.0 without a recompute. Do not guess; record it as residue.

## Tests and mutations

Suite baseline at block open: **314** (after H-D51). Verify; report old → new.

| # | Mutation | Must be caught by |
|---|---|---|
| M1 | Remove the fit check (P.1) | a real-bytes page-count test (12 months → the page count your layout produces, asserted exactly) |
| M2 | Drop the header repeat on a continued table | a test that every page carrying month rows also carries the header row |
| M3 | Put `CO₂` (U+2082) back in the label | the P.2 guard |
| M4 | `roi()` returns `ROI_YEARS` again for "never" | a D7 test: never-paid-back → `null`, and the PDF text reads the never-wording, not "25.0 years" |
| M5 | PDF reads `paybackYears == null` as "pending" regardless of `lifetimeSavingsEur` | a test with a computed-never row vs a pending row: different words |
| M6 | A genuine crossing in year 24→25 (payback ≈ 25.0) returned as `null` | a boundary test: a real 25.0 stays a number |

Text in the real bytes: PDFKit compresses page streams — inflate them (node `zlib`) and
decode the text operators. Do not switch the production renderer to `compress: false`
to make testing easier.

## L-local — record only, no production write

Render one PDF in the test harness for a location outside WinAnsi (e.g. `Łódź`) and
record what it prints. Do not fix in this block.

## Live evidence — G12. The block closes on L1–L3, not on a green suite or a deploy.

Merge is operator-ruled (§14.2). **Stop after the gate ruling and report. Do not merge.**
When the operator says the merge is authorised, run §Merge exactly, then:

- **L1** `/api/version` and the web `build-sha` equal the block's merge sha (the tip after
  §Merge — not either evidence merge).
- **L2** Session `probe-pdf-<date>-<sha>`: `POST /api/calculate` Fuengirola → `id` →
  `GET /api/calculate/<id>/pdf`. From the real bytes: page count as asserted in M1, each
  month exactly once, header row on every page with month rows, `CO2` present, no U+201A.
  Second probe, same session: Fuengirola with `installationCost: 200000` (the schema max)
  → ROI computed, never paid back → the PDF prints the never-wording, not "25.0 years".
- **L3** Real browser (Brave, if the Playwright MCP has been pointed at it; state which
  browser ran): the never-paid-back case on the calculator shows the never-wording on the
  ROI card; the downloaded PDF's page count matches L2.

Probe rows go to production. Record ids and sessions; do not delete (G3).

## §Merge — three merges, one push, one deploy

Order matters: evidence first, block last, so the block merge is the tip and its revert
touches only code.

```
git -C <repo> checkout main
git -C <repo> merge --no-ff --no-edit heatshield/h-src-es-uk-live-evidence
git -C <repo> merge --no-ff --no-edit heatshield/d51-live-evidence
git -C <repo> merge --no-ff --no-edit heatshield/pdf-report
git -C <repo> push origin main
```

One push: Render builds the branch head once (A13 — the 13-commit push of 25 Aug produced
one deploy). Before the gate ruling, prove all three merges apply cleanly on a scratch ref
(file overlap between the two evidence branches and `main` was nil on 28 Sep — re-check).
Post-merge evidence goes on a new **unmerged** branch `heatshield/pdf-live-evidence`,
which rides the next code merge (D8). No docs-only push to `main`.

## Rollback — G8

Tier B on the block merge: `git revert -m 1 <block merge>` on a scratch ref, confined to
this block's diff. The two evidence merges are docs-only and revert independently. The
ruling carries the **deploy-path UNPROVEN** line and A13's standing debt, in those words.

## Ruling

`contracts/rulings/h-pdf.md`: shas, suite counts, M1–M6 with results, the `??` grep
before/after, the L-local record, F-f's residue, and L1–L3 with probe row ids.
