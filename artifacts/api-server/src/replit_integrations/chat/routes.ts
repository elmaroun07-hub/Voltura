import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { chatStorage } from "./storage";
import { getLlmClient, llmModel } from "../../lib/llm";
import { FACTS_BY_LOCALE } from "./facts";
import { requestLocale, serverT, type Locale } from "../../i18n";

// Provider, endpoint and model come from ../../lib/llm, env-driven. This file
// used to carry its own copy of the accessor and the same two hardcoded
// literals, so a provider change had to be made twice and could be half-done.
// Still lazy: a missing key fails the request, not the server boot.

// D19 (B1): removed an unsupported regulatory claim from this prompt; the model
// is now told to make none. system-prompt.test.ts pins its absence.
//
// H-ASST-D16-N3 Part A: asked "What is Voltura?", the Assistant invented
// features from its priors. The list below is the whole product, and
// feature-map.test.ts maps every line of it to the code that implements it -
// add a line there before adding one here.
//
// H-ASST-ACC: the list is now ./facts, where each sentence is written from the
// code and pinned to it (facts.test.ts). The model restated four wrong lines
// of the previous list faithfully (Spain's install cost, the UK tariff, the
// no-figure case, the Optimizer's profile), so the rule below keeps it to the
// facts' own wording.
//
// H2b (2b.5, operator ruling 7 Oct 2026): the Assistant works in both
// languages. The reader's language is the one they chose in the app, which
// every request carries in Accept-Language - the same signal the API's other
// sentences follow - so the prompt, its facts and the answers are all in that
// language, Spanish by default. The two prompts say the same things; the
// Spanish one quotes the Spanish screen's labels. The English text is the
// pre-2b.5 prompt plus one guideline: the answer's language.
const SYSTEM_PROMPTS: Readonly<Record<Locale, string>> = {
  en: `You are Voltura's Energy Assistant, an expert advisor on residential solar PV, battery storage, energy self-consumption, and grid-import reduction.

Context: Users have typically run a solar and battery savings calculation (location, annual electricity use, PV size in watts, battery capacity in kWh, and optionally their tariff and installation cost) and want help interpreting the results or improving their setup.

What Voltura does - the complete list:
${FACTS_BY_LOCALE.en.map((f) => `- ${f.text}`).join("\n")}

When asked what Voltura is or does, describe it from this list. If the user asks about anything that is not on this list, say plainly that Voltura does not do it. Never describe a feature, calculation or output that is not on this list as part of Voltura. General solar and battery advice is fine, as long as it is not presented as something Voltura computes.

Describe Voltura's features only with the facts in this list, and add no detail of your own about how Voltura works, what it shows or where it applies. If you do not know whether or how Voltura does something, say plainly that you do not know.

Guidelines:
- Always answer in English.
- Be concise and practical. Prefer concrete numbers and ranges over generalities.
- When sizing advice is requested, say that Voltura's AI Optimizer computes a recommended size. Any sizing reasoning of your own is general advice, not a Voltura figure, and you say so.
- The battery's round-trip efficiency is an input the user sets, from 50% to 100% (90% by default).
- Voltura shows money in the country's own currency: EUR for Spain, GBP for the UK. Use metric units.
- If a question needs data the user hasn't given (annual consumption, location, tariff), ask for it briefly rather than guessing.
- Stay on energy topics; politely redirect anything else.
- Never claim that Voltura meets any law, regulation or standard. If asked whether it does, say Voltura makes no such claim.`,
  es: `Usted es el Asistente energético de Voltura, un asesor experto en energía solar fotovoltaica residencial, almacenamiento en baterías, autoconsumo energético y reducción de la importación de red.

Contexto: normalmente, el usuario ha hecho un cálculo de ahorro solar y con batería (ubicación, consumo eléctrico anual, potencia FV en vatios, capacidad de la batería en kWh y, si quiere, su tarifa y el coste de instalación) y quiere ayuda para interpretar los resultados o mejorar su instalación.

Lo que hace Voltura - la lista completa:
${FACTS_BY_LOCALE.es.map((f) => `- ${f.text}`).join("\n")}

Cuando le pregunten qué es o qué hace Voltura, descríbalo a partir de esta lista. Si el usuario pregunta por algo que no está en esta lista, diga claramente que Voltura no lo hace. No describa nunca como parte de Voltura una función, un cálculo o un resultado que no esté en esta lista. Los consejos generales sobre energía solar y baterías están bien, siempre que no se presenten como algo que Voltura calcula.

Describa las funciones de Voltura solo con los datos de esta lista, y no añada ningún detalle propio sobre cómo funciona Voltura, qué muestra o dónde se aplica. Si no sabe si Voltura hace algo, o cómo lo hace, diga claramente que no lo sabe.

Pautas:
- Responda siempre en español y trate al usuario de usted.
- Sea conciso y práctico. Prefiera cifras y rangos concretos a las generalidades.
- Cuando le pidan consejo sobre el dimensionamiento, diga que el Optimizador IA de Voltura calcula un tamaño recomendado. Cualquier razonamiento propio sobre el dimensionamiento es un consejo general, no una cifra de Voltura, y así lo dice.
- La eficiencia de ida y vuelta de la batería es un dato que fija el usuario, del 50 % al 100 % (90 % por defecto).
- Voltura muestra el dinero en la moneda de cada país: EUR para España, GBP para el Reino Unido. Use unidades métricas.
- Si una pregunta necesita datos que el usuario no ha dado (consumo anual, ubicación, tarifa), pídalos brevemente en lugar de suponerlos.
- Cíñase a los temas de energía; reconduzca con cortesía cualquier otro.
- No afirme nunca que Voltura se ajusta a alguna ley, reglamento o norma. Si le preguntan si lo hace, diga que Voltura no hace tal afirmación.`,
};

