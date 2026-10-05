import { describe, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

/**
 * H-ASST-D16-N3 Part A: the Assistant describes only what exists.
 *
 * Asked "What is Voltura?" on 23 Sept, the Assistant invented feed-in tariffs
 * and net present value - model priors, because the prompt said little about
 * what the product does. The prompt now carries the complete feature list, and
 * this file holds the other half: every feature the prompt names, mapped to the
 * file and symbol that implements it.
 *
 *   TA1  A feature in the prompt with no row here fails. A row whose symbol is
 *        gone from its file fails. A row the prompt no longer names fails.
 *   TA2  The prompt tells the model to say plainly that Voltura does not do
 *        anything that is not on the list.
 *   A-c  None of the invented features comes back, anywhere in the prompt.
 *
 * Like system-prompt.test.ts, it reads the prompt as the route sends it, not
 * the constant. Storage and the provider are stubbed; the only I/O is reading
 * source files from disk (G10).
 */

const SESSION = "44444444-4444-4444-8444-444444444444";

vi.mock("./storage", () => ({
  chatStorage: {
    getConversation: async (id: number) => ({ id, title: "probe", sessionId: SESSION }),
    getMessagesByConversation: async () => [{ role: "user", content: "What is Voltura?" }],
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

/** Repository root, from artifacts/api-server/src/replit_integrations/chat. */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/**
 * TA1. Prompt line -> where it is implemented. `symbol` must appear verbatim
 * in `file`: a definition, or a literal the implementation renders. Built
 * from the code at 0f9f7a1, not from the block file.
 */
const FEATURE_MAP: Record<string, { file: string; symbol: string }> = {
  "Finds the location the user types with the OpenStreetMap Nominatim geocoder.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "https://nominatim.openstreetmap.org/search",
  },
  "Takes monthly solar irradiance and temperature for that point from NASA POWER, averaged over several years. If NASA cannot be reached, it uses a latitude-based estimate and labels it as one.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "export function fallbackIrradiance(",
  },
  "Simulates a full year hour by hour (8,760 hours): solar generation, household consumption spread from the annual kWh the user enters over a typical residential profile, and battery charge and discharge.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "export function simulate8760(",
  },
  "Adjusts generation for panel orientation (south, east, west, north) and tilt angle.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "function panelEfficiencyFactor(",
  },
  "Shows the annual energy saved in kWh and a monthly chart of generation, savings, grid import and \"Surplus not used\" - solar energy neither the home nor the battery could take, which Voltura puts no value on.": {
    file: "artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx",
    symbol: '"Surplus not used": m.surplusKwh',
  },
  "Shows the annual energy mix: Direct Solar, From Battery and Grid Import, as shares of consumption.": {
    file: "artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx",
    symbol: 'name: "From Battery"',
  },
  "Estimates the CO2 avoided with a location-based grid carbon factor: official sourced figures for Spain (REE, per electric system) and the UK (DESNZ), an older unsourced table for some other countries, and otherwise a plain statement that it has no figure for that place.": {
    file: "artifacts/api-server/src/lib/emissions/carbon-source.ts",
    symbol: "export function resolveCarbonSource(",
  },
  "Prices the saving with the user's own electricity tariff, or a sourced national tariff for Spain or the UK. Elsewhere the saving is shown as not priced.": {
    file: "artifacts/api-server/src/lib/emissions/money.ts",
    symbol: "export function resolveMoney(",
  },
  "Computes a payback period and a 25-year ROI curve against the installation cost the user enters, or a sourced PV-only cost for Spain or the UK.": {
    file: "artifacts/api-server/src/lib/emissions/countries.ts",
    symbol: "export function roi(",
  },
  "Produces a downloadable PDF report of a calculation.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: 'app.get("/api/calculate/:id/pdf"',
  },
  "Keeps a history of past calculations made in the same browser.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "app.get(api.calculations.history.path",
  },
  "The AI Optimizer recommends a PV size and battery capacity from annual usage, a daily load pattern and NASA irradiance. A formula computes the sizes; the AI only writes the explanation.": {
    file: "artifacts/api-server/src/lib/sizing.ts",
    symbol: "export function sizePvAndBattery(",
  },
  "This Energy Assistant, for questions about the results and about solar and batteries in general.": {
    file: "artifacts/api-server/src/replit_integrations/chat/routes.ts",
    symbol: "export function registerChatRoutes(",
  },
};

const LIST_HEADING = "What Voltura does - the complete list:";

async function sentSystemPrompt(): Promise<string> {
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
    body: JSON.stringify({ content: "What is Voltura?" }),
  });
  await res.text();
  await new Promise((resolve) => server.close(resolve));
  expect(res.status).toBe(200);
  expect(sent).toBeDefined();
  const system = sent!.messages[0];
  expect(system.role).toBe("system");
  return system.content;
}

/** The bullets under the list heading, up to the first line that is not one. */
function featureLines(prompt: string): string[] {
  const lines = prompt.split("\n");
  const start = lines.indexOf(LIST_HEADING);
  if (start === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("- ")) break;
    items.push(line.slice(2));
  }
  return items;
}

describe("Assistant feature map (H-ASST-D16-N3 Part A)", () => {
  it("TA1: the prompt carries a feature list, and every feature on it is in the map", async () => {
    const listed = featureLines(await sentSystemPrompt());
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.filter((f) => !(f in FEATURE_MAP))).toEqual([]);
  });

  it("TA1: every row in the map is still named by the prompt", async () => {
    const listed = new Set(featureLines(await sentSystemPrompt()));
    expect(Object.keys(FEATURE_MAP).filter((f) => !listed.has(f))).toEqual([]);
  });

  it.each(Object.entries(FEATURE_MAP))("TA1: %s -> implemented", (_feature, { file, symbol }) => {
    const source = readFileSync(resolve(REPO, file), "utf8");
    expect(source.includes(symbol), `${symbol} not found in ${file}`).toBe(true);
  });

  it("TA2: anything not on the list is answered plainly as not something Voltura does", async () => {
    const prompt = await sentSystemPrompt();
    expect(prompt).toContain(
      "If the user asks about anything that is not on this list, say plainly that Voltura does not do it.",
    );
    // A-b: the list is there to be described from, not to silence the Assistant.
    expect(prompt).toContain("When asked what Voltura is or does, describe it from this list.");
  });

  it("A-c: no feed-in tariff, export revenue, net present value or compliance anywhere in the prompt", async () => {
    const prompt = await sentSystemPrompt();
    expect(prompt).not.toMatch(/feed-?in|export|net present value|\bNPV\b|compli|certif|conform|AI Act/i);
  });
});
