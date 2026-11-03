import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { checkTranscript } from "./transcript-checker";

/**
 * H-ASST-ACC TF2 and the prompt's assembly.
 *
 * Read from the request the route actually sends to the provider, as
 * system-prompt.test.ts does: the system turn, and the completion's
 * `temperature`. The prompt's feature list must be the facts module, line for
 * line, and the prompt must carry the rule that keeps the model to it.
 *
 * 2b.5: in both languages. The request's Accept-Language picks the prompt;
 * each language's list is that language's facts, and each carries the rule.
 */

const SESSION = "55555555-5555-4555-8555-555555555555";
const STORED = [
  { role: "user", content: "What is Voltura?" },
  { role: "assistant", content: "earlier answer" },
  { role: "user", content: "And the PDF?" },
];

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getMessagesByConversation: async () => STORED,
    createMessage: async () => ({}),
  },
}));

let sent: { messages: { role: string; content: string }[]; temperature?: number } | undefined;

vi.mock("../../lib/llm", () => ({
  llmModel: () => "stub-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async (args: { messages: { role: string; content: string }[]; temperature?: number }) => {
          sent = args;
          return (async function* () {
            yield { choices: [{ delta: { content: "ok" } }] };
          })();
        },
      },
    },
  }),
}));

const { registerChatRoutes } = await import("./routes");
const { FACTS_BY_LOCALE } = await import("./facts");
const { serverCatalog } = await import("../../i18n");

type Lang = "es" | "en";

// H-ASST-QUOTA: the message route allows 5 per client per 15 minutes, and this
// file sends more than that. Each request is its own client (a distinct IPv6
// documentation-range address in CF-Connecting-IP, the header the limiter keys
// on), so the limit never decides what this file checks.
let clientSeq = 0;
const nextClient = () => `2001:db8:${(++clientSeq).toString(16)}::1`;

async function send(lang: Lang) {
  sent = undefined;
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/conversations/1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": SESSION, "Accept-Language": lang, "CF-Connecting-IP": nextClient() },
    body: JSON.stringify({ content: "And the PDF?" }),
  });
  await res.text();
  await new Promise((resolve) => server.close(resolve));
  expect(res.status).toBe(200);
  expect(sent).toBeDefined();
  return sent!;
}

const PROMPT: Record<Lang, { heading: string; rule: string[]; language: string }> = {
  en: {
    heading: "What Voltura does - the complete list:",
    rule: [
      "Describe Voltura's features only with the facts in this list, and add no detail of your own about how Voltura works, what it shows or where it applies.",
      "If you do not know whether or how Voltura does something, say plainly that you do not know.",
    ],
    language: "- Always answer in English.",
  },
  es: {
    heading: "Lo que hace Voltura - la lista completa:",
    rule: [
      "Describa las funciones de Voltura solo con los datos de esta lista, y no añada ningún detalle propio sobre cómo funciona Voltura, qué muestra o dónde se aplica.",
      "Si no sabe si Voltura hace algo, o cómo lo hace, diga claramente que no lo sabe.",
    ],
    language: "- Responda siempre en español y trate al usuario de usted.",
  },
};

const LANGS: Lang[] = ["es", "en"];

/**
 * H-ASST-ACC3 (operator rulings, 8 Oct 2026): a question outside Voltura's
 * jobs gets exactly the catalog's chat.outOfScope sentence, and the two facts
 * the model restated wrongly live are copied word for word.
 */
const SCOPE: Record<
  Lang,
  { refusal: string; scope: string; verbatim: string; gone: RegExp; inScope: string; lawInScope: string }
> = {
  en: {
    refusal: serverCatalog.en["chat.outOfScope"],
    // H-ASST-ACC4: "Any other question", after the in-scope rule below.
    scope:
      "Any other question - general solar or battery advice, other products or services, or any other subject - gets exactly this answer and nothing else:",
    // H-ASST-ACC4 (C15): the whole carbon entry, list included.
    verbatim:
      "When an answer says what happens when NASA POWER fails, copy the Case 1 and Case 2 sentences from the list word for word. When an answer mentions carbon factors, or which countries get a CO2 result, copy the whole carbon entry from the list word for word, the list of countries included.",
    // H-ASST-ACC4 (over-refusal, 106/107/110).
    inScope:
      "A question asking whether Voltura does, computes, shows, offers or claims something is always a question about what Voltura does: answer it, even when the answer is no. It never gets the out-of-scope answer below.",
    // H-ASST-ACC5: the law question now gets one catalog sentence to copy.
    lawInScope: "That question is about Voltura, so it never gets the out-of-scope answer.",
    gone: /General solar and battery advice is fine|expert advisor|Prefer concrete numbers|sizing reasoning of your own|Stay on energy topics|ask for it briefly/,
  },
  es: {
    refusal: serverCatalog.es["chat.outOfScope"],
    scope:
      "Cualquier otra pregunta - consejos generales sobre energía solar o baterías, otros productos o servicios, o cualquier otro tema - recibe exactamente esta respuesta y nada más:",
    verbatim:
      "Cuando una respuesta diga qué pasa cuando NASA POWER falla, copie palabra por palabra las frases del caso 1 y del caso 2 de la lista. Cuando una respuesta mencione factores de carbono, o qué países obtienen un resultado de CO2, copie palabra por palabra la entrada de carbono completa de la lista, incluida la lista de países.",
    inScope:
      "Una pregunta sobre si Voltura hace, calcula, muestra, ofrece o afirma algo es siempre una pregunta sobre lo que hace Voltura: respóndala, aunque la respuesta sea no. Nunca recibe la respuesta de fuera de ámbito de más abajo.",
    lawInScope: "Esa pregunta trata de Voltura, así que nunca recibe la respuesta de fuera de ámbito.",
    gone: /consejos generales sobre energía solar y baterías están bien|asesor experto|Prefiera cifras y rangos|razonamiento propio sobre el dimensionamiento|Cíñase a los temas de energía|pídalos brevemente/,
  },
};

