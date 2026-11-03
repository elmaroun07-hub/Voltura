import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * H-ASST-ACC5 (operator ruling, 23 Oct 2026, "Fix both slips"): the two
 * Spanish slips of H-ASST-QUOTA's live L2 at 36457ba - 162 (Voltura said to
 * compute nothing outside the Calculator) and 166 (Voltura said not to meet the
 * EU AI Act). The law question gets one catalog sentence to copy; the compute
 * guideline names the Assistant; the checker learns both.
 */
vi.mock("./storage", () => ({ chatStorage: {} }));
vi.mock("../../lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/llm")>()), llmModel: () => "stub-model", getLlmClient: () => ({}) }));

const { SYSTEM_PROMPTS } = await import("./routes");
const { serverCatalog } = await import("../../i18n");
const { checkTranscript } = await import("./transcript-checker");

const LAW = { en: serverCatalog.en["chat.lawAnswer"], es: serverCatalog.es["chat.lawAnswer"] } as const;

describe("H-ASST-ACC5 — the law answer is one sentence to copy", () => {
  it("says Voltura makes no claim either way, in both languages", () => {
    expect(LAW.en).toBe("Voltura makes no claim about whether it meets any law, regulation or standard.");
    expect(LAW.es).toBe("Voltura no hace ninguna afirmación sobre si se ajusta o no a alguna ley, reglamento o norma.");
  });

  it.each(["en", "es"] as const)("the %s prompt quotes it once, as the exact answer, and not the other language's", (lang) => {
    const prompt = SYSTEM_PROMPTS[lang];
    expect(prompt.split(`"${LAW[lang]}"`).length - 1).toBe(1);
    expect(prompt).not.toContain(LAW[lang === "en" ? "es" : "en"]);
    expect(prompt).toContain(lang === "en" ? "answer with exactly this sentence and nothing else:" : "responda exactamente con esta frase y nada más:");
  });

  it.each(["en", "es"] as const)("the %s law sentence is itself clean to the checker", (lang) => {
    expect(checkTranscript(LAW[lang])).toEqual([]);
  });
});

describe("H-ASST-ACC5 — the compute guideline names the Assistant", () => {
  it("in English", () => {
    const prompt = SYSTEM_PROMPTS.en;
    expect(prompt).toContain(
      "- You, the Assistant, compute no figures yourself: for figures, the user runs the Calculator or the AI Optimizer, where Voltura computes them.",
    );
    expect(prompt).not.toContain("You compute nothing yourself");
  });

  it("in Spanish", () => {
    const prompt = SYSTEM_PROMPTS.es;
    expect(prompt).toContain(
      "- Usted, el Asistente, no calcula ninguna cifra: para obtener cifras, el usuario usa la Calculadora o el Optimizador IA, donde Voltura las calcula.",
    );
    expect(prompt).not.toContain("Usted no calcula nada");
  });
});

describe("H-ASST-ACC5 — the checker learns both slips", () => {
  it("C16: 162's summary, verbatim, and an English rendering", () => {
    const es162 =
      "En resumen, Voltura realiza todo el proceso de localización, obtención de datos climáticos, simulación horaria, ajuste de orientación, generación de resultados energéticos, estimación de CO₂, valoración económica (solo en España y Reino Unido), cálculo de rentabilidad, generación de informes PDF y almacenamiento de historial, sin realizar cálculos propios fuera de la Calculadora.";
    expect(checkTranscript(es162).map((f) => f.id)).toContain("C16");
    expect(checkTranscript("Voltura does not perform any calculations outside the Calculator.").map((f) => f.id)).toContain("C16");
  });

  it("C17: ACC4's 135, verbatim, and English renderings", () => {
    expect(checkTranscript("Voltura no cumple la Ley de IA de la UE.").map((f) => f.id)).toContain("C17");
    expect(checkTranscript("Voltura is not EU AI Act compliant.").map((f) => f.id)).toContain("C17");
    expect(checkTranscript("Voltura complies with the EU AI Act.").map((f) => f.id)).toContain("C17");
  });

  it("neither prompt trips the checker", () => {
    expect(checkTranscript(SYSTEM_PROMPTS.en)).toEqual([]);
    expect(checkTranscript(SYSTEM_PROMPTS.es)).toEqual([]);
  });

  it("over tonight's 28 live answers it flags 162 and nothing else", () => {
    const file = path.resolve(import.meta.dirname, "../../../../../contracts/evidence/h-asst-quota/l2-probe-36457ba.json");
    const rows = JSON.parse(readFileSync(file, "utf8")) as { conv: number; answer: string }[];
    expect(rows).toHaveLength(28);
    const flagged = rows.filter((r) => checkTranscript(r.answer).length > 0).map((r) => r.conv);
    expect(flagged).toEqual([162]);
  });
});
