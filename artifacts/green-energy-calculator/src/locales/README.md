# Locale strings — salvaged at H1.x, mapped at H2b

`en.json`, `es.json`, `ar.json`, copied verbatim from the old Flask GreenCalc app's
`artifacts/greencalc/static/lang/`. That directory has since been removed from
the tree; it is preserved at tag `greencalc-final` (commit `a464bb5`).

**H2b (2b.2): the matching strings were carried into `src/i18n/catalog.ts`,
which is now the only place the app reads words from.** These files are kept
as the salvage record, not loaded. Nothing imports them.

## What was carried over, and how

The keys were written for the **Flask GreenCalc app**, not for this one, so the
mapping was by meaning, not by name. Title Case was normalised to sentence
case, which is how Spanish writes labels.

| Salvaged key | Salvaged Spanish | Catalog key | Catalog Spanish |
|---|---|---|---|
| `nav_calculator` | Calculadora | `nav.calculator` | Calculadora |
| `form_location` | Ubicación | `common.location` | Ubicación |
| `form_location_placeholder` | ej. Madrid, España | `calc.locationPlaceholder` | Ciudad, país (p. ej., Madrid, España) |
| `form_annual_kwh` | Consumo Anual (kWh) | `calc.annualUsage` | Consumo anual (kWh) |
| `form_pv_size` | Tamaño Sistema FV (W) | `calc.pvSize` | Tamaño del sistema FV (W) |
| `form_battery` | Capacidad Batería (kWh) | `calc.battery` | Capacidad de batería: {kwh} kWh |
| `form_tilt` | Inclinación Panel (grados) | `calc.tilt` | Inclinación del panel: {deg}° |
| `form_orientation` | Orientación Panel | `calc.orientation` | Orientación del panel |
| `form_tariff` | Tarifa Eléctrica (por kWh) | `calc.tariff` | Tarifa eléctrica (por kWh) |
| `form_submit` | Calcular Ahorros | `calc.submit` | Calcular ahorro |
| `results_annual_savings` | Ahorros Anuales | `results.annualSavings` | Ahorro anual |
| `results_co2` | CO₂ Reducido | `results.co2` | Reducción de CO₂ |
| `results_payback` | Período de Retorno | `pdf.payback` (server) | Periodo de retorno estimado |
| `export_pdf` | Exportar Informe PDF | `results.downloadPdf` | Descargar informe completo en PDF |

## Not carried over, and why

- `nav_home`, `nav_dashboard`, `nav_predict`, `nav_compliance` — no such page in
  this app. `nav_compliance` ("Cumplimiento IA") would also be P7-adjacent.
- `hero_title`, `hero_subtitle`, `hero_description`, `footer` — they name
  **GreenCalc**, which is not the product and is never to be called it.
- `form_efficiency` ("Eficiencia del Sistema") — this app's field is the
  battery's round-trip efficiency, a different quantity.
- `results_annual_saved`, `results_net_25yr`, `btn_start`, `btn_dashboard`,
  `results_title` — no matching element in this app.
- `ar.json` — Arabic is not a language this block ships, and nothing in the app
  sets `dir="rtl"`.

The Spanish in the catalog, salvaged or new, is a first draft. No translator
reviewed it; a native review before a Spanish buyer reads it is a residue of
H2b, not something these files can certify.
