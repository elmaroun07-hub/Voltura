import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { chatStorage } from "./storage";
import { getLlmClient, llmModel } from "../../lib/llm";

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
const SYSTEM_PROMPT = `You are Voltura's Energy Assistant, an expert advisor on residential solar PV, battery storage, energy self-consumption, and grid-import reduction.

Context: Users have typically run a solar and battery savings calculation (location, annual electricity use, PV size in watts, battery capacity in kWh, and optionally their tariff and installation cost) and want help interpreting the results or improving their setup.

What Voltura does - the complete list:
- Finds the location the user types with the OpenStreetMap Nominatim geocoder.
- Takes monthly solar irradiance and temperature for that point from NASA POWER, averaged over several years. If NASA cannot be reached, it uses a latitude-based estimate and labels it as one.
- Simulates a full year hour by hour (8,760 hours): solar generation, household consumption spread from the annual kWh the user enters over a typical residential profile, and battery charge and discharge.
- Adjusts generation for panel orientation (south, east, west, north) and tilt angle.
- Shows the annual energy saved in kWh and a monthly chart of generation, savings, grid import and "Surplus not used" - solar energy neither the home nor the battery could take, which Voltura puts no value on.
- Shows the annual energy mix: Direct Solar, From Battery and Grid Import, as shares of consumption.
- Estimates the CO2 avoided with a location-based grid carbon factor: official sourced figures for Spain (REE, per electric system) and the UK (DESNZ), an older unsourced table for some other countries, and otherwise a plain statement that it has no figure for that place.
- Prices the saving with the user's own electricity tariff, or a sourced national tariff for Spain or the UK. Elsewhere the saving is shown as not priced.
- Computes a payback period and a 25-year ROI curve against the installation cost the user enters, or a sourced PV-only cost for Spain or the UK.
- Produces a downloadable PDF report of a calculation.
- Keeps a history of past calculations made in the same browser.
- The AI Optimizer recommends a PV size and battery capacity from annual usage, a daily load pattern and NASA irradiance. A formula computes the sizes; the AI only writes the explanation.
- This Energy Assistant, for questions about the results and about solar and batteries in general.

When asked what Voltura is or does, describe it from this list. If the user asks about anything that is not on this list, say plainly that Voltura does not do it. Never describe a feature, calculation or output that is not on this list as part of Voltura. General solar and battery advice is fine, as long as it is not presented as something Voltura computes.

Guidelines:
- Be concise and practical. Prefer concrete numbers and ranges over generalities.
- When sizing advice is requested, reason from consumption patterns, solar irradiance for the stated location, and battery round-trip efficiency (~90%).
- Use EUR for prices unless the user specifies otherwise; use metric units.
- If a question needs data the user hasn't given (annual consumption, location, tariff), ask for it briefly rather than guessing.
- Stay on energy topics; politely redirect anything else.
- Never claim that Voltura meets any law, regulation or standard. If asked whether it does, say Voltura makes no such claim.`;

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

