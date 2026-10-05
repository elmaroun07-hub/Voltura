# H-ASST-ACC A.1 — A0's claims against the code at `0192cd6`

Read 5 Oct 2026 by the executor, from code at the tip at block open (`0192cd6`). Line
numbers are at that commit.

**Where A0 came from.** It is operator-supplied. It matches none of conversations 36–44: no
saved transcript contains "long‑term monthly" or "elsewhere it notes no figure".

**Legend.** TRUE: the code does what the claim says. PARTIAL: true in part, or true only
with a condition the claim leaves out. FALSE: the code does otherwise. "API" means
`artifacts/api-server/src`, and "web" means `artifacts/green-energy-calculator/src`.

| # | Claim (A0, or the K-slip) | Verdict | Code that decides it |
|---|---|---|---|
| C1 | Location found via OpenStreetMap | **TRUE** | API `routes/routes.ts:80`: Nominatim `search`, `limit=1`, first match only. No match gives a 422 `geocode_failed` (`:520`) and no result |
| C2 | Long-term monthly irradiance **and temperature** from NASA POWER | **TRUE** (with "long-term" meaning a five-year mean) | `routes.ts:365`: `temporal/monthly`, parameters `ALLSKY_SFC_SW_DWN,T2M`; `:139-140` 2019–2023, averaged per month. Temperature is used only in the consumption model (`:57-60`, `tempEffect`), never in generation (`:731`) |
| C3 | "or a latitude-based fallback" | **TRUE**. The block's table expected SUSPECT, and the code says otherwise | `routes.ts:412` `fallbackIrradiance`, used at `:588-589` when NASA doesn't answer (HTTP error `:374`, malformed body `:377,380`, request failure). The result is labelled `fallback-lat`, and the web shows "Estimated from latitude — NASA data unavailable" (web `lib/provenance.ts:36-37`). NASA's fill value or missing months don't fall back: they give a typed 422 (`:557`). **§5 note C3 (below)** |
| C4 | Full year hour by hour; typical household profile from annual kWh | **TRUE** | `routes.ts` `simulate8760`: 12 months × days × 24 h. Consumption is `mlPredictConsumption` (`:57`) scaled to the annual kWh (`:720`): modelled, not metered |
| C5 | Orientation (S/E/W/N) and tilt adjust generation | **TRUE** | `routes.ts:67` S 1.0, E/W 0.87, N 0.70; `:71` −0.3 % per degree from 35°; `:72` floor 0.4 |
| C6 | Battery "≈90 % round-trip" | **PARTIAL** | It's an input, not a property. `lib/db/src/schema/schema.ts:71` gives 0.5–1.0, default 0.9; the web slider is `min 0.5 max 1.0` (`CalculatorForm.tsx:156`), default 0.9 (`:27`). The loss is split evenly between charging and discharging (`routes.ts:691`). The battery starts empty (`:693`) and charges only from solar surplus (`:740`) |
| C7 | Monthly charts of generation, **self-consumption, grid import** and surplus | **TRUE** in substance. The block's table expected SUSPECT, and the code says otherwise | web `ResultsDisplay.tsx:56-59` draws four series: **Generation, Savings, Grid Import, Surplus not used**. "Savings" is consumption minus grid import (`routes.ts:769`), the energy covered by solar or the battery, which is self-consumption. The chart is titled "Monthly Generation vs Consumption", but it draws no consumption series (a web label issue, out of fence; noted) |
| C8 | Mix of Direct Solar, From Battery, Grid Import | **TRUE** | `routes.ts:1134` `breakdown`, from recorded flows, as shares of consumption; web `ResultsDisplay.tsx:46-48` |
| C9 | CO₂ from official data for Spain and the UK; "elsewhere it notes no figure" | **FALSE** | Spain gets REE's **peninsular** factor only. Balearic, Canary, Ceuta and Melilla addresses, or a Spanish address with no region code, get **400 `carbon_factor_pending`** (`routes.ts:1083`). The UK gets the DESNZ generation factor. **27 further countries** get an **unsourced legacy factor** that is used in the result (`lib/carbon-intensity.ts`, e.g. US 0.386: row 108). Any other country gets **400 `unknown_carbon_country`** (`routes.ts:1071`): **the whole calculation is refused**, with no energy or money result. It doesn't "note no figure" alongside a result |
| C10 | Own tariff, or national where available; otherwise no monetary value | **PARTIAL** | `lib/emissions/money.ts:112`: outside the registry (Spain and the UK) there is **no money figure even when the user types a tariff**; the country check comes before the user tariff (`:115`). For Spain and the UK the typed tariff wins. With none typed, Spain uses Eurostat 2025-S2 while it is current (`data/sources/countries.yaml:68-85`, review by 2027-02-12). **The UK's national tariff is `pending`** (`:122-123`), so a UK saving is unpriced unless the user types a tariff |
| C11 | Payback and 25-year ROI from the supplied cost "or sourced PV-only costs for Spain/UK" | **FALSE** | `countries.yaml:87-88` **Spain `installCost: pending`**; the UK is `current`, DESNZ banded, 0–4 and 4–10 kW (`:136-152`). The registry cost is refused when a battery is specified (`money.ts:159`) or the size is outside the bands (`:187`). A typed cost is used for Spain and the UK only (`:153-154`). `ROI_YEARS` 25, `ROI_INFLATION` 0.015 (`countries.ts:398-399`) |
| C12 | PDF report "of the whole calculation"; history "in the same browser" | **PARTIAL** | The PDF (`routes.ts` PDF route) holds the inputs, the results rows, and the monthly table (`:988`). It has **no charts**: not the mix, not the ROI curve. History is `GET /api/history` by `X-Session-Id` (`:1224`); the id is a `crypto.randomUUID()` kept in this browser's `localStorage` (web `lib/queryClient.ts:3,55-56`). So "the same browser" is true, but a different browser or profile, or cleared site data, shows a different history. There are no accounts |
| C13 | Optimizer tailored to "your daily load pattern" | **FALSE** | web `pages/Optimizer.tsx:21,37`: the page always sends the fixed `DEFAULT_PATTERN`, labelled "Standard Profile", and the user can't edit it. Only annual usage and location vary. Sizing is a formula (`lib/sizing.ts`, `coverageTarget` 1.0, `:57`); the model writes prose only |
| K1 | "hourly-averaged solar irradiance" (conv 38) | **FALSE** | `routes.ts:365`: monthly data, a 2019–2023 mean. The hourly shape is a fixed bell curve (`SOLAR_HOURLY_PROFILE`), not data |
| K2 | other countries get "a generic statement" (conv 37, 39, 40) | **FALSE** | as C9: a legacy unsourced factor for 27 countries, otherwise the calculation is refused |
| K3 | the monthly chart shows "battery-supplied energy" (conv 37) | **FALSE** | `ResultsDisplay.tsx:56-59`: no battery series. Battery energy appears only in the annual mix (`:47`). The PDF table has Generated, Consumed, Saved, Grid Import and Surplus not used (`routes.ts`, PDF route), and no battery column either |

