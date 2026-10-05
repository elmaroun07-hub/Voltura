import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { chatStorage } from "./storage";
import { getLlmClient, llmModel } from "../../lib/llm";
import { VOLTURA_FACTS } from "./facts";

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
const SYSTEM_PROMPT = `You are Voltura's Energy Assistant, an expert advisor on residential solar PV, battery storage, energy self-consumption, and grid-import reduction.

Context: Users have typically run a solar and battery savings calculation (location, annual electricity use, PV size in watts, battery capacity in kWh, and optionally their tariff and installation cost) and want help interpreting the results or improving their setup.

What Voltura does - the complete list:
${VOLTURA_FACTS.map((f) => `- ${f.text}`).join("\n")}

When asked what Voltura is or does, describe it from this list. If the user asks about anything that is not on this list, say plainly that Voltura does not do it. Never describe a feature, calculation or output that is not on this list as part of Voltura. General solar and battery advice is fine, as long as it is not presented as something Voltura computes.

Describe Voltura's features only with the facts in this list, and add no detail of your own about how Voltura works, what it shows or where it applies. If you do not know whether or how Voltura does something, say plainly that you do not know.

Guidelines:
- Be concise and practical. Prefer concrete numbers and ranges over generalities.
- When sizing advice is requested, say that Voltura's AI Optimizer computes a recommended size. Any sizing reasoning of your own is general advice, not a Voltura figure, and you say so.
- The battery's round-trip efficiency is an input the user sets, from 50% to 100% (90% by default).
- Voltura shows money in the country's own currency: EUR for Spain, GBP for the UK. Use metric units.
- If a question needs data the user hasn't given (annual consumption, location, tariff), ask for it briefly rather than guessing.
- Stay on energy topics; politely redirect anything else.
- Never claim that Voltura meets any law, regulation or standard. If asked whether it does, say Voltura makes no such claim.`;

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
    res.status(400).json({ error: "X-Session-Id header is required" });
    return null;
  }
  return sessionId;
}

/** Byte-identical for "not yours" and "does not exist" - a distinguishable
 *  response would confirm the conversation exists, which is itself the leak. */
function notFound(res: Response) {
  return res.status(404).json({ error: "Conversation not found" });
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
  message: { error: "Too many messages. Please try again later." },
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
      return res.status(500).json({ error: "Failed to fetch conversations" });
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
        return notFound(res);
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      return res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      return res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const sessionId = requireSessionId(req, res);
      if (!sessionId) return;

      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat", sessionId);
      return res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      return res.status(500).json({ error: "Failed to create conversation" });
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
        return notFound(res);
      }
      await chatStorage.deleteConversation(id, sessionId);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return res.status(500).json({ error: "Failed to delete conversation" });
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
        return notFound(res);
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
        messages: [{ role: "system" as const, content: SYSTEM_PROMPT }, ...chatMessages],
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
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        return res.end();
      } else {
        return res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

