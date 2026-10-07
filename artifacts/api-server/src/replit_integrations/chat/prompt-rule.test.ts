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

type Lang = "es" | "en";

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
    headers: { "Content-Type": "application/json", "X-Session-Id": SESSION, "Accept-Language": lang },
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
    expect(FACTS_BY_LOCALE.en.find((f) => f.id === "assistant")!.text).toMatch(/Energy Assistant/);
    expect(FACTS_BY_LOCALE.es.find((f) => f.id === "assistant")!.text).toMatch(/Asistente energético/);
  });
});