**FALSE list, the input to TF3's checker patterns:** C9, C11, C13, K1, K2, K3. A0 itself
contains C9, C11 and C13 (the K-slips are from conversations 37–40).

**Temperature parameter** (A.3): the chat completion call (`replit_integrations/chat/routes.ts`,
the `create` call at `:183`) sets **no `temperature`**, so the provider default applies.

## The source of A0's FALSE claims: the prompt, self-reported

A0's three FALSE claims, and most of the partials, come from H-ASST-D16-N3's own prompt
lines (`9f6c2cd`). The executor wrote them from `money.ts`'s code paths, not from the
registry data. The model restated them faithfully:

| Prompt line (H-ASST-D16-N3) | What is wrong | A0 / K |
|---|---|---|
| "…official sourced figures for Spain … and the UK …, an older unsourced table for some other countries, and otherwise a plain statement that it has no figure for that place." | the last case refuses the whole calculation | C9, K2 |
| "…or a sourced national tariff for Spain or the UK." | the UK tariff is `pending`; a typed tariff counts only for Spain and the UK | C10 |
| "…or a sourced PV-only cost for Spain or the UK." | Spain's cost is `pending` | C11 |
| "The AI Optimizer recommends … from annual usage, a daily load pattern and NASA irradiance." | the pattern is a fixed standard profile | C13 |

H-ASST-D16-N3's L2-A passed on its stated criterion (no off-list feature). But that criterion
couldn't catch a wrong **detail** in an on-list line, and the executor's own ruling didn't
catch these four lines either.

## §5 note C3 — the latitude fallback is live (recorded, not changed)

The block asks for this as a note "since it would breach G5", with a ticket.

The fallback is not a `||` default. It is a labelled branch that runs only when NASA gives no
answer. It reports `irradianceSource: "fallback-lat"`, and the web says so in words. **A11
(25 Aug) deliberately kept it**: "the existing labelled latitude fallback, which is not a
silent default", pinned by Gate A3.5, and the code comment at `routes.ts:149-151` repeats the
point. It still produces a figure from a formula (`6.5 − 0.06 × |lat|`, seasonal cosine)
rather than from data. Whether that sits under G5 or under A11's ruling is the operator's
call.

No ticket was opened. Opening one would contradict A11's standing ruling without a new
ruling.
