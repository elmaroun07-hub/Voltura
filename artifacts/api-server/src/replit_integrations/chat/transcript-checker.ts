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
    // VPUB (3 Nov 2026): the latitude estimate is gone; the pattern is unchanged.
    truth: "missing or unusable NASA data gives no result; there is no latitude estimate (VPUB)",
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
 * H-ASST-ACC3: the slips H-ASST-ACC2's L2 found live, 7-8 Oct 2026, in both
 * languages (contracts/rulings/h2b.md, "Post-merge - H2b complete"; the lines
 * are in contracts/fixtures/h-asst-acc3/live-lines.json). Learnt from model
 * output, except the two rows marked as renderings, which carry a slip into
 * the language it was not seen in.
 *
 *   N1  the inverse of E1: NASA unusable -> "the calculation stops". Learnt in
 *       English (conversations 87-91, 94) and in Spanish (72, first half).
 *   N2  E1 in words E1's Spanish row did not know: "ausencia total de datos"
 *       -> the latitude estimate (72, second half).
 *   C14 the unsourced legacy carbon factors called official. Learnt in Spanish
 *       (72, 73, 80); the English row is a rendering.
 */
const N1_TRUTH =
  "when NASA does not answer, answers with an error status or sends an unreadable answer, Voltura uses the labelled latitude estimate - the calculation does not stop; it stops only when NASA answers but a month has no value";
const C14_TRUTH =
  "only Spain's (REE, mainland) and the UK's (DESNZ) carbon factors are official; the listed countries get an older factor with no cited source";