describe.each(LANGS)("H-ASST-ACC3 — the scope rule and its one refusal sentence (%s)", (lang) => {
  it("the prompt quotes the catalog's refusal sentence after the scope rule, in quotes, once", async () => {
    const prompt = (await send(lang)).messages[0].content;
    expect(prompt).toContain(`${SCOPE[lang].scope} "${SCOPE[lang].refusal}"`);
    expect(prompt.split(SCOPE[lang].refusal).length - 1).toBe(1);
  });

  it("the other language's refusal sentence is not in this prompt", async () => {
    const prompt = (await send(lang)).messages[0].content;
    expect(prompt).not.toContain(SCOPE[lang === "es" ? "en" : "es"].refusal);
  });

  it("the permissions that invited answers from the model's own knowledge are gone", async () => {
    const prompt = (await send(lang)).messages[0].content;
    expect(prompt).not.toMatch(SCOPE[lang].gone);
  });

  // One send for both checks.
  it("the NASA sentences and the whole carbon entry are copied word for word; H-ASST-ACC4: a question about whether Voltura does or claims something is in scope, said before the scope rule", async () => {
    const prompt = (await send(lang)).messages[0].content;
    expect(prompt).toContain(SCOPE[lang].verbatim);
    const inScope = prompt.indexOf(SCOPE[lang].inScope);
    expect(inScope).toBeGreaterThan(-1);
    expect(inScope).toBeLessThan(prompt.indexOf(SCOPE[lang].scope));
    expect(prompt).toContain(SCOPE[lang].lawInScope);
  });

  it("the refusal sentence is itself a clean answer: the checker flags nothing in it", () => {
    expect(checkTranscript(SCOPE[lang].refusal)).toEqual([]);
  });
});

describe.each(LANGS)("H-ASST-ACC — the prompt is built from the facts, and keeps the model to them (%s)", (lang) => {
  it("the feature list is the facts module, line for line, in order", async () => {
    const prompt = (await send(lang)).messages[0].content;
    const lines = prompt.split("\n");
    const start = lines.indexOf(PROMPT[lang].heading);
    expect(start).toBeGreaterThan(-1);
    const facts = FACTS_BY_LOCALE[lang];
    expect(facts).toHaveLength(13);
    const listed = lines.slice(start + 1, start + 1 + facts.length).map((l) => l.replace(/^- /, ""));
    expect(listed).toEqual(facts.map((f) => f.text));
    expect(lines[start + 1 + facts.length]).not.toMatch(/^- /);
  });

  it("TF2: describe features only with the facts, add no detail, say plainly when unsure", async () => {
    const prompt = (await send(lang)).messages[0].content;
    for (const sentence of PROMPT[lang].rule) expect(prompt).toContain(sentence);
  });

  it("2b.5: tells the model which language to answer in, and carries no line of the other language's prompt", async () => {
    const prompt = (await send(lang)).messages[0].content;
    expect(prompt.split("\n")).toContain(PROMPT[lang].language);
    const other = PROMPT[lang === "es" ? "en" : "es"];
    for (const line of [other.heading, other.language, ...other.rule]) expect(prompt).not.toContain(line);
    for (const f of FACTS_BY_LOCALE[lang === "es" ? "en" : "es"]) expect(prompt).not.toContain(f.text);
  });

  it("the prompt itself carries none of the known false claims", async () => {
    expect(checkTranscript((await send(lang)).messages[0].content)).toEqual([]);
  });

  it("temperature is pinned at 0.2 (block limit 0.3)", async () => {
    const { temperature } = await send(lang);
    expect(temperature).toBe(0.2);
    expect(temperature!).toBeLessThanOrEqual(0.3);
  });

  it("fact 'assistant': the model sees the system turn and the stored conversation only - no calculation", async () => {
    const { messages } = await send(lang);
    expect(messages).toHaveLength(1 + STORED.length);
    expect(messages.slice(1)).toEqual(STORED);
    expect(FACTS_BY_LOCALE.en.find((f) => f.id === "assistant")!.text).toMatch(/AI Assistant/);
    expect(FACTS_BY_LOCALE.es.find((f) => f.id === "assistant")!.text).toMatch(/Asistente de IA/);
  });
});
