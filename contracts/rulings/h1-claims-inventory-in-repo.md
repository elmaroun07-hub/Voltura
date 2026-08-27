# H1.1 — Claims inventory, in-repo half

**TASK** — H1.1, in-repo half only, per A10. The external half (LinkedIn, ENISA) is the
operator's; Rising UP was killed 24 Aug 2026 and is shelved.
**SCOPE** — `artifacts/greencalc/templates/*`, `artifacts/greencalc/static/lang/*`, `docs/`
**DATE** — 2026-08-27 · branch `heatshield/h1`
**STATUS** — **INVENTORY ONLY. NOTHING FIXED.** No template, locale or doc was edited.

**Method.** Every factual claim — a statement a reader could check — is listed with its
`path:line` and the `path:line` of the code that does or does not support it. Ranges were
verified by *executing* the generator with its own seed, not by reading it. Advice
("consult a professional") and UI labels are not factual claims and are excluded.

| Verdict | Count |
|---|---|
| **SUPPORTED** | **34** |
| **UNSUPPORTED** | **5** |
| **CONTRADICTED** | **11** |
| Total | 50 |

---

## CONTRADICTED (11) — the code does something else

| # | Claim | Claim at | Code says | Code at |
|---|---|---|---|---|
| C1 | "8760-hour simulation" as a GreenCalc feature | `templates/index.html:7`, `:19` | **GreenCalc runs no hourly simulation.** `8760` appears only as `n_samples` for the RandomForest training set, and as annual hours multiplying a wind capacity factor | `models/ml_model.py:38`, `models/energy_model.py:271` |
| C2 | "1.5% annual inflation adjustment" | `templates/index.html:50` | `inflation_rate = 0.02` — **2%**, in all three places | `models/energy_model.py:285`, `:446`, `:467` |
| C3 | "grid carbon intensity data for 35+ countries" | `templates/index.html:55` | **32 countries** (33 entries, one is `DEFAULT`) | `data/grid_carbon_intensity.json`, loaded `models/energy_model.py:26` |
| C4 | irradiance training range "3.0–7.0 kWh/m²/day" | `templates/model_info.html:61` | Observed **2.096–5.237** | `models/ml_model.py:135-136` |
| C5 | temperature training range "-10°–35°C" | `templates/model_info.html:62` | Observed **−0.526–34.093**. Nothing generates −10 | `models/ml_model.py:140` |
| C6 | household_size range "1–8" | `templates/model_info.html:63` | `rng.integers(1, 7)` is exclusive of the high bound → **1–6**, six distinct values | `models/ml_model.py:141` |
| C7 | consumption range "500–50,000 kWh/yr" | `templates/model_info.html:64` | Clip bound is 500–50,000 but the generator is `normal(4500, 1500)`; observed max **9,681**. The upper bound never binds | `models/ml_model.py:137-138` |
| C8 | dead integrations "pull a second OpenAI client and two env vars (`AI_INTEGRATIONS_OPENAI_*`) into the bundle" | `docs/VOLTURA-GROUND-TRUTH.md:234` | **`AI_INTEGRATIONS` appears 0 times in `dist/index.mjs`.** esbuild traces from `src/index.ts` and the modules are unreferenced, so they were always tree-shaken out | verified at Gate H-S; `artifacts/api-server/build.mjs:17-23` |
| C9 | "three complete integration packages ship in `replit_integrations/` (`gpt-audio`, `gpt-4o-mini-transcribe`, `gpt-image-1`…)" | `docs/VOLTURA-GROUND-TRUTH.md:231-233` | **`audio/` and `image/` were deleted** under A14. Only `chat/` and `batch/` remain | commit `594ce68` |
| C10 | "sets `roiYears: 7.5` unconditionally. The model is never asked for it" | `docs/VOLTURA-GROUND-TRUTH.md:172` | **`roiYears` and `7.5` are both absent from shipped source.** Independently confirmed by Gate H0's rendered-DOM probe (`has7point5Years: false`) | `contracts/rulings/h0-gate-h0.md` |
| C11 | "Authentication, accounts, **sessions**, authorization — none, anywhere" | `docs/VOLTURA-GROUND-TRUTH.md:217` | Session **scoping** exists and is enforced at four read sites plus the PDF route. "Authentication" and "authorization" remain true; "sessions" does not | `chat/routes.ts:39`, `routes/routes.ts:444`, `:638`, `:288` |

**C4–C7 are one defect with four faces.** `model_info.html` is presented as EU AI Act
**Article 10 training-data documentation**. Every one of its four numeric ranges overstates
the data the model actually saw. A reader using that table to decide whether their location
is in distribution is being given wrong bounds on the artefact that exists to tell them.

**C8–C11 are staleness in `docs/`, not defects in code.** That document is dated 19 Aug and
describes a repository that has since changed — twice by this session's own work. It is an
audit snapshot, and it is being read as current.

---

## UNSUPPORTED (5) — nothing in the repository establishes them

