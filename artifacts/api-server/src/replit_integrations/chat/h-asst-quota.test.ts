import { describe, expect, it, vi } from "vitest";

// Importing the routes module would open the database; neither is used here.
vi.mock("./storage", () => ({ chatStorage: {} }));
vi.mock("../../lib/llm", () => ({ llmModel: () => "stub-model", getLlmClient: () => ({}) }));

const { MESSAGES_PER_WINDOW, SYSTEM_PROMPTS } = await import("./routes");
const { FACTS_BY_LOCALE } = await import("./facts");

/**
 * H-ASST-QUOTA (operator ruling, 23 Oct 2026): a tighter per-visitor message
 * limit and a shorter prompt. The limit's behaviour (refused at the next
 * message, per client, in both languages) is exercised over HTTP in
 * h-d17-limits.test.ts and rate-limit-locale.test.ts, which read the constant;
 * this file pins the ruled value itself, and what the prompt lost.
 */

describe("H-ASST-QUOTA — the message limit", () => {
  it("is 5 per client per 15 minutes, as ruled (was 20)", () => {
    expect(MESSAGES_PER_WINDOW).toBe(5);
  });
});

const REMOVED = {
  en: [
    "Context: Users have typically run a solar and battery savings calculation",
    "Never describe a feature, calculation or output that is not on this list as part of Voltura.",
  ],
  es: [
    "Contexto: normalmente, el usuario ha hecho un cálculo de ahorro solar y con batería",
    "No describa nunca como parte de Voltura una función, un cálculo o un resultado que no esté en esta lista.",
  ],
} as const;

/** Measured at c7f7117, before this block: en 6,851, es 7,796 characters. */
const BEFORE = { en: 6851, es: 7796 } as const;

/**
 * Ceiling the prompt may not exceed. It was BEFORE; the ceilings are now the
 * measured lengths of the prompt as it stands.
 * Raised 3 Nov 2026 for AI Act Article 50(1) disclosure.
 */
const CEILING = { en: 6993, es: 7926 } as const;

describe.each(["en", "es"] as const)("H-ASST-QUOTA — the shorter prompt (%s)", (lang) => {
  const prompt = SYSTEM_PROMPTS[lang];

  it("no longer carries the Context paragraph or the repeated no-invention sentence", () => {
    for (const removed of REMOVED[lang]) expect(prompt).not.toContain(removed);
  });

  it("still carries every fact sentence, word for word", () => {
    for (const fact of FACTS_BY_LOCALE[lang]) expect(prompt).toContain(fact.text);
  });

  it("stays within its ceiling (Raised 3 Nov 2026 for AI Act Article 50(1) disclosure.)", () => {
    expect(prompt.length).toBeLessThanOrEqual(CEILING[lang]);
  });
});
