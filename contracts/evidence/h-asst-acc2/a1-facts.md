# H-ASST-ACC2 A.1 — the five sentences, from the code at `dc2aa67`

Read 5 Oct 2026, at the tip at block open (`dc2aa67`). Line numbers are at that commit. "API"
means `artifacts/api-server/src`, and "web" means `artifacts/green-energy-calculator/src`.

## The 13 feature facts: the L2 standard (material, ruled 5 Oct 2026)

Every L2 annotation names one of these ids. Their text is `VOLTURA_FACTS` in
`replit_integrations/chat/facts.ts`.

| # | id | Covers |
|---|---|---|
| 1 | `geocoder` | Nominatim finds the location |
| 2 | `nasa` | NASA POWER monthly 2019–2023; temperature feeds consumption only; the latitude estimate and when it runs; no result on missing data (**E1**) |
| 3 | `simulation` | 8,760 hours; consumption from annual kWh over a typical profile; battery cycling |
| 4 | `orientation` | orientation and tilt adjust generation |
| 5 | `monthly-chart` | annual kWh saved; the four monthly series; no battery series |
| 6 | `energy-mix` | Direct Solar, From Battery, Grid Import as shares of consumption |
| 7 | `carbon` | REE for mainland Spain; pending islands refused; DESNZ for the UK; 27 legacy countries; refusal elsewhere |
| 8 | `tariff` | pricing only for Spain and the UK; typed tariff wins; Spain's Eurostat default; the UK has none (**P2**) |
| 9 | `payback` | payback and the 25-year curve; the typed cost; the UK registry cost; Spain has none |
| 10 | `pdf` | what the PDF prints and omits (**P1**) |
| 11 | `history` | where calculations are kept and what the browser keeps (**E2**) |
| 12 | `optimizer` | the numbers it returns, how they're computed, what the AI writes (**E3**) |
| 13 | `assistant` | this Assistant |

The battery-efficiency and currency lines are **guidelines**, not feature facts. Under the
ruled standard, an error about them is recorded, not failed.

## The five sentences

| | Code that decides it | Old sentence (`341d0d3`) | Why the model misread it |
|---|---|---|---|
| **E1** `nasa` | NASA's fill value or absent months give `nasaDataFailureToHttp`, then a **422**, and no result (`routes.ts:557`; `readNasaSeries` `:316-339`). The latitude estimate (`fallbackIrradiance`, `:588-590`) runs **only** when `nasaData` is null: HTTP non-2xx (`:374`), a body with no `parameter` or no series (`:377,380`), a non-numeric value (`:324`, `non-finite-value`, not fatal), or a request with no response (`:407`). It is labelled `fallback-lat`, and the web shows "Estimated from latitude — NASA data unavailable" (web `lib/provenance.ts:36-37`) | "If NASA reports missing data …, there is no result. If NASA gives no usable answer (…), Voltura estimates …" | the two cases sat side by side, and "missing" bled into the second |
| **E2** `history` | `storage.createCalculation` inserts the row on the server, with its `sessionId` (`storage.ts:30`; `routes.ts:1173`). `/api/history` reads rows by `sessionId` (`routes.ts:1224`, `storage.ts:49-53`). The browser keeps only `voltura.sessionId`, a `crypto.randomUUID()` in `localStorage` (web `lib/queryClient.ts:3,53-56`) | "Keeps a history of past calculations tied to an id stored in this browser …" | it never said where the calculations are |
| **E3** `optimizer` | `/api/optimize` returns `optimalPv: sized.sizing.pvWatts` and `optimalBattery: sized.sizing.batteryKwh` (`routes.ts:1330-1331`) from `sizePvAndBattery` (`:1257`, `lib/sizing.ts`). The model supplies only `explanation` (`:1332`), and `parseOptimizePayload` rejects an explanation that carries a number not in the facts (`optimize-payload.ts`). The web shows both numbers (web `pages/Optimizer.tsx`, "Recommended PV" and "Battery Storage") | "… A formula sizes the array …; the AI only writes the explanation." | "only writes the explanation" read as "the Optimizer only gives text" |
| **P1** `pdf` | the summary rows (`routes.ts:873-882`) are Location, Annual Energy Usage, PV System Size, Battery Capacity, Battery Efficiency, Electricity Tariff, Panel Orientation and Roof Angle. **No installation cost** is printed anywhere; it enters only through the net row (`:940`). There are results rows and the monthly table, and no image or path drawing | "its inputs, the result figures and the monthly table" | "its inputs" read as "all inputs" |
| **P2** `tariff` | outside the registry there is no price even with a typed tariff (`money.ts:112`). Inside it, a typed tariff is always used (`:115`). Spain's registry tariff is used while current (`:122-125`; `countries.yaml:68-85`); the **UK's is `pending`** (`countries.yaml:122-123`) | "…, and the UK has no sourced tariff yet, so a UK saving stays unpriced." | the clause dropped the condition "if none is typed" |

