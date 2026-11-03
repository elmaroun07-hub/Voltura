import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { P7_FORBIDDEN_ES } from "@workspace/i18n";
import { serverCatalog } from "../../i18n";
import { COUNTRY_KEY_BY_ISO } from "../../lib/carbon-intensity";
import { ROI_INFLATION, ROI_YEARS } from "../../lib/emissions/countries";
import { SIZING_DEFAULTS } from "../../lib/sizing";
import { checkTranscript } from "./transcript-checker";
import {
  FACTS_BY_LOCALE,
  LEGACY_CARBON_COUNTRIES,
  LEGACY_CARBON_COUNTRIES_ES,
  NASA_FACT,
  VOLTURA_FACTS,
  VOLTURA_FACTS_ES,
} from "./facts";

/**
 * H2b 2b.5: the Spanish facts say what the English facts say.
 *
 * facts.test.ts and facts-acc2.test.ts pin each ENGLISH sentence to the code
 * that makes it true. This file ties each Spanish sentence to its English one:
 * same ids in the same order, the same numbers, the same number of sentences,
 * and - claim by claim - the English clause those pins assert next to the
 * Spanish clause that says it. Change a claim on one side only and a row here
 * fails. Labels the screen shows are checked against the web catalog's
 * Spanish table, so the Assistant names things as the Spanish screen does.
 */