export const ACC3_CLAIMS: KnownFalseClaim[] = [
  {
    id: "N1",
    truth: N1_TRUTH,
    pattern:
      /\bnasa\b[^.;*]{0,40}\b(unavailable|not available|cannot be reached|unreachable)\b[^.;*]{0,40}\b(stops?|halts?|ends?|is refused|is rejected|fails?)\b|\bif nasa (does not|doesn't|fails to) (respond|reply|answer)\b[^.;*]{0,40}\b(stops?|halts?|is refused|is rejected|fails?)\b/,
  },
  {
    id: "N1",
    truth: N1_TRUTH,
    // Spanish. The second alternative is a rendering of the English slip.
    pattern:
      /\bsi (la api|la nasa|nasa)( power)? no (responde|contesta)[^.;*]{0,60}(se rechaza|se detiene|se cancela|no hay resultado)|\bdatos de (la )?nasa no (est[aá]n )?disponibles[^.;*]{0,40}(se detiene|se rechaza|no hay resultado)/,
  },
  {
    id: "N2",
    truth: truthOf("E1"),
    pattern: /(ausencia|falta) (total )?de datos[^.;*]{0,60}(recurre|latitud)/,
  },
  {
    id: "C14",
    truth: C14_TRUTH,
    pattern: /factor(es)? (de carbono |de emisi[oó]n |de la red )?oficial(es)?[^.;]{0,60}(una lista|otros pa[ií]ses|varios pa[ií]ses|resto de pa[ií]ses)/,
  },
  {
    id: "C14",
    truth: C14_TRUTH,
    // English: a rendering of the Spanish slip; none was seen in English.
    pattern:
      /\bofficial\b[^.;*]{0,30}\b(carbon |grid[- ]carbon |emission )?factors?\b[^.;*]{0,60}\b(a list|other countries|many (other )?countries|several countries|supported countries)\b/,
  },
];

/**
 * H-ASST-ACC4: the slips H-ASST-ACC3's L2 found live, 8 Oct 2026
 * (contracts/rulings/h-asst-acc3.md, "Post-merge - live"; the lines are in
 * contracts/fixtures/h-asst-acc4/live-lines.json). Learnt from model output,
 * except the rows that carry a slip into the language it was not seen in.
 *
 *   C15 the 27 listed countries dropped: "en cualquier otro país el cálculo se
 *       rechaza" (98, 100-104). English row a rendering.
 *   C14 every location's factor called official, in 97's and 101's words.
 *   E2  "el historial es local al navegador" (103). English row a rendering.
 *   E3  "it only provides / only shows the explanation" (111, 113, 116); the
 *       Spanish row is learnt from H-ASST-ACC2's L3 answer 95, recorded clean
 *       on 8 Oct and reclassified here.
 */
const C15_TRUTH =
  "the 27 listed countries get a full result with an older, unsourced factor; only a country outside Spain, the UK and that list is refused";

export const ACC4_CLAIMS: KnownFalseClaim[] = [
  {
    id: "C15",
    truth: C15_TRUTH,
    // Not when the same sentence has already named the list ("... una lista de
    // países; en cualquier otro país se rechaza ..."): then "any other" is right.
    pattern:
      /(?<!\blista\b[^.\n]{0,160})(\b(en|para) cualquier otro pa[ií]s\b[^.;]{0,30}(rechaz|no (hay|tiene) factor)|\bpara (los )?otros pa[ií]ses\b[^.;]{0,10}el c[aá]lculo se rechaza|\bcualquier otro pa[ií]s no (hay|tiene) factor)/,
  },
  {
    id: "C15",
    truth: C15_TRUTH,
    // English: a rendering of the Spanish slip.
    pattern: /(?<!\blist\b[^.\n]{0,160})\b(in|for) any other country\b[^.;]{0,30}\b(refused|rejected)\b/,
  },
  {
    id: "C14",
    truth: C14_TRUTH,
    pattern: /\bfactor (de carbono )?oficial (de la red )?seg[uú]n (la|su) ubicaci[oó]n/,
  },
  {
    id: "C14",
    truth: C14_TRUTH,
    // English: a rendering.
    pattern: /\bofficial (grid )?(carbon )?factor (for|based on|by) (the |your )?location\b/,
  },
  {
    id: "E2",
    truth: truthOf("E2"),
    pattern: /\bhistorial\b[^.;]{0,20}\b(es|est[aá]|queda) local(es)? (al|en el|en su|del) navegador|\blocal (al|del) navegador\b/,
  },
  {
    id: "E2",
    truth: truthOf("E2"),
    // English: a rendering.
    pattern: /\bhistory\b[^.;]{0,20}\bis (stored )?local to (the|your) browser\b/,
  },
  {
    id: "E3",
    truth: truthOf("E3"),
    pattern: /\b(it|the (ai )?optimi[sz]er)\b only (provides|shows|gives|returns) (the |an |its )?explanation\b/,
  },
  {
    id: "E3",
    truth: truthOf("E3"),
    pattern: /\bs[oó]lo (muestra|proporciona|da|ofrece|devuelve) (la recomendaci[oó]n y )?(su |la )explicaci[oó]n/,
  },
];

/**
 * H-ASST-ACC5: the two slips of H-ASST-QUOTA's live L2 at 36457ba
 * (contracts/evidence/h-asst-quota/l2-probe-36457ba.json).
 *   C16 Voltura said to compute nothing outside the Calculator - 162's closing
 *       summary, verbatim; English row a rendering. The Optimizer computes too.
 *   C17 Voltura said to comply, or not to comply, with a law or standard - the
 *       words of ACC4's 135 ("Voltura no cumple la Ley de IA de la UE"). 166's
 *       "No, Voltura no lo hace." names no law, so only the question gives it
 *       away: the live gate checks the law answer against the catalog sentence.
 */
const C16_TRUTH =
  "Voltura computes in the Calculator and in the AI Optimizer (PV and battery sizes by formula); only the Assistant computes nothing";
const C17_TRUTH = "Voltura makes no claim either way about meeting any law, regulation or standard";

export const ACC5_CLAIMS: KnownFalseClaim[] = [
  {
    id: "C16",
    truth: C16_TRUTH,
    pattern: /\b(sin (realizar|hacer) c[aá]lculos? propios?|no (realiza|hace) (ning[uú]n )?c[aá]lculos?( propios?)?) fuera de la calculadora\b/,
  },
  {
    id: "C16",
    truth: C16_TRUTH,
    // English: a rendering.
    pattern: /\b(without (doing|performing|making)|(does not|doesn't) (do|perform|make)) (any )?(calculations?|computations?)( of its own)? outside the calculator\b/,
  },
  {
    id: "C17",
    truth: C17_TRUTH,
    pattern: /\bvoltura (no )?(cumple|se ajusta)( con)? (a |con )?(la |el |alguna |ninguna )?(ley|reglamento|norma|normativa)\b/,
  },
  {
    id: "C17",
    truth: C17_TRUTH,
    // English: a rendering.
    pattern: /\bvoltura (is (not )?|isn't )(fully )?(eu ai act )?compliant\b|\bvoltura (does not |doesn't )?compl(y|ies) with\b/,
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
  return [...KNOWN_FALSE_CLAIMS, ...LIVE_SLIP_CLAIMS, ...SPANISH_CLAIMS, ...ACC3_CLAIMS, ...ACC4_CLAIMS, ...ACC5_CLAIMS].flatMap(({ id, pattern }) => {
    const m = pattern.exec(t);
    return m ? [{ id, match: m[0] }] : [];
  });
}

/**
 * VPUB, 3 Nov 2026 ("NASA unavailable"): the latitude estimate is gone. When
 * NASA POWER cannot be used, the calculation now stops with a typed 503.
 *
 * Two consequences for the checker:
 *   - N1's "false claim" ("NASA unavailable -> the calculation stops") is now
 *     TRUE, so N1 is retired from the live check.
 *   - Any claim that Voltura estimates from the latitude is now FALSE (V1).
 *     E1 and N2 already flag that claim for missing data and stay.
 *
 * `checkTranscript` is kept exactly as it was: the recorded evidence of the
 * H-ASST-ACC rounds was judged against it, and its suites assert the lines of
 * those rounds. `checkTranscriptNow` is the checker for live runs from VPUB on.
 */
export const RETIRED_BY_VPUB = new Set(["N1"]);

const V1_TRUTH =
  "there is no latitude estimate: when NASA POWER cannot be used, the calculation stops with an error and gives no result";

export const VPUB_CLAIMS: KnownFalseClaim[] = [
  {
    id: "V1",
    truth: V1_TRUTH,
    pattern:
      /\b(estimat\w*|falls? back|fallback)\b[^.;*]{0,50}\b(from|on|by|using) (the )?latitude\b|\blatitude[- ]based (estimates?|fallback|values?)\b|\blatitude (estimates?|fallback)\b/,
  },
  {
    id: "V1",
    truth: V1_TRUTH,
    // Spanish.
    pattern:
      /\b(estima\w*|recurre\w*)\b[^.;*]{0,60}\b(a partir de|por|seg[uú]n|basad[ao]s? en) la latitud\b|\bestimaci[oó]n (basada en la latitud|por latitud|a partir de la latitud)\b|\bestimaci[oó]n se basa (solo |s[oó]lo |[uú]nicamente )?en la latitud\b/,
  },
];

export function checkTranscriptNow(text: string): { id: string; match: string }[] {
  const t = normalise(text);
  return [
    ...KNOWN_FALSE_CLAIMS,
    ...LIVE_SLIP_CLAIMS,
    ...SPANISH_CLAIMS,
    ...ACC3_CLAIMS,
    ...ACC4_CLAIMS,
    ...ACC5_CLAIMS,
    ...VPUB_CLAIMS,
  ]
    .filter(({ id }) => !RETIRED_BY_VPUB.has(id))
    .flatMap(({ id, pattern }) => {
      const m = pattern.exec(t);
      return m ? [{ id, match: m[0] }] : [];
    });
}

