import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/**
 * B1 (D19): the Assistant's system prompt makes no conformance claim.
 *
 * It asserts on the prompt as the route actually sends it — the `messages`
 * argument captured at the provider call — not on the SYSTEM_PROMPT constant,
 * so a claim reintroduced anywhere on the send path is caught, not only one
 * written into the constant.
 *
 * Storage and the provider are stubbed: `pnpm -r test` runs without a
 * database and never spends a paid completion.
 */

const SESSION = "33333333-3333-4333-8333-333333333333";

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getMessagesByConversation: async () => [
      { role: "user", content: "Is Voltura compliant with the EU AI Act?" },
    ],
    createMessage: async () => ({}),
  },
}));

let sent: { messages: { role: string; content: string }[] } | undefined;

vi.mock("../../lib/llm", () => ({
  llmModel: () => "stub-model",
  getLlmClient: () => ({
    chat: {
      completions: {
        create: async (args: { messages: { role: string; content: string }[] }) => {
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

describe("Assistant system prompt — no conformance claim (B1 / D19)", () => {
  it("sends a system prompt with no compliance, certification or AI Act claim", async () => {
    const app = express();
    app.use(express.json());
    registerChatRoutes(app);
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/conversations/1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": SESSION },
      body: JSON.stringify({ content: "Is Voltura compliant with the EU AI Act?" }),
    });
    await res.text();
    await new Promise((resolve) => server.close(resolve));

    expect(res.status).toBe(200);
    // Not vacuous: the route must have reached the provider with a system turn.
    expect(sent).toBeDefined();
    const system = sent!.messages[0];
    expect(system.role).toBe("system");
    expect(system.content.length).toBeGreaterThan(0);
    expect(system.content).not.toMatch(/compli|certif|conform|AI Act/i);
  });
});