const en = (id: string) => VOLTURA_FACTS.find((f) => f.id === id)!.text;
const es = (id: string) => VOLTURA_FACTS_ES.find((f) => f.id === id)!.text;
const source = (repoPath: string) =>
  readFileSync(new URL(`../../../../../${repoPath}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const WEB_CATALOG = source("artifacts/green-energy-calculator/src/i18n/catalog.ts");

/** Every number in a sentence, as a value: 8,760 and 8760 are both 8760; 1.5 and 1,5 are both 1.5. */
const numbers = (text: string, lang: "es" | "en") =>
  [...text.matchAll(/\d+(?:[.,]\d+)*/g)]
    .map(([n]) => Number(lang === "en" ? n.replace(/,/g, "") : n.replace(/\./g, "").replace(",", ".")))
    .sort((a, b) => a - b);
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim() !== "").length;

/** The English clause a pin asserts, and the Spanish clause that must say the same. */
const CLAUSES: [id: string, english: string, spanish: string][] = [
  ["geocoder", "OpenStreetMap Nominatim geocoder", "geocodificador Nominatim de OpenStreetMap"],
  ["nasa", `averaged over ${NASA_FACT.start}-${NASA_FACT.end}: twelve monthly values, not hourly data`, `promediadas en ${NASA_FACT.start}-${NASA_FACT.end}: doce valores mensuales, no datos horarios`],
  ["nasa", "Temperature affects only the modelled household consumption, not the solar generation.", "La temperatura solo afecta al consumo doméstico modelizado, no a la generación solar."],
  // VPUB: the NASA failures in one sentence (the latitude estimate is gone).
  ["nasa", "If NASA POWER cannot be used (it does not answer, answers with an error status, sends an answer Voltura cannot read, or leaves one or more months without a value), there is no estimate and no result: the calculation stops with an error.", "Si NASA POWER no se puede usar (no contesta, contesta con un estado de error, envía una respuesta que Voltura no puede leer o deja uno o más meses sin valor), no hay estimación ni resultado: el cálculo se detiene con un error."],
  ["simulation", "(8,760 hours)", "(8760 horas)"],
  ["simulation", "spread from the annual kWh the user enters over a typical residential profile", "repartido a partir de los kWh anuales que introduce el usuario según un perfil residencial típico"],
  ["simulation", "and battery charge and discharge", "y la carga y descarga de la batería"],
  ["orientation", "panel orientation (south, east, west, north) and tilt angle", "orientación de los paneles (sur, este, oeste, norte) y el ángulo de inclinación"],
  ["monthly-chart", "the consumption covered by solar or the battery", "el consumo cubierto por la energía solar o por la batería"],
  ["monthly-chart", "a monthly chart with four series:", "un gráfico mensual con cuatro series:"],
  ["monthly-chart", "which Voltura puts no value on", "a la que Voltura no asigna ningún valor"],
  ["monthly-chart", "The monthly chart has no battery series.", "El gráfico mensual no tiene ninguna serie de batería."],
  ["energy-mix", "as shares of consumption", "como porcentajes del consumo"],
  ["carbon", "Spain: the official REE factor, for mainland addresses only", "España: el factor oficial de REE, solo para direcciones peninsulares"],
  ["carbon", "has no factor yet and the calculation is refused", "todavía no tiene factor y el cálculo se rechaza"],
  ["carbon", "United Kingdom: the official DESNZ factor.", "Reino Unido: el factor oficial del DESNZ."],
  ["carbon", "an older factor with no cited source - not an official figure - which the results page does not mark as unsourced", "un factor más antiguo sin fuente citada - no es una cifra oficial -, que la página de resultados no señala como sin fuente"],
  ["carbon", "Only the Spanish (REE) and UK (DESNZ) factors are official.", "Solo son oficiales los factores de España (REE) y del Reino Unido (DESNZ)."],
  // H-ASST-ACC4 (C15)
  ["carbon", "The 27 countries in that list do get a full result, with that older factor.", "Los 27 países de esa lista sí obtienen un resultado completo, con ese factor más antiguo."],
  ["carbon", "A country that is not Spain, the UK or one of those 27 countries has no factor, and the whole calculation is refused: no energy, money or CO2 result.", "Un país que no sea España, el Reino Unido ni uno de esos 27 países no tiene factor, y se rechaza todo el cálculo: ningún resultado de energía, dinero ni CO2."],
  ["tariff", "Prices the saving only for Spain and the UK.", "Valora el ahorro en dinero solo para España y el Reino Unido."],
  ["tariff", "There, a tariff the user types is always used.", "Allí, siempre se usa la tarifa que escribe el usuario."],
  ["tariff", "With no tariff typed, Spain uses Eurostat's 2025-S2 national household average while that figure is current.", "Si no se escribe ninguna tarifa, España usa la media nacional de los hogares de Eurostat de 2025-S2 mientras esa cifra esté vigente."],
  ["tariff", "The UK has no national tariff in Voltura, so a UK saving is priced only when the user types a tariff.", "El Reino Unido no tiene tarifa nacional en Voltura, así que el ahorro en el Reino Unido solo se valora cuando el usuario escribe una tarifa."],
  ["tariff", "For any other country there is no money figure, even if the user types a tariff.", "Para cualquier otro país no hay cifra en dinero, aunque el usuario escriba una tarifa."],
  ["payback", `a ${ROI_YEARS}-year ROI curve (savings rising ${Math.round(ROI_INFLATION * 1000) / 10}% a year)`, `una curva de rentabilidad a ${ROI_YEARS} años (con el ahorro subiendo un ${String(Math.round(ROI_INFLATION * 1000) / 10).replace(".", ",")} % al año)`],
  ["payback", "when the saving is priced and an installation cost is known", "cuando el ahorro está valorado en dinero y se conoce un coste de instalación"],
  ["payback", "the cost the user types (Spain and the UK only)", "el coste que escribe el usuario (solo en España y el Reino Unido)"],
  ["payback", "in the UK only, DESNZ's average cost for PV-only systems up to 10 kW, which is not used when a battery is included", "solo en el Reino Unido, el coste medio del DESNZ para sistemas solo fotovoltaicos de hasta 10 kW, que no se usa cuando se incluye una batería"],
  ["payback", "Spain has no sourced installation cost yet.", "España todavía no tiene un coste de instalación con fuente."],
  ["payback", "Without a cost, payback shows as pending.", "Sin coste, el retorno aparece como pendiente."],
  ["pdf", "the location and the inputs", "la ubicación y los datos introducidos"],
  ["pdf", "the result figures and the monthly table. The installation cost is not printed, and the PDF has no charts.", "las cifras de resultado y la tabla mensual. El coste de instalación no se imprime, y el PDF no tiene gráficos."],
  ["history", "The calculations themselves are stored on Voltura's server, not in the browser; this browser keeps only a random id that links it to them.", "Los cálculos se almacenan en el servidor de Voltura, no en el navegador; este navegador solo guarda un identificador aleatorio que lo vincula con ellos."],
  ["history", "Another browser or device, or cleared site data, gets a new id and so an empty history; there are no user accounts.", "Otro navegador u otro dispositivo, o borrar los datos del sitio, da un identificador nuevo y, por tanto, un historial vacío; no hay cuentas de usuario."],
  ["optimizer", "The AI Optimizer returns a recommended PV size in watts and a battery capacity in kWh as numbers, computed by a formula", "El Optimizador IA devuelve como números una potencia FV recomendada en vatios y una capacidad de batería en kWh, calculadas con una fórmula"],
  ["optimizer", "from the user's annual usage and location (NASA irradiance)", "a partir del consumo anual del usuario y de su ubicación (irradiancia de la NASA)"],
  ["optimizer", "using a fixed standard daily usage profile, not the user's own", "con un perfil de consumo diario estándar y fijo, no el del propio usuario"],
  ["optimizer", `so its yearly generation equals ${SIZING_DEFAULTS.coverageTarget * 100}% of yearly use, and the battery for the profile's night-time share`, `para que su generación anual sea igual al ${SIZING_DEFAULTS.coverageTarget * 100} % del consumo anual, y la batería para la parte nocturna del perfil`],
  ["optimizer", "The AI Optimizer's numbers come from that formula; a language model then writes the explanation text shown beside them, and cannot change the numbers.", "Los números del Optimizador IA salen de esa fórmula; después, un modelo de lenguaje escribe el texto de explicación que se muestra junto a ellos, y no puede cambiar los números."],
  ["assistant", "which answers only questions about what Voltura does", "que solo responde preguntas sobre lo que hace Voltura"],
];

/** Screen labels the facts quote: [web catalog key, English entry, Spanish entry, fact id]. */
const LABELS: [key: string, english: string, spanish: string, id: string][] = [
  ["series.generation", "Generation", "Generación", "monthly-chart"],
  ["series.savings", "Savings", "Ahorro", "monthly-chart"],
  ["series.gridImport", "Grid Import", "Importación de red", "monthly-chart"],
  ["series.surplus", "Surplus not used", "Excedente no aprovechado", "monthly-chart"],
  ["mix.solar", "Direct Solar", "Solar directa", "energy-mix"],
  ["mix.battery", "From Battery", "Desde la batería", "energy-mix"],
  ["mix.grid", "Grid Import", "Importación de red", "energy-mix"],
  ["nav.optimizer", "AI Optimizer", "Optimizador IA", "optimizer"],
  ["nav.assistant", "AI Assistant", "Asistente de IA", "assistant"],
];

describe("2b.5 — the Spanish facts say what the English facts say", () => {
  it("same thirteen ids, same order", () => {
    expect(VOLTURA_FACTS_ES.map((f) => f.id)).toEqual(VOLTURA_FACTS.map((f) => f.id));
    expect(FACTS_BY_LOCALE).toEqual({ es: VOLTURA_FACTS_ES, en: VOLTURA_FACTS });
  });

  it.each(VOLTURA_FACTS.map((f) => [f.id]))("%s: the same numbers and the same number of sentences", (id) => {
    expect(numbers(es(id), "es")).toEqual(numbers(en(id), "en"));
    expect(sentences(es(id))).toBe(sentences(en(id)));
  });

  it.each(CLAUSES)("%s: %s", (id, english, spanish) => {
    expect(en(id)).toContain(english);
    expect(es(id)).toContain(spanish);
  });

  it("every fact has at least one clause row", () => {
    const covered = new Set(CLAUSES.map(([id]) => id));
    expect(VOLTURA_FACTS.map((f) => f.id).filter((id) => !covered.has(id))).toEqual([]);
  });

  it.each(LABELS)("label %s: quoted as the Spanish screen shows it", (key, english, spanish, id) => {
    // The Spanish table comes first in the catalog file; its entry is the Spanish one.
    const esAt = WEB_CATALOG.indexOf(`"${key}": "${spanish}",`);
    const enAt = WEB_CATALOG.indexOf(`"${key}": "${english}",`);
    expect(esAt, key).toBeGreaterThan(-1);
    expect(enAt, key).toBeGreaterThan(esAt);
    expect(es(id)).toContain(spanish);
    expect(en(id)).toContain(english);
  });

  it("monthly-chart: the four series, named and ordered as on the Spanish chart", () => {
    expect(es("monthly-chart")).toContain("cuatro series: Generación, Ahorro, Importación de red y «Excedente no aprovechado»");
    expect(es("energy-mix")).toContain("Solar directa, Desde la batería e Importación de red");
  });

  it("pdf: the inputs are named with the Spanish PDF's own labels", () => {
    const t = serverCatalog.es;
    for (const label of [t["pdf.pvSize"], t["pdf.orientation"], t["pdf.roofAngle"]]) {
      expect(es("pdf")).toContain(label.charAt(0).toLowerCase() + label.slice(1));
    }
    expect(es("pdf")).toContain(`capacidad y ${t["pdf.batteryEfficiency"].toLowerCase()}`);
  });

  it("carbon: the same countries, named in Spanish from their ISO code, in Spanish order", () => {
    const isoOf = Object.fromEntries(Object.entries(COUNTRY_KEY_BY_ISO).map(([iso, key]) => [key, iso]));
    const region = new Intl.DisplayNames(["es"], { type: "region" });
    const expected = LEGACY_CARBON_COUNTRIES.map((name) => region.of(isoOf[name.toLowerCase()].toUpperCase())!).sort((a, b) =>
      a.localeCompare(b, "es"),
    );
    expect(LEGACY_CARBON_COUNTRIES_ES).toEqual(expected);
    expect(LEGACY_CARBON_COUNTRIES_ES).toHaveLength(LEGACY_CARBON_COUNTRIES.length);
    expect(es("carbon")).toContain(
      `${LEGACY_CARBON_COUNTRIES_ES.slice(0, -1).join(", ")} y ${LEGACY_CARBON_COUNTRIES_ES.at(-1)}: un factor más antiguo sin fuente citada`,
    );
    // No English country name leaks into the Spanish list.
    for (const name of ["Germany", "United States", "South Korea", "Netherlands", "Morocco"]) expect(es("carbon")).not.toContain(name);
  });

  it("E1 in Spanish: the no-data case is not worded as 'missing' data either", () => {
    expect(es("nasa")).not.toMatch(/falta|faltan|ausente/i);
  });

  it("P7: no Spanish fact uses a word a reader would take as a grade or a compliance result", () => {
    for (const f of VOLTURA_FACTS_ES) for (const re of P7_FORBIDDEN_ES) expect(re.test(f.text), f.id).toBe(false);
  });

  it("the Spanish facts carry none of the known false claims, in either language's patterns", () => {
    for (const f of VOLTURA_FACTS_ES) expect(checkTranscript(f.text), f.id).toEqual([]);
  });

  it("no English sentence was left in the Spanish facts", () => {
    for (const f of VOLTURA_FACTS_ES) expect(f.text, f.id).not.toMatch(/\b(the|and|which|with|only|when|there is)\b/);
  });
});
