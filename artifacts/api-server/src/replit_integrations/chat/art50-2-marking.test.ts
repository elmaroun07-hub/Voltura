import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * EU AI Act Article 50(2), VPUB audit 3 Nov 2026: the Assistant's answers are
 * marked as AI-generated in machine-readable form, live (the AI-Disclosure
 * header and the stream's final event) and when read back (each stored
 * assistant message). User messages are not marked.
 *
 * Storage and the provider are stubbed (G10: no database, no network).
 */

const SESSION = "44444444-4444-4444-8444-444444444444";

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getMessagesByConversation: async () => [
      { id: 1, conversationId: 1, role: "user", content: "What is Voltura?" },
      { id: 2, conversationId: 1, role: "assistant", content: "An energy screening tool." },
    ],
    createMessage: async () => ({}),
  },
}));

vi.mock("../../lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/llm")>()),
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

const { registerChatRoutes } = await import("./routes");

let server: Server;
let base: string;
beforeAll(async () => {
  process.env.LLM_MODEL = "openai/gpt-oss-120b";
  process.env.LLM_BASE_URL = "https://api.groq.com/openai/v1";
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
  await new Promise((resolve) => server.close(resolve));
});

describe("Article 50(2) - Assistant answers are marked as AI-generated", () => {
  it("the stream carries the AI-Disclosure header and its final event names mode, model and provider", async () => {
    const res = await fetch(`${base}/api/conversations/1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": SESSION },
      body: JSON.stringify({ content: "What is Voltura?" }),
    });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("ai-disclosure")).toBe('mode=machine-generated, model="openai/gpt-oss-120b", provider="api.groq.com"');
    const events = text
      .split("\n\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => JSON.parse(l.slice(6)));
    expect(events.at(-1)).toEqual({
      done: true,
      aiDisclosure: { mode: "machine-generated", model: "openai/gpt-oss-120b", provider: "api.groq.com" },
    });
  });

  it("a stored conversation marks assistant messages and only those", async () => {
    const res = await fetch(`${base}/api/conversations/1`, { headers: { "X-Session-Id": SESSION } });
    const body = (await res.json()) as { messages: { role: string; aiDisclosure?: unknown }[] };
    expect(res.status).toBe(200);
    expect(body.messages.find((m) => m.role === "assistant")!.aiDisclosure).toEqual({ mode: "machine-generated" });
    expect(body.messages.find((m) => m.role === "user")).not.toHaveProperty("aiDisclosure");
  });
});