**Corrected sentences** (the text in `facts.ts` after A.3):

- **nasa:** "Takes monthly solar irradiance and temperature for that point from NASA POWER,
  averaged over 2019-2023: twelve monthly values, not hourly data. Temperature affects only
  the modelled household consumption, not the solar generation. The latitude estimate is used
  in one case only: when NASA cannot be used at all - it does not reply, replies with an error
  status, or sends a reply Voltura cannot read. Voltura then estimates irradiance and
  temperature from the latitude and labels the result as that estimate, in the API response
  and on the page. When NASA does reply but marks months as having no data, or leaves months
  out, there is no estimate and no result: the calculation stops with an error."
- **history:** "Keeps a history of past calculations. The calculations themselves are stored on
  Voltura's server; this browser keeps only a random id that links it to them. Another browser
  or device, or cleared site data, gets a new id and so an empty history; there are no user
  accounts."
- **optimizer:** "The AI Optimizer returns a recommended PV size in watts and a battery capacity
  in kWh as numbers, computed by a formula from the user's annual usage and location (NASA
  irradiance), using a fixed standard daily usage profile, not the user's own. The formula
  sizes the array so its yearly generation equals 100% of yearly use, and the battery for the
  profile's night-time share. The AI writes only the explanation shown with those numbers; it
  cannot change them."
- **pdf:** "Produces a downloadable PDF report of a calculation: the location and the inputs
  (annual usage, PV size, battery capacity and efficiency, tariff, panel orientation and roof
  angle), the result figures and the monthly table. The installation cost is not printed, and
  the PDF has no charts."
- **tariff:** "Prices the saving only for Spain and the UK. There, a tariff the user types is
  always used. With no tariff typed, Spain uses Eurostat's 2025-S2 national household average
  while that figure is current. The UK has no national tariff in Voltura, so a UK saving is
  priced only when the user types a tariff. For any other country there is no money figure,
  even if the user types a tariff."

The other eight facts are unchanged: A.1 found no misstatement traced to them.

## Self-reported: E2 was under-counted in H-ASST-ACC's ruling

That ruling (`aba05a5`) lists E2 at conversations 46, 49, 53 and 57. Read again for the
fixture, **all nine** "What is Voltura?" answers (46–53 and 57) state that the history is
stored in the browser:
- 46, 49 and 53 say it with "locally";
- 47, 48, 50, 51, 52 and 57 say it with "Stores a history of past calculations in
  your/the browser".

The verdict there (L2 FAIL) is unchanged. The count was wrong. The fixture
`contracts/fixtures/h-asst-acc2/failing-lines.json` carries all 22 failing lines verbatim:
E1 ×8, E2 ×9, E3 ×3, P1 ×1, P2 ×1.

## Interpretation, stated

TF7 reads "TF1–TF4 and B1's pins pass, with only the feature-map key text of the five lines
changed". The fence puts "their tests and pins" IN. TF1 (`facts.test.ts`) asserts sentence
text for these five facts, so those **text** assertions are updated to the new sentences.
Every **code** assertion in TF1 is unchanged, and so are TF2, TF3, the feature map's logic
and B1's pin. Recorded here so the operator can rule otherwise.
