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
  "Takes monthly solar irradiance and temperature for that point from NASA POWER, averaged over 2019-2023: twelve monthly values, not hourly data. Temperature affects only the modelled household consumption, not the solar generation. The latitude estimate is used in one case only: when NASA cannot be used at all - it does not reply, replies with an error status, or sends a reply Voltura cannot read. Voltura then estimates irradiance and temperature from the latitude and labels the result as that estimate, in the API response and on the page. When NASA does reply but marks months as having no data, or leaves months out, there is no estimate and no result: the calculation stops with an error.": {
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
  "Shows the annual energy saved in kWh - the consumption covered by solar or the battery - and a monthly chart with four series: Generation, Savings, Grid Import and \"Surplus not used\" (solar energy neither the home nor the battery could take, which Voltura puts no value on). The monthly chart has no battery series.": {
    // H2b: the series labels moved to the catalog; the chart's surplus series
    // is this dataKey, labelled "series.surplus" ("Surplus not used" in English).
    file: "artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx",
    symbol: 'surplus: m.surplusKwh',
  },
  "Shows the annual energy mix: Direct Solar, From Battery and Grid Import, as shares of consumption.": {
    // H2b: the slice label is the catalog's "mix.battery" ("From Battery" in English).
    file: "artifacts/green-energy-calculator/src/components/calculator/ResultsDisplay.tsx",
    symbol: 'name: t("mix.battery")',
  },
  "Estimates the CO2 avoided with a location-based grid carbon factor. Spain: the official REE factor, for mainland addresses only; an address in the Balearic or Canary Islands, Ceuta or Melilla, or a Spanish address whose region cannot be told, has no factor yet and the calculation is refused. United Kingdom: the official DESNZ factor. Australia, Austria, Belgium, Brazil, Canada, China, Denmark, Finland, France, Germany, Greece, India, Ireland, Italy, Japan, Mexico, Morocco, Netherlands, Norway, Poland, Portugal, Romania, South Korea, Sweden, Switzerland, Turkey and United States: an older factor with no cited source, which the results page does not mark as unsourced. Any other country has no factor, and the whole calculation is refused: no energy, money or CO2 result.": {
    file: "artifacts/api-server/src/lib/emissions/carbon-source.ts",
    symbol: "export function resolveCarbonSource(",
  },
  "Prices the saving only for Spain and the UK. There, a tariff the user types is always used. With no tariff typed, Spain uses Eurostat's 2025-S2 national household average while that figure is current. The UK has no national tariff in Voltura, so a UK saving is priced only when the user types a tariff. For any other country there is no money figure, even if the user types a tariff.": {
    file: "artifacts/api-server/src/lib/emissions/money.ts",
    symbol: "export function resolveMoney(",
  },
  "Computes a payback period and a 25-year ROI curve (savings rising 1.5% a year) when the saving is priced and an installation cost is known: the cost the user types (Spain and the UK only), or, in the UK only, DESNZ's average cost for PV-only systems up to 10 kW, which is not used when a battery is included. Spain has no sourced installation cost yet. Without a cost, payback shows as pending.": {
    file: "artifacts/api-server/src/lib/emissions/countries.ts",
    symbol: "export function roi(",
  },
  "Produces a downloadable PDF report of a calculation: the location and the inputs (annual usage, PV size, battery capacity and efficiency, tariff, panel orientation and roof angle), the result figures and the monthly table. The installation cost is not printed, and the PDF has no charts.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: 'app.get("/api/calculate/:id/pdf"',
  },
  "Keeps a history of past calculations. The calculations themselves are stored on Voltura's server; this browser keeps only a random id that links it to them. Another browser or device, or cleared site data, gets a new id and so an empty history; there are no user accounts.": {
    file: "artifacts/api-server/src/routes/routes.ts",
    symbol: "app.get(api.calculations.history.path",
  },
  "The AI Optimizer returns a recommended PV size in watts and a battery capacity in kWh as numbers, computed by a formula from the user's annual usage and location (NASA irradiance), using a fixed standard daily usage profile, not the user's own. The formula sizes the array so its yearly generation equals 100% of yearly use, and the battery for the profile's night-time share. The AI writes only the explanation shown with those numbers; it cannot change them.": {
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