/**
 * Sampling temperature for the Assistant (H-ASST-ACC A.3). None was set, so the
 * provider default applied; the block caps it at 0.3 to keep restatements of
 * the facts close to their wording. Pinned by prompt-rule.test.ts.
 */
export const CHAT_TEMPERATURE = 0.2;

/**
 * The session id every conversation route is scoped by. Read from the header
 * only: never defaulted, never generated server-side, never read from the body.
 * Absent means the request is rejected - inserting null here is what let one
 * visitor's chat render in another's browser.
 *
 * Returns null and answers 400 itself so each handler is one guard clause.
 */
function requireSessionId(req: Request, res: Response): string | null {
  const sessionId = req.get("x-session-id");
  if (!sessionId) {
    res.status(400).json({ error: serverT(requestLocale(req))("error.sessionHeader") });
    return null;
  }
  return sessionId;
}

/** Byte-identical for "not yours" and "does not exist" - a distinguishable
 *  response would confirm the conversation exists, which is itself the leak. */
function notFound(req: Request, res: Response) {
  return res.status(404).json({ error: serverT(requestLocale(req))("chat.notFound") });
}

/**
 * The other paid route: every message is a streamed Mistral completion. Higher
 * than the optimizer because a real conversation is many turns, still far below
 * what a script would do. Keyed on IP by the library default.
 */
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: (req: Request) => ({ error: serverT(requestLocale(req))("chat.rateLimited") }),
});

export function registerChatRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const conversations = await chatStorage.getAllConversations(sessionId);
      return res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return res.status(500).json({ error: serverT(requestLocale(req))("chat.listFailed") });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const id = parseInt(String(req.params.id));
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.sessionId !== sessionId) {
        return notFound(req, res);
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      return res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      return res.status(500).json({ error: serverT(requestLocale(req))("chat.getFailed") });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || serverT(requestLocale(req))("chat.defaultTitle"), sessionId);
      return res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      return res.status(500).json({ error: serverT(requestLocale(req))("chat.createFailed") });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const id = parseInt(String(req.params.id));
      const conversation = await chatStorage.getConversation(id);
      if (!conversation || conversation.sessionId !== sessionId) {
        return notFound(req, res);
      }
      await chatStorage.deleteConversation(id, sessionId);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return res.status(500).json({ error: serverT(requestLocale(req))("chat.deleteFailed") });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:id/messages", messageLimiter, async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const conversationId = parseInt(String(req.params.id));
      const conversation = await chatStorage.getConversation(conversationId);
      if (!conversation || conversation.sessionId !== sessionId) {
        return notFound(req, res);
      }

      const { content } = req.body;

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream the completion from the configured provider
      const stream = await getLlmClient().chat.completions.create({
        model: llmModel(),
        messages: [{ role: "system" as const, content: SYSTEM_PROMPTS[requestLocale(req)] }, ...chatMessages],
        stream: true,
        max_tokens: 2048,
        temperature: CHAT_TEMPERATURE,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      // Check if headers already sent (SSE streaming started)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: serverT(requestLocale(req))("chat.sendFailed") })}\n\n`);
        return res.end();
      } else {
        return res.status(500).json({ error: serverT(requestLocale(req))("chat.sendFailed") });
      }
    }
  });
}

