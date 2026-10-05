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
const { VOLTURA_FACTS } = await import("./facts");

async function send() {
  sent = undefined;
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/conversations/1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": SESSION },
    body: JSON.stringify({ content: "And the PDF?" }),
  });
  await res.text();
  await new Promise((resolve) => server.close(resolve));
  expect(res.status).toBe(200);
  expect(sent).toBeDefined();
  return sent!;
}

const LIST_HEADING = "What Voltura does - the complete list:";

describe("H-ASST-ACC — the prompt is built from the facts, and keeps the model to them", () => {
  it("the feature list is the facts module, line for line, in order", async () => {
    const prompt = (await send()).messages[0].content;
    const lines = prompt.split("\n");
    const start = lines.indexOf(LIST_HEADING);
    expect(start).toBeGreaterThan(-1);
    const listed = lines.slice(start + 1, start + 1 + VOLTURA_FACTS.length).map((l) => l.replace(/^- /, ""));
    expect(listed).toEqual(VOLTURA_FACTS.map((f) => f.text));
    expect(lines[start + 1 + VOLTURA_FACTS.length]).not.toMatch(/^- /);
  });

  it("TF2: describe features only with the facts, add no detail, say plainly when unsure", async () => {
    const prompt = (await send()).messages[0].content;
    expect(prompt).toContain(
      "Describe Voltura's features only with the facts in this list, and add no detail of your own about how Voltura works, what it shows or where it applies.",
    );
    expect(prompt).toContain("If you do not know whether or how Voltura does something, say plainly that you do not know.");
  });

  it("the prompt itself carries none of the known false claims", async () => {
    expect(checkTranscript((await send()).messages[0].content)).toEqual([]);
  });

  it("temperature is pinned at 0.2 (block limit 0.3)", async () => {
    const { temperature } = await send();
    expect(temperature).toBe(0.2);
    expect(temperature!).toBeLessThanOrEqual(0.3);
  });

  it("fact 'assistant': the model sees the system turn and the stored conversation only - no calculation", async () => {
    const { messages } = await send();
    expect(messages).toHaveLength(1 + STORED.length);
    expect(messages.slice(1)).toEqual(STORED);
    expect(VOLTURA_FACTS.find((f) => f.id === "assistant")!.text).toMatch(/Energy Assistant/);
  });
});
