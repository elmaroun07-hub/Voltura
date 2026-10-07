# H2b — Spanish · Gate H2b

**BLOCK / GATE:** H2b / Gate H2b
**DATE:** 7 October 2026
**COMMIT (before):** `9990fbe` (`main`, H-ASST-ACC2 block merge — unchanged by this block)
**BRANCH:** `heatshield/h2b` — code tip `be55d3c`; this ruling is the commit on top. Unmerged; pushed to `origin` 7 Oct 2026 (a non-`main` branch: nothing deploys)

**Session open statement (§7):** last ruling on disk was `h-asst-acc2.md`, OPEN — merged and
live at `9990fbe`, its post-merge L1/L2/L3/Tier B not yet run. H2b does not touch it. H2b's
block file names no precondition block; "set up during H2" is its place in the schedule, and
its one input — the Spanish strings salvaged at H1.x — is already in `src/locales/` (C2). The
operator ruled "H2b first, then H3" on 7 Oct.

---

## TASKS CLAIMED CLOSED

- **2b.1 — i18n in place, Spanish default, English the translation.** CLOSED.
  - New package `lib/i18n` (`@workspace/i18n`): one runtime for web and API (P5). Catalogs are
    defined from the Spanish table; English is *typed* against it. No fallback language: a
    missing entry or a missing parameter throws (P2). `DEFAULT_LOCALE = "es"`.
  - Web: every visible string goes through `src/i18n/catalog.ts` (176 keys). ES/EN switcher in
    the sidebar; the choice is remembered in localStorage (try/catch; Spanish if unreadable);
    `<html lang>` and the title follow it; `index.html` ships `lang="es"` and Spanish meta.
    Numbers, money and dates are formatted for the reader (`es-ES` / `en-GB`); month labels
    come from the month **number**, never the English name the API sends. Form validation
    messages come from a zod error map over the catalog (the schema carries no prose).
  - API: `sessionFetch` — the one place request headers are set — sends `Accept-Language`
    with the reader's choice. The API answers in that language; absent or unsupported →
    Spanish. Recommendation, money-block reasons, every user-facing error message and the
    rate-limit message are catalog entries (`artifacts/api-server/src/i18n.ts`, 81 keys).
