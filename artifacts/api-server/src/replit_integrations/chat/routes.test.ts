import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/**
 * Ownership rules for /api/conversations*, exercised over real HTTP against the
 * real registerChatRoutes.
 *
 * 404-on-mismatch is the point of this file. A 403 would confirm that a
 * conversation with that id exists, which is itself the leak the session work
 * closes — so "not yours" and "does not exist" must be indistinguishable to a
 * caller, down to the response body.
 *
 * chatStorage is stubbed rather than hit: `pnpm -r test` has to run without a
 * database, and no supertest dependency is added — express and node's own fetch
 * are enough.
 */

type Row = { id: number; title: string; sessionId: string | null };

const rows = new Map<number, Row>();
const deleted: number[] = [];
const inserted: Row[] = [];

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => rows.get(id),
    getAllConversations: async (sessionId: string) =>
      [...rows.values()].filter((c) => c.sessionId === sessionId),
    createConversation: async (title: string, sessionId: string) => {
      const row: Row = { id: rows.size + 100, title, sessionId };
      rows.set(row.id, row);
      inserted.push(row);
      return row;
    },
    deleteConversation: async (id: number) => {
      deleted.push(id);
      rows.delete(id);
    },
    getMessagesByConversation: async () => [],
    createMessage: async () => ({}),
  },
}));

const { registerChatRoutes } = await import("./routes");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

async function serve() {
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

beforeEach(() => {
  rows.clear();
  deleted.length = 0;
  inserted.length = 0;
  rows.set(1, { id: 1, title: "Alice's chat", sessionId: ALICE });
});

describe("GET /api/conversations/:id — ownership", () => {
  it("returns 404, not 403, when the session id does not match", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations/1`, {
      headers: { "X-Session-Id": BOB },
    });

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
    await close();
  });

  it("is byte-identical to a conversation that never existed", async () => {
    const { base, close } = await serve();
    const mismatch = await fetch(`${base}/api/conversations/1`, {
      headers: { "X-Session-Id": BOB },
    });
    const missing = await fetch(`${base}/api/conversations/999`, {
      headers: { "X-Session-Id": BOB },
    });

    expect(mismatch.status).toBe(missing.status);
    expect(await mismatch.text()).toBe(await missing.text());
    await close();
  });

  it("serves the row to its owner", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations/1`, {
      headers: { "X-Session-Id": ALICE },
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { title: string }).title).toBe("Alice's chat");
    await close();
  });
});

describe("DELETE /api/conversations/:id — ownership", () => {
  it("404s on a mismatch and deletes nothing", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations/1`, {
      method: "DELETE",
      headers: { "X-Session-Id": BOB },
    });

    expect(res.status).toBe(404);
    expect(deleted).toEqual([]);
    expect(rows.has(1)).toBe(true);
    await close();
  });

  it("deletes for the owner", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations/1`, {
      method: "DELETE",
      headers: { "X-Session-Id": ALICE },
    });

    expect(res.status).toBe(204);
    expect(deleted).toEqual([1]);
    await close();
  });
});

describe("GET /api/conversations — listing is session-scoped", () => {
  it("returns only the caller's rows", async () => {
    rows.set(2, { id: 2, title: "Bob's chat", sessionId: BOB });
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations`, {
      headers: { "X-Session-Id": BOB },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 2, title: "Bob's chat", sessionId: BOB }]);
    await close();
  });
});

describe("a missing X-Session-Id header is rejected, never defaulted", () => {
  it("rejects a write and inserts nothing", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "no header" }),
    });

    expect(res.status).toBe(400);
    expect(inserted).toEqual([]);
    await close();
  });

  it("rejects the reads rather than returning everything", async () => {
    const { base, close } = await serve();

    const list = await fetch(`${base}/api/conversations`);
    expect(list.status).toBe(400);

    const single = await fetch(`${base}/api/conversations/1`);
    expect(single.status).toBe(400);

    await close();
  });

  it("rejects a message send into someone else's conversation", async () => {
    const { base, close } = await serve();
    const res = await fetch(`${base}/api/conversations/1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": BOB },
      body: JSON.stringify({ content: "hello" }),
    });

    expect(res.status).toBe(404);
    await close();
  });
});
