import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/**
 * 2b.5: the message route's rate-limit answer is in the reader's language.
 * Its own file, so the limiter's per-IP count starts at zero here. Storage and
 * the provider are stubbed; no paid call is made.
 */

const SESSION = "66666666-6666-4666-8666-666666666666";

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getMessagesByConversation: async () => [],
    createMessage: async () => ({}),
  },
}));

vi.mock("../../lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/llm")>()),
  llmModel: () => "stub-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async () =>
          (async function* () {
            yield { choices: [{ delta: { content: "ok" } }] };
          })(),
      },
    },
  }),
}));

const { registerChatRoutes, MESSAGES_PER_WINDOW } = await import("./routes");

describe("2b.5 — the Assistant's rate limit, in the reader's language", () => {
  it(`message ${MESSAGES_PER_WINDOW + 1} in 15 minutes is refused: Spanish by default, English on request`, async () => {
    const app = express();
    app.use(express.json());
    registerChatRoutes(app);
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    const send = (lang?: string) =>
      fetch(`http://127.0.0.1:${port}/api/conversations/1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": SESSION, ...(lang ? { "Accept-Language": lang } : {}) },
        body: JSON.stringify({ content: "hola" }),
      });
    try {
      for (let i = 0; i < MESSAGES_PER_WINDOW; i++) {
        const ok = await send();
        await ok.text();
        expect(ok.status).toBe(200);
      }
      const es = await send();
      expect(es.status).toBe(429);
      expect(await es.json()).toEqual({ error: "Demasiados mensajes. Inténtelo de nuevo más tarde." });
      const en = await send("en");
      expect(en.status).toBe(429);
      expect(await en.json()).toEqual({ error: "Too many messages. Please try again later." });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