- **2b.2 — salvaged `es.json` strings loaded.** CLOSED. Mapped **by meaning**, not by key (the
  keys were GreenCalc's). 14 carried over and normalised to sentence case; the rest refused
  with reasons (no such page; names GreenCalc; different quantity). Table in
  `artifacts/green-energy-calculator/src/locales/README.md`.
- **2b.4 — assessment PDF in Spanish, Spanish number and date formatting.** CLOSED for the
  assessment PDF (the only PDF that exists; the screening PDF is H3's, out of fence). Every
  label from the server catalog; `12.500 W`, `0,267 €/kWh`, `90 %`, `Generado: 7 de octubre de
  2026`; months `ene … dic`. G7 fixed on the way: the stored orientation enum used to print
  raw (`south`) — it is now a label (`Sur` / `South`), checked before the PDF starts streaming.
- **2b.3 — domain vocabulary.** **REFUSED** under §5 — see REFUSAL below. Not done.
- **2b.5 — Assistant system prompt in Spanish.** **HELD** for an operator ruling ("if the
  Assistant survives into HeatShield" is the operator's question, and changing the prompt
  changes what H-ASST-ACC2's pending L2 measures). Not done.

## GATE H2b — "a new string added anywhere fails the build if it has no Spanish entry"

Demonstrated four ways on the branch tip, each change reverted after (`git checkout`):

| | Change | Result |
|---|---|---|
| (a) | `<p>Screening index for the building stock</p>` written into `Home.tsx` | `pnpm run build` → `check-i18n: 1 string(s) written outside the catalog … R1 src/pages/Home.tsx:35` → `[ELIFECYCLE] Command failed with exit code 1` |
| (b) | `"home.screening"` added to the **English** table only | `tsc` → `catalog.ts(257,5): error TS2353: Object literal may only specify known properties, and '"home.screening"' does not exist in type …` |
| (c) | `{t("home.screening")}` used with no Spanish entry | `tsc` → `Home.tsx(35,17): error TS2554` |
| (d) | API: a PDF row `t("pdf.screening")` with no Spanish entry | `tsc` → `routes.ts(997,10): error TS2554` |

`check-i18n.mjs` runs in front of both `typecheck` and `build` in the web package, so CI's
Typecheck step and Render's build both fail on (a); `tsc` fails on (b)–(d). The tsc message for
an unknown key reads "Expected 2 arguments, but got 1" — cosmetic, the build still fails.

**What the gate does not cover, stated rather than implied:**
- `check-i18n` scans the **web app** only. On the API, a sentence written as a raw literal
  into a response is not machine-caught; the API's guarantee is the typed catalog wherever
  `t()` is used, plus the tests below.
- `check-i18n` misses a **single-word** literal outside JSX and outside its named text
  properties (R5 needs whitespace to tell prose from identifiers). `index.html` is not parsed.

## DIFF SUMMARY

`9990fbe..be55d3c`: **61 files, +2,680 / −421.** No migration, no DDL, no data written (G3).
No file deleted. Main pieces: `lib/i18n/` (new), `artifacts/green-energy-calculator/src/i18n/`
(new), `scripts/check-i18n.mjs` + tests (new), `artifacts/api-server/src/i18n.ts` (new);
every page and the UI primitives with screen-reader text moved onto the catalog;
`routes.ts` (PDF, calculate, history, optimize, rate limiter), `money.ts`, `countries.ts`
(`formatMoney` takes a locale), `sizing.ts` (`sizingFailureMessage` takes a locale), `app.ts`
(CORS lists `Accept-Language`; it is safelisted, named anyway).

## TEST EVIDENCE

- Baseline at `9990fbe`: typecheck exit 0; `lib/cte` 72 + api-server 381 = **453**; web: no tests.
- At `be55d3c`: typecheck exit 0; `lib/i18n` **11** + `lib/cte` 72 + web **21** + api-server
  **393** = **497 passed, 0 failed**. Web build succeeds with the checker in front.
- New: `lib/i18n/src/index.test.ts` (11), `web/scripts/check-i18n.test.mjs` (12),
  `web/src/i18n/catalog.test.ts` (5), `web/src/lib/queryClient.test.ts` (4),
  `api-server/src/i18n.test.ts` (5), Spanish cases added to `pdf-report.test.ts` (3),
  `calculate.test.ts` (3), `nasa-fillvalue-fixture.test.ts` (1), `pdf-session-scope.test.ts`.
- **G9 — every mutation killed:**

| # | Defect reintroduced | Failed |
|---|---|---|
| M1 | `translate` returns "" instead of throwing on a missing parameter | 1 |
| M2 | `DEFAULT_LOCALE` flipped to `en` (API suites) | 6 |
| M2b | same, web | 3 |
| M3 | checker rule R1 disabled | 1 |
| M4 | `sessionFetch` stops sending `Accept-Language` | 4 |
| M5 | a PDF heading back to an English literal | 2 |
| M6 | English September becomes ICU's "Sept" | 1 |
| M7 | PDF months taken from the stored English name | 1 |
| M8 | calculate route always writes English | 2 |
| M9 | Spanish placeholder drifts from English (`{count}` vs `{n}`) | 1 |
| M10 | a P7 word ("Calificación") in a Spanish entry | 1 |
| M11 | an English sentence copied into the Spanish table | 1 |

### Existing tests that changed, and why — none weakened

- Suites that pin **English** text now ask for English explicitly (`Accept-Language: en`):
  `calculate.test.ts`, `optimize.test.ts`, `pdf-report.test.ts`, `pdf-session-scope.test.ts`,
  `facts-acc2.test.ts` (P1 pdf). Without it they would be reading the Spanish default.
- `money.test.ts`, `sizing.test.ts`, `nasa-fillvalue-fixture.test.ts`, `countries.test.ts`:
  the engine functions now take a required `locale`; English assertions pass `"en"`.
- **Assistant fact pins re-pointed, facts unchanged** (H-ASST-ACC / ACC2 / D16-N3 evidence):
  `facts.test.ts` (nasa fallback label, monthly-chart series, energy-mix slices, PDF
  headings), `facts-acc2.test.ts` (E3 optimizer units), `feature-map.test.ts` (two anchors).
  Each now pins the code site **and** the catalog's English entry carrying the fact's words.
  No fact text in `facts.ts` was touched.
- `pdf-report.test.ts` M3 (WinAnsi): the labels left the handler, so the scan now also
  covers every `pdf.*` and `unit.*` catalog entry **in both languages** — Spanish adds letters
  English never used. All encode.

### English output that changed

- PDF: orientation prints `South`, not `south` (G7 fix). Month-table figures of 1,000 kWh or
  more gain a grouping comma (`1,234 kWh`), as the summary rows already had.
- Web: amounts, dates and numbers are formatted per locale; English keeps `en-GB`.
- Unchanged on purpose: English recommendation text (wattage printed raw, as before);
  English zod validation messages from the API (Spanish names the field instead); every
  English error message A3.6/A3.7 pin, byte for byte.

## LIVE EVIDENCE

None yet — the block is unmerged, and G12 says live evidence comes from the live server.
Post-merge checks, to run after the operator's merge:

- **L1** — both services serve the merge sha (Render API; web `build-sha`; `/api/version`).
- **L2** — `GET https://voltura-web.onrender.com/` serves `<html lang="es">` and the Spanish title.
- **L3** — `POST /api/calculate` (probe session) with no `Accept-Language` returns a Spanish
  `recommendation`; the same with `Accept-Language: en` returns English; the PDF of that row
  reads `Resumen`, `ene … dic`, `0,267 €/kWh`.
- **L4** — one browser pass: the page opens in Spanish; ES/EN switches it; a reload keeps
  the choice.
- **Tier B** at the real merge (revert proved on a scratch ref; deploy path UNPROVEN).

## ROLLBACK COMMAND

Pre-merge (Tier A, A6): the rollback is **demonstrated available**, not executed — `main` is
`9990fbe`, unchanged; `heatshield/h2b` is unmerged and unpushed. Nothing was deployed, so
nothing needs reverting. After the merge: `git revert -m 1 <merge-sha>`, proved on a scratch
ref under Tier B before the ruling closes. **The deploy-path rollback is UNPROVEN** — A13's
standing debt is carried unchanged, not discharged.

## REFUSAL — H2b.3

```
REFUSAL — H2b.3
Instruction:  Domain vocabulary "from official usage … taken from the Andalusian heat-health
              plan and the CTE, not translated".
Reality:      The Andalusian heat plan (Consejo de Gobierno, 26 Jun 2025 coordination protocol,
              ws040.juntadeandalucia.es …/250625/documentos/8Expediente.pdf) contains none of
              the five terms and never mentions housing. Found elsewhere:
                rehabilitación       — Plan Vive en Andalucía (Decreto 91/2020); Estrategia
                                       Nacional contra la Pobreza Energética 2019–2024
                parque de viviendas  — Plan Vive en Andalucía (Junta plan page)
                pobreza energética   — Estrategia Nacional 2019–2024 (defines it)
                cribado              — no official housing/energy source found
                viviendas difíciles
                  de refrigerar      — press only; no official source found
              CTE not checked: the BOE text needs an operator-approved fetch.
Conflict:     §5 — the task's stated source does not hold what the task says it holds.
Options:      A. Amend the source to Plan Vive + the Estrategia (+ CTE once checked): three
                 terms admitted with citations; the other two wait for a source; H3 needs
                 another word for "screening".
              B. Keep the heat plan as the only source: nothing admitted.
              C. Admit all five, two marked unverified: complete list now; two terms in a
                 procurement-facing product with no official source.
```
Recommendation omitted: the operator's standing instruction (5 Oct) is options and
consequences only. Waiting.

P7 in Spanish is **not** 2b.3 and is done: `P7_FORBIDDEN_ES` in `lib/i18n` (calificación,
clasificación energética, resultado(s) de cumplimiento, certificado de habitabilidad), checked
against every Spanish entry of both catalogs by tests (M10 kills it).

## RESIDUE

- **2b.3 refused, 2b.5 held** — both operator rulings.
- **Spanish copy is a first draft.** Register chosen: impersonal / *usted* (a public
  administration buys). No native review. Needs one before a Spanish buyer reads it.
- **Model-written text stays English:** the Optimizer's explanation and the Assistant. With
  Spanish the default, a Spanish screen shows an English explanation; the Assistant's facts
  quote the **English** UI labels ("Direct Solar") while the Spanish screen says "Solar
  directa". Both belong to the 2b.5 ruling.
- **Registry notes are English data.** For `registry_tariff_pending` / `registry_cost_pending`
  (Spain's install cost is one), English quotes the registry note as before; Spanish states
  the typed reason in Spanish instead. Translating the registry's own notes is a registry
  change, not H2b's. The two English catalog entries for these reasons are present for key
  parity and are not rendered.
- **Carbon `detail` in the provenance record stays English** (not rendered). The 400 message
  built from it is localised from the typed reason.
- **Finding, out of fence, carried into Spanish unchanged:** the ≥100 % recommendation says
  the surplus is "worth {annualSavings × 0.1} in potential grid export". The 0.1 has no
  source (G6), and it contradicts the product's own line that surplus is not valued (D52,
  the "Surplus not used" series). Needs its own ruling and block.
- **Pre-existing, not touched:** History's `item.batteryEfficiency ?? 0.9` (a numeric default,
  G5's class).
- `ar.json` stays unwired; nothing sets `dir="rtl"`.
- `src/locales/*.json` kept as the salvage record; nothing imports them. Deleting them is a
  file deletion (operator-ruled) — not proposed here.
- Toolchain on the executor: Node 24.21.0, pnpm 11.28.5 (local record: 24.18 / 11.18).
- **Clean tree** after this commit; 5 commits on the branch. Re-authored before the first push to his GitHub no-reply address (`elmaroun07-hub@users.noreply.github.com`, as every commit on `main` is): GitHub refused the first push (GH007, private email). Content unchanged — `git diff` against the pre-rewrite tip `457ceed` is empty.

## RULING

**OPEN — pre-merge criteria met for 2b.1, 2b.2, 2b.4 and the gate's mechanism. 2b.3 REFUSED.
2b.5 HELD.** The merge is operator-ruled (§14.2). Before it: the operator's rulings on 2b.3
and 2b.5, or a ruling to merge with both open. After it: L1–L4 and Tier B, then this gate
closes or stays open on what they show.

---

# Post-merge — 7 October 2026

**MERGE:** `d9fd1e6` = `--no-ff` of `bc6f10a` onto `9990fbe`, made and pushed from the cloud
session by the operator's ruling (7 Oct, ~20:03): merge with 2b.3 and 2b.5 still open.
Author/committer `elmaroun07-hub <elmaroun07-hub@users.noreply.github.com>`, as every commit on
`main`. Merge tree == branch tip tree (`git diff bc6f10a d9fd1e6` empty). Pushed
`9990fbe..d9fd1e6` at 20:03:41Z.

**§2 at the merge (Render API, read before the push):** `Voltura-api` and `Voltura-web` both
`autoDeploy: yes`, trigger `commit`, branch `main`, PR previews off; both live on `9990fbe`.

**CI on `main`:** run `37679180276`, build + test green (branch run `37678616846` green before it).

## LIVE EVIDENCE

| | Check | Result |
|---|---|---|
| **L1** | Both services serve the merge | Render API: web `dep-db3ab815efls73c9ah2g` live 20:04:25Z, API `dep-db3ab815efls73c9agt0` live 20:04:38Z, `9990fbe` deploys deactivated. `GET /api/version` → `{"sha":"d9fd1e6","shaFull":"d9fd1e6193…","source":"render"}`. Web `meta build-sha` = `d9fd1e6`. **PASS** |
| **L2** | The page opens in Spanish | Built-in browser, fresh profile state (`voltura.locale` unset): `<html lang="es">`, title "Voltura — Inteligencia energética", nav Calculadora / Historial / Optimizador IA / Asistente energético, button "Calcular ahorro", switcher ES pressed. **PASS** |
| **L3** | A production calculation and its PDF, in Spanish by default | Through the UI, Fuengirola, Málaga, Spain → row **110** (this browser's session, 20:13:26Z). Recommendation: "¡Buen resultado! Su sistema cubre el 77 % de su energía, un ahorro de 1030 € al año. Una batería algo mayor podría acercarle al 100 %." Cards: 3860 kWh · 1030 € · 333 kg · "Datos satelitales de NASA POWER, media 2019–2023" · 0,267 €/kWh (Eurostat 2025-S2) · "Retorno: pendiente", reason in Spanish. Chart months ene … dic; legend Generación / Ahorro / Importación de red / Excedente no aprovechado. Toast "Cálculo completado". PDF of row 110, `Accept-Language: es`: 200 `application/pdf`, text layer read in the page (2 Flate streams, 0 errors): "Informe de ahorro con energía verde", "Generado: 7 de octubre de 2026", Resumen, Resultados, Desglose mensual, Mes, ene … dic; Tarifa eléctrica **0,267 €/kWh**, Orientación del panel **Sur**, Rendimiento de la batería **90 %**, Energía ahorrada al año **3860 kWh**, Ahorro económico anual **1030 €**, Periodo de retorno estimado **pendiente**; no English label anywhere. Same PDF with `Accept-Language: en`: Summary, Results, Monthly Breakdown, Jan … Dec, **€0.267/kWh**, **South**. Figures identical across languages and identical to the suite's Fuengirola pins. **PASS** |
| **L4** | The switch, and that it is remembered | EN → `lang="en"`, title "Voltura — Energy Intelligence", nav Calculator / History / AI Optimizer / Energy Assistant, stored `en`; reload → still English; ES → back to Spanish, stored `es`. **PASS** |

**Probe residue:** production row **110** (calculations), Fuengirola, created by L3 under the
built-in browser's session id. Not deleted — G3's ban on DML stands; listed here so a later
cleanup can name it by primary key. It shows in that browser's History.

## ROLLBACK — Tier B

Merge authorised, drill not: revert computed on scratch ref `scratch/h2b-revert-proof` as
`50733f2` (local to the cloud clone, unpushed). It applies cleanly: 62 files, +421 / −2,896,
the exact mirror of the merge's 62 files, +2,896 / −421; the reverted tree is **identical** to
`9990fbe`'s. Command: `git revert -m 1 d9fd1e6`.
**The deploy-path rollback is UNPROVEN.** A13's standing debt is carried unchanged, not
discharged: no deploy-path rollback has been executed on any block.

## RULING — post-merge

**Gate H2b — CLOSED on its criterion**, with live proof: a string with no Spanish entry fails
the build (shown four ways pre-merge), and production serves the web app, the API's
sentences and the PDF in Spanish by default, English on request.

**Block H2b is NOT complete:** 2b.3 stays **REFUSED** (options A/B/C with the operator) and
2b.5 stays **HELD** (operator's ruling). Whether H3's precondition "H2b closed" is met with
those two open is a judgment, not a check — the operator's to rule (§14.2) before H3 opens,
along with H3's own open question: which municipality first.
