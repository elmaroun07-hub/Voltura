/**
 * H-ASST-ACC TF3: flags claims about Voltura that are known to be false.
 *
 * A test utility, imported by no route. Every pattern is one row of A.1's claim
 * table (contracts/evidence/h-asst-accuracy/a1-claims.md): the FALSE claims, the
 * three slips from H-ASST-D16-N3's live transcripts (K1-K3), and the PARTIALs,
 * which the operator ruled count as misstatements too (5 Oct 2026).
 *
 * It only knows the errors already seen, so it never closes a gate on its own
 * (A-e): the live transcripts are read claim by claim as well.
 */

export interface KnownFalseClaim {
  id: string;
  /** What the code actually does, for the report. */
  truth: string;
  pattern: RegExp;
}

export const KNOWN_FALSE_CLAIMS: KnownFalseClaim[] = [
  {
    id: "C9",
    truth: "outside Spain, the UK and the legacy table the whole calculation is refused; nothing notes 'no figure' beside a result",
    pattern: /\b(elsewhere|otherwise|other countries|everywhere else)\b[^.;*]{0,60}\b(notes?|states?|shows?|gives?|gets?|get)\b[^.;*]{0,30}\b(no figure|no factor)\b/,
  },
  {
    id: "K2",
    truth: "other countries get a legacy unsourced factor, or the calculation is refused - never 'a generic statement'",
    pattern: /\bgeneric statement\b/,
  },
  {
    id: "C11",
    truth: "Spain has no sourced installation cost; only the UK does",
    pattern: /\b(sourced|official|national)\b[^.;*]{0,40}\bcosts?\b[^.;*]{0,30}\bspain\b/,
  },
  {
    id: "C13",
    truth: "the Optimizer uses a fixed standard daily profile, never the user's own load pattern",
    pattern: /(\b(your|the user'?s) (own )?(daily )?(load|usage) (pattern|profile)\b|(?<!(standard|fixed) )\bdaily load pattern\b)/,
  },
  {
    id: "K1",
    truth: "NASA POWER data is a 2019-2023 monthly mean, not hourly",
    pattern: /\bhourly[- ]averaged\b|\bhourly (solar )?(irradiance|radiation) data\b/,
  },
  {
    id: "K3",
    truth: "the monthly chart has no battery series; battery energy is only in the annual mix",
    pattern: /\bmonth[^.;*]{0,60}\bbattery[- ](supplied|delivered|discharged?)\b/,
  },
  {
    id: "C6",
    truth: "round-trip efficiency is the user's input, 50-100%, 90% only by default",
    pattern: /(≈|~|about |around |roughly )\s*90\s*%\s*round[- ]trip|\bround[- ]trip\b[^.;*]{0,20}(≈|~)\s*90\s*%/,
  },
  {
    id: "C10",
    truth: "the UK has no sourced national tariff; only Spain does",
    pattern: /\b(national|sourced)\b[^.;*]{0,20}\b(tariff|default)\b[^.;*]{0,30}\b(spain\s*(\/|and|or)\s*(the )?uk|for (the )?uk)\b/,
  },
  {
    id: "C12",
    truth: "the PDF holds the inputs, the result rows and the monthly table - no charts",
    pattern: /\bpdf\b[^.;*]{0,40}\bwhole calculation\b/,
  },
];

/**
 * H-ASST-ACC2: the five errors H-ASST-ACC's live transcripts showed
 * (conversations 46-53, 57). Kept as their own list so H-ASST-ACC's TF3 runs
 * unchanged over its own; TF6 (transcript-checker-acc2.test.ts) exercises
 * every pattern here against the verbatim lines in contracts/fixtures/h-asst-acc2/.
 */
export const LIVE_SLIP_CLAIMS: KnownFalseClaim[] = [
  {
    id: "E1",
    truth: "missing NASA data gives no result; the latitude estimate runs only when NASA does not reply, errors, or sends an unreadable reply",
    pattern: /\b(data|values?|months?) (is |are )?missing\b[^.;*]{0,40}\b(falls? back|latitude)\b|\blatitude\b[^.;*]{0,40}\bif (the )?nasa data (is |are )?missing\b/,
  },
  {
    id: "E2",
    truth: "calculations are stored on Voltura's server; the browser keeps only the id",
    pattern: /\bstored locally\b|\blocally in (your|the) browser\b|\bstores? (a |the |your )?(\*\*)?history\b[^.;]{0,60}\bin (your|the) browser\b/,
  },
  {
    id: "E3",
    truth: "the Optimizer returns the PV size and battery capacity as numbers from a formula; the AI writes only the explanation",
    pattern: /\bonly provides the (recommendation text|explanation)\b|\bnot a (numeric|numerical) result\b|\bnot a full calculation\b/,
  },
  {
    id: "P1",
    truth: "the PDF prints the location and seven inputs, not the installation cost",
    pattern: /\bpdf\b[^.;*]{0,60}\ball (the |your |of the )?inputs\b/,
  },
  {
    id: "P2",
    truth: "a typed UK tariff prices the saving; only an untyped UK saving stays unpriced",
    pattern: /\buk\b[^.*]{0,40}\b(using|uses|with) (a |your )?(user[- ]provided|typed|own) tariff\b[^.*]{0,60}\b(unpriced|no monetary value|not priced)\b/,
  },
];

/**
 * H2b (2b.5): the same claims, as a Spanish answer would make them. The
 * Assistant now answers in Spanish by default, and an English pattern never
 * fires on Spanish text, so without these the check would pass a Spanish
 * transcript by not reading it. Same ids as the English rows: a finding is the
 * claim, whatever the language.
 *
 * Unlike the rows above, these were not learnt from Spanish transcripts - none
 * exists yet. Each is the English row's error as Spanish words it, tested
 * against Spanish renderings of the recorded English lines
 * (contracts/fixtures/h2b-5/es-claim-lines.json). A-e stands doubly: the live
 * read of a Spanish transcript is the gate, and its slips are added here.
 *
 * JavaScript's \b only knows ASCII letters, so no \b touches an accented one.
 */
function truthOf(id: string): string {
  const row = [...KNOWN_FALSE_CLAIMS, ...LIVE_SLIP_CLAIMS].find((c) => c.id === id);
  if (!row) throw new Error(`transcript-checker: no English claim ${id}`);
  return row.truth;
}

export const SPANISH_CLAIMS: KnownFalseClaim[] = [
  {
    id: "C9",
    truth: truthOf("C9"),
    pattern: /(en otros (lugares|pa[ií]ses|sitios|casos)|en el resto( de (los )?pa[ií]ses)?|en los dem[aá]s (pa[ií]ses|casos)|de lo contrario)[^.;*]{0,60}\b(indica|muestra|se[nñ]ala|anota|da|dice)\b[^.;*]{0,30}(sin cifra|ninguna cifra|no hay cifra|sin factor|ning[uú]n factor|no hay factor)/,
  },
  {
    id: "K2",
    truth: truthOf("K2"),
    pattern: /(declaraci[oó]n|afirmaci[oó]n|indicaci[oó]n) gen[eé]rica|mensaje gen[eé]rico/,
  },
  {
    id: "C11",
    truth: truthOf("C11"),
    pattern: /\bcostes?\b[^.;*]{0,40}(con fuente|oficial(es)?|nacional(es)?)[^.;*]{0,30}espa[nñ]a|(con fuente|oficial(es)?)[^.;*]{0,10}\bcostes?\b[^.;*]{0,30}espa[nñ]a/,
  },
  {
    id: "C13",
    truth: truthOf("C13"),
    pattern: /(\bsu\b|del usuario)[^.;*]{0,10}(propio )?(patr[oó]n|perfil) (diario )?de (carga|consumo)(?! (diario )?(est[aá]ndar|fijo))|perfil de (carga|consumo) (diario )?(propio|del usuario)|(?<!(est[aá]ndar|fijo) )patr[oó]n de carga diari[oa]/,
  },
  {
    id: "K1",
    truth: truthOf("K1"),
    pattern: /promediad[oa]s? por horas?|(irradiancia|radiaci[oó]n)( solar)? (horaria|por horas)|datos horarios de (irradiancia|radiaci[oó]n)/,
  },
  {
    id: "K3",
    truth: truthOf("K3"),
    pattern: /\b(mes|meses|mensual|mensuales)\b[^.;*]{0,60}energ[ií]a (suministrada|aportada|entregada|descargada) (por|desde) la bater[ií]a/,
  },
  {
    id: "C6",
    truth: truthOf("C6"),
    pattern: /(≈|~|aprox(imadamente|\.)? ?|alrededor del? |cerca del? |en torno al? )\s*90\s*% de (eficiencia|rendimiento) (de )?ida y vuelta|ida y vuelta[^.;*]{0,20}(≈|~)\s*90\s*%/,
  },
  {
    id: "C10",
    truth: truthOf("C10"),
    pattern: /\btarifa\b( nacional| con fuente| por defecto)+[^.;*]{0,30}(espa[nñ]a\s*(\/|y|o)\s*(el )?reino unido|para el reino unido)/,
  },
  {
    id: "C12",
    truth: truthOf("C12"),
    pattern: /\bpdf\b[^.;*]{0,40}(todo el c[aá]lculo|c[aá]lculo completo)/,
  },
  {
    id: "E1",
    truth: truthOf("E1"),
    pattern: /\bsi (faltan|no hay) (los )?datos( de la nasa)?[^.;*]{0,60}(recurre|latitud)|latitud[^.;*]{0,40}\bsi (faltan|no hay) (los )?datos/,
  },
  {
    id: "E2",
    truth: truthOf("E2"),
    pattern: /(guardad|almacenad)[oa]s? (localmente|en local)|localmente en (su|el) navegador|\b(guarda|almacena)n? (un |el |su )?historial[^.;]{0,60}en (su|el|este) navegador|historial[^.;]{0,40}se (guarda|almacena)[^.;]{0,20}en (su|el|este) navegador/,
  },
  {
    id: "E3",
    truth: truthOf("E3"),
    pattern: /solo (proporciona|ofrece|da) (el texto de la recomendaci[oó]n|la explicaci[oó]n)|no (es )?un resultado num[eé]rico|no (es )?un c[aá]lculo completo/,
  },
  {
    id: "P1",
    truth: truthOf("P1"),
    pattern: /\bpdf\b[^.;*]{0,60}todos (los |sus )?datos( introducidos| de entrada)?/,
  },
  {
    id: "P2",
    truth: truthOf("P2"),
    pattern: /reino unido[^.*]{0,40}\b(con|usando|usa) (una |su )?(tarifa (propia|del usuario|introducida)|propia tarifa)[^.*]{0,100}(sin valorar|sin valor (econ[oó]mico|monetario)|no se valora)/,
  },
];

/**
 * Models write non-breaking hyphens, narrow and no-break spaces and curly
 * quotes (A0 has all four). Fold them so a pattern written with ASCII matches.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

export function checkTranscript(text: string): { id: string; match: string }[] {
  const t = normalise(text);
  return [...KNOWN_FALSE_CLAIMS, ...LIVE_SLIP_CLAIMS, ...SPANISH_CLAIMS].flatMap(({ id, pattern }) => {
    const m = pattern.exec(t);
    return m ? [{ id, match: m[0] }] : [];
  });
}
