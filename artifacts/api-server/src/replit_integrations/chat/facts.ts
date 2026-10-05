import { CARBON_INTENSITY_BY_COUNTRY, COUNTRY_KEY_BY_ISO } from "../../lib/carbon-intensity";
import { ROI_INFLATION, ROI_YEARS } from "../../lib/emissions/countries";
import { SIZING_DEFAULTS } from "../../lib/sizing";

/**
 * H-ASST-ACC: what the Assistant may say Voltura does, one sentence per
 * feature, each written from the code (A.1,
 * contracts/evidence/h-asst-accuracy/a1-claims.md) and pinned to it by
 * facts.test.ts. The system prompt's feature list is this array, verbatim.
 *
 * A constant the code exports is imported, never restated. A fact that lives in
 * data or in an unexported literal is written out here and pinned by a test
 * that fails when the code moves (A-b). Change a sentence only together with
 * its pin, and with feature-map.test.ts, which maps each line to the code.
 */

/**
 * What /api/calculate asks NASA POWER for (routes.ts, fetchNasaPower). Not
 * exported there, so stated here and pinned against the request the route
 * actually sends.
 */
export const NASA_FACT = { resolution: "monthly", start: 2019, end: 2023 } as const;

const titleCase = (key: string) => key.replace(/\b\w/g, (c) => c.toUpperCase());

/** Countries the unsourced legacy table still prices, by the codes the lookup accepts. */
export const LEGACY_CARBON_COUNTRIES: string[] = [...new Set(Object.values(COUNTRY_KEY_BY_ISO))]
  .filter((key) => key in CARBON_INTENSITY_BY_COUNTRY)
  .sort()
  .map(titleCase);

const listed = (names: string[]) => `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const percent = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

export const VOLTURA_FACTS: { id: string; text: string }[] = [
  {
    id: "geocoder",
    text: "Finds the location the user types with the OpenStreetMap Nominatim geocoder.",
  },
  {
    id: "nasa",
    text:
      `Takes monthly solar irradiance and temperature for that point from NASA POWER, averaged over ${NASA_FACT.start}-${NASA_FACT.end}: twelve ${NASA_FACT.resolution} values, not hourly data. ` +
      "Temperature affects only the modelled household consumption, not the solar generation. " +
      // H-ASST-ACC2 (E1): the estimate's trigger stands on its own, ahead of and
      // apart from what missing data does - the model fused the old pair.
      "The latitude estimate is used in one case only: when NASA cannot be used at all - it does not reply, replies with an error status, or sends a reply Voltura cannot read. " +
      "Voltura then estimates irradiance and temperature from the latitude and labels the result as that estimate, in the API response and on the page. " +
      "When NASA does reply but marks months as having no data, or leaves months out, there is no estimate and no result: the calculation stops with an error.",
  },
  {
    id: "simulation",
    text: "Simulates a full year hour by hour (8,760 hours): solar generation, household consumption spread from the annual kWh the user enters over a typical residential profile, and battery charge and discharge.",
  },
  {
    id: "orientation",
    text: "Adjusts generation for panel orientation (south, east, west, north) and tilt angle.",
  },
  {
    id: "monthly-chart",
    text: 'Shows the annual energy saved in kWh - the consumption covered by solar or the battery - and a monthly chart with four series: Generation, Savings, Grid Import and "Surplus not used" (solar energy neither the home nor the battery could take, which Voltura puts no value on). The monthly chart has no battery series.',
  },
  {
    id: "energy-mix",
    text: "Shows the annual energy mix: Direct Solar, From Battery and Grid Import, as shares of consumption.",
  },
  {
    id: "carbon",
    text:
      "Estimates the CO2 avoided with a location-based grid carbon factor. " +
      "Spain: the official REE factor, for mainland addresses only; an address in the Balearic or Canary Islands, Ceuta or Melilla, or a Spanish address whose region cannot be told, has no factor yet and the calculation is refused. " +
      "United Kingdom: the official DESNZ factor. " +
      `${listed(LEGACY_CARBON_COUNTRIES)}: an older factor with no cited source, which the results page does not mark as unsourced. ` +
      "Any other country has no factor, and the whole calculation is refused: no energy, money or CO2 result.",
  },
  {
    id: "tariff",
    text:
      "Prices the saving only for Spain and the UK. " +
      "There, a tariff the user types is always used. " +
      "With no tariff typed, Spain uses Eurostat's 2025-S2 national household average while that figure is current. " +
      // H-ASST-ACC2 (P2): the UK case in one sentence, condition included.
      "The UK has no national tariff in Voltura, so a UK saving is priced only when the user types a tariff. " +
      "For any other country there is no money figure, even if the user types a tariff.",
  },
  {
    id: "payback",
    text:
      `Computes a payback period and a ${ROI_YEARS}-year ROI curve (savings rising ${percent(ROI_INFLATION)} a year) when the saving is priced and an installation cost is known: ` +
      "the cost the user types (Spain and the UK only), or, in the UK only, DESNZ's average cost for PV-only systems up to 10 kW, which is not used when a battery is included. " +
      "Spain has no sourced installation cost yet. Without a cost, payback shows as pending.",
  },
  {
    id: "pdf",
    // H-ASST-ACC2 (P1): the inputs it prints, named, and the one it does not.
    text:
      "Produces a downloadable PDF report of a calculation: the location and the inputs (annual usage, PV size, battery capacity and efficiency, tariff, panel orientation and roof angle), the result figures and the monthly table. " +
      "The installation cost is not printed, and the PDF has no charts.",
  },
  {
    id: "history",
    // H-ASST-ACC2 (E2): where the calculations are, and what the browser keeps.
    text:
      "Keeps a history of past calculations. The calculations themselves are stored on Voltura's server; this browser keeps only a random id that links it to them. " +
      "Another browser or device, or cleared site data, gets a new id and so an empty history; there are no user accounts.",
  },
  {
    id: "optimizer",
    text:
      // H-ASST-ACC2 (E3): it returns numbers; the AI's part is the prose beside them.
      "The AI Optimizer returns a recommended PV size in watts and a battery capacity in kWh as numbers, computed by a formula from the user's annual usage and location (NASA irradiance), using a fixed standard daily usage profile, not the user's own. " +
      `The formula sizes the array so its yearly generation equals ${percent(SIZING_DEFAULTS.coverageTarget)} of yearly use, and the battery for the profile's night-time share. ` +
      "The AI writes only the explanation shown with those numbers; it cannot change them.",
  },
  {
    id: "assistant",
    text: "This Energy Assistant, for questions about the results and about solar and batteries in general.",
  },
];