| # | Claim | Claim at | Why unsupported |
|---|---|---|---|
| U1 | "EU AI Act Compliant (Limited Risk, Article 50)" | `templates/base.html:28` | A **legal conclusion**. The repository holds no risk classification, no conformity assessment, and no record of who determined "Limited Risk". The Article 50 transparency *surface* is real and reachable — disclaimer `base.html:28-31`, model card, feedback, override, delete-my-data — but a surface is evidence of effort, not a finding of compliance. This is P7-adjacent: a self-asserted compliance status shown to a public-sector reader. |
| U2 | Same claim, footer | `templates/index.html:34` | As U1 |
| U3 | Same claim, localised — "EU AI Act Compliant" / "Conforme a la Ley de IA de la UE" | `static/lang/en.json` (`footer`), `static/lang/es.json` (`footer`) | As U1, and now in three languages. `ar.json` carries it too |
| U4 | "Calibrated for residential PV only (**100W–20,000W**)" | `templates/model_info.html:122` | The clip at `models/ml_model.py:143` bounds *outputs* to `[100, 20000]`, so the numbers have a source — but observed training targets are **219–8,344**. Clipping an output is not calibrating a model; above ~8.3 kW the model is extrapolating and the sentence says the opposite |
| U5 | GDPR consent modal implies a functional control | `templates/base.html:39-78` | The dialog writes `sessionStorage.gdpr_consent` and closes. **Nothing reads that flag** — NASA is fetched regardless. `docs/VOLTURA-GROUND-TRUTH.md:203` already records this; it is listed here because the *user-facing* claim is what 1.1 inventories |

---

## SUPPORTED (34)

**`templates/index.html`** — NASA irradiance data `:7` (`energy_model.py:129-130`, 2019–2023) ·
ML predictions `:7`,`:24` (`ml_model.py:70`,`:211`) · 25-year ROI `:29` (`energy_model.py:445`) ·
tilt and orientation adjustment `:45` (`energy_model.py:176-185`) · payback and installation
cost `:50` (`energy_model.py:284`).

**`templates/compliance.html`** — RandomForestRegressor, 50 trees, max depth 10 `:14`
(`ml_model.py:70-71`, exact) · predicts hourly consumption in kWh `:18` (`ml_model.py:87`) ·
8,760 synthetic hourly records `:22` (`ml_model.py:38`) · no PII `:22` (`ml_model.py:38-63`,
generator is pure synthetic arrays) · the four input features and their units `:27-30`
(`ml_model.py:87`) · synthetic-data limitation `:40` · SHAP explanations `:75`,`:90`
(`ml_model.py:92-99`, `shap.TreeExplainer`).

**`templates/model_info.html`** — gradient boosting for optimal PV wattage `:14`
(`ml_model.py:211`) · month 1–12 `:59` (`ml_model.py:139`) · latitude 28°–60° `:60`
(`ml_model.py:134`; observed 28.017–59.982) · regional MAE warning above 15% `:96`
(`routes/calculator.py:215`, `> 0.15`) · accuracy degrades outside 28°–60° `:123` ·
underrepresented above 60° and below 28° `:83-84` · wind uses a simplified capacity factor
`:124` (`energy_model.py:270`).

**`templates/base.html`** — "Powered by NASA POWER API" `:28` (`energy_model.py:129-130`).

**`templates/results.html`** — 5% discount, 2% tariff inflation `:153`,`:245`
(`energy_model.py:285-286`) · €1,200/kWp `:245` (`energy_model.py:284`) — **caveat below** ·
90% confidence interval `:181` (`ml_model.py:215-218`, α=0.1/0.9) · >15% regional MAE `:86` ·
NASA-unavailable latitude-band fallback, stated as lower accuracy `:94` · "physics equations,
not ML predictions" on the no-ML path `:78` · carbon tracker scope limited to engine plus ML,
"not full request lifecycle" `:276`.

**`static/lang/*`** — NASA irradiance data (`hero_description`, en/es/ar) · AI-optimised
estimates (`hero_subtitle`, en/es/ar).

**`docs/VOLTURA-GROUND-TRUTH.md`** — `simulate8760()` is a real hour-by-hour loop `:69`
(**verified**: `routes.ts:405-407` is 12 months × days-in-month × 24 hours = 8,760 iterations) ·
GreenCalc fetches NASA 2019–2023 `:130` (`energy_model.py:129-130`) · `lib/cte` has 72 passing
tests `:39`,`:161` (verified this session) · a missing or zero optimiser field shows the user
5,000 W and 10 kWh `:177-178` (`optimize-payload.ts:46-47`) · installation cost at
`energy_model.py:284` `:198`.

---

## Caveats a fixer must not lose

1. **Two installation-cost formulas.** `results.html:245` documents €1,200/kWp, which matches
   `energy_model.py:284`. A **second, different** formula lives at `energy_model.py:478`:
   `(pv_w/1000)*900 + battery*500 + wind*1200 + 1200`. The claim is supported by one of them.
   Which one reaches the user was not traced here. P5 ("one engine") is at stake, and any fix
   to the claim must resolve the duplication first or it will document the wrong formula.

2. **C1 and the doc's `simulate8760` are not in conflict.** Voltura (TypeScript) genuinely runs
   8,760 hourly steps. GreenCalc (Flask) does not. `index.html` is GreenCalc's landing page
   claiming Voltura's feature. The two applications are being described in each other's terms,
   which is C2's shape as well — 1.5% is Voltura's constant (`routes.ts`, `INFLATION = 0.015`)
   printed on GreenCalc's page where the model uses 2%.

3. **`index.html:50` also contradicts `results.html:153` inside GreenCalc itself** — 1.5% on the
   landing page, 2% on the results page. A reader who visits both is shown two different
   inflation assumptions for the same calculation.

4. **H2 archives GreenCalc.** Nine of the eleven contradictions are in `artifacts/greencalc/`.
   Fixing prose in an application scheduled for deletion may be the wrong spend (§14) — but
   **U1–U3 are the exception**: a self-asserted "EU AI Act Compliant" badge is live on a public
   URL now, in three languages, and is the one class here with legal exposure rather than
   accuracy exposure. That decision is the operator's.
