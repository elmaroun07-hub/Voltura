import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/**
 * H-D17: the chat routes' limits and body caps, over real HTTP against the real
 * registerChatRoutes. Its own file, so every limiter's count starts at zero.
 * Storage and the model are stubbed and counted: a refused request must store
 * nothing and call nothing.
 *
 * Every test names its client in CF-Connecting-IP, the header the limiters key
 * on in production. In a test every request comes from 127.0.0.1, so a limiter
 * that ignored the header would put all clients in one bucket - which is what
 * the "another client is not limited" assertions catch.
 */

const SESSION = "77777777-7777-4777-8777-777777777777";
const stored = { conversations: 0, messages: [] as string[], modelCalls: 0 };

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getAllConversations: async () => [],
    createConversation: async (title: string, sessionId: string) => {
      stored.conversations++;
      return { id: 500 + stored.conversations, title, sessionId };
    },
    deleteConversation: async () => {},
    getMessagesByConversation: async () => [],
    createMessage: async (_id: number, _role: string, content: string) => {
      stored.messages.push(content);
      return {};
    },
  },
}));

vi.mock("../../lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/llm")>()),
  llmModel: () => "stub-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async () => {
          stored.modelCalls++;
          return (async function* () {
            yield { choices: [{ delta: { content: "ok" } }] };
          })();
        },
      },
    },
  }),
}));

const { registerChatRoutes, MAX_TITLE_CHARS, MAX_MESSAGE_CHARS, MESSAGES_PER_WINDOW } = await import("./routes");

async function serve() {
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

const headers = (client: string, lang?: string) => ({
  "Content-Type": "application/json",
  "X-Session-Id": SESSION,
  "CF-Connecting-IP": client,
  ...(lang ? { "Accept-Language": lang } : {}),
});

beforeEach(() => {
  stored.conversations = 0;
  stored.messages.length = 0;
  stored.modelCalls = 0;
});

describe("H-D17 — POST /api/conversations is rate-limited per client", () => {
  it("the 11th new conversation in 15 minutes is refused, in the reader's language; another client is not affected", async () => {
    const { base, close } = await serve();
    const create = (client: string, lang?: string) =>
      fetch(`${base}/api/conversations`, { method: "POST", headers: headers(client, lang), body: JSON.stringify({ title: "t" }) });
    try {
      for (let i = 0; i < 10; i++) expect((await create("203.0.113.10")).status).toBe(201);
      const es = await create("203.0.113.10");
      expect(es.status).toBe(429);
      expect(await es.json()).toEqual({ error: "Demasiadas conversaciones nuevas. Inténtelo de nuevo más tarde." });
      const en = await create("203.0.113.10", "en");
      expect(en.status).toBe(429);
      expect(await en.json()).toEqual({ error: "Too many new conversations. Please try again later." });
      expect(stored.conversations).toBe(10);

      expect((await create("203.0.113.11")).status).toBe(201);
    } finally {
      await close();
    }
  });
});

describe("H-D17 — the conversation title is capped", () => {
  it(`accepts ${MAX_TITLE_CHARS} characters and refuses ${MAX_TITLE_CHARS + 1}, storing nothing`, async () => {
    const { base, close } = await serve();
    const create = (body: unknown, lang?: string) =>
      fetch(`${base}/api/conversations`, { method: "POST", headers: headers("203.0.113.20", lang), body: JSON.stringify(body) });
    try {
      expect((await create({ title: "a".repeat(MAX_TITLE_CHARS) })).status).toBe(201);
      const long = await create({ title: "a".repeat(MAX_TITLE_CHARS + 1) }, "en");
      expect(long.status).toBe(400);
      expect(await long.json()).toEqual({ error: "The title must be text of at most 200 characters." });
      const notText = await create({ title: { nested: true } });
      expect(notText.status).toBe(400);
      expect(await notText.json()).toEqual({ error: "El título debe ser un texto de 200 caracteres como máximo." });
      expect(stored.conversations).toBe(1);
    } finally {
      await close();
    }
  });

  it("a missing title still gets the default title, as before", async () => {
    const { base, close } = await serve();
    try {
      const res = await fetch(`${base}/api/conversations`, { method: "POST", headers: headers("203.0.113.21", "en"), body: "{}" });
      expect(res.status).toBe(201);
      expect(((await res.json()) as { title: string }).title).toBe("New Chat");
    } finally {
      await close();
    }
  });
});

describe("H-D17 — the message is capped before it is stored or sent to the model", () => {
  it(`refuses ${MAX_MESSAGE_CHARS + 1} characters, an empty message, and a non-text one; stores nothing and calls no model`, async () => {
    const { base, close } = await serve();
    const send = (body: unknown, lang?: string) =>
      fetch(`${base}/api/conversations/1/messages`, { method: "POST", headers: headers("203.0.113.30", lang), body: JSON.stringify(body) });
    try {
      const long = await send({ content: "a".repeat(MAX_MESSAGE_CHARS + 1) }, "en");
      expect(long.status).toBe(400);
      expect(await long.json()).toEqual({ error: "The message must be text of 1 to 4000 characters." });
      const blank = await send({ content: "   " });
      expect(blank.status).toBe(400);
      expect(await blank.json()).toEqual({ error: "El mensaje debe ser un texto de entre 1 y 4000 caracteres." });
      expect((await send({ content: ["a"] })).status).toBe(400);
      expect((await send({})).status).toBe(400);
      expect(stored.messages).toEqual([]);
      expect(stored.modelCalls).toBe(0);
    } finally {
      await close();
    }
  });

  it(`accepts exactly ${MAX_MESSAGE_CHARS} characters and stores it unchanged`, async () => {
    const { base, close } = await serve();
    try {
      const content = " " + "b".repeat(MAX_MESSAGE_CHARS - 1);
      const res = await fetch(`${base}/api/conversations/1/messages`, {
        method: "POST",
        headers: headers("203.0.113.31"),
        body: JSON.stringify({ content }),
      });
      await res.text();
      expect(res.status).toBe(200);
      expect(stored.messages[0]).toBe(content);
      expect(stored.modelCalls).toBe(1);
    } finally {
      await close();
    }
  });
});

describe("H-D17 — the message limiter counts per client, not per proxy address", () => {
  it(`one client's message ${MESSAGES_PER_WINDOW + 1} is refused while another client's first goes through`, async () => {
    const { base, close } = await serve();
    const send = (client: string) =>
      fetch(`${base}/api/conversations/1/messages`, { method: "POST", headers: headers(client), body: JSON.stringify({ content: "hola" }) });
    try {
      for (let i = 0; i < MESSAGES_PER_WINDOW; i++) {
        const ok = await send("203.0.113.40");
        await ok.text();
        expect(ok.status).toBe(200);
      }
      expect((await send("203.0.113.40")).status).toBe(429);
      const other = await send("203.0.113.41");
      await other.text();
      expect(other.status).toBe(200);
    } finally {
      await close();
    }
  });
});
