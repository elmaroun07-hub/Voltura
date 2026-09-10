import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getLlmClient,
  llmApiKey,
  llmBaseUrl,
  llmModel,
  resetLlmClient,
} from "./llm";

/**
 * The provider is configuration, not a literal.
 *
 * The base URL and model were hardcoded `https://api.mistral.ai/v1` and
 * `mistral-small-latest` in two files, each with its own copy of the accessor.
 * When the Mistral quota went to zero the API had no way to point elsewhere
 * without a code change and a deploy.
 *
 * What these tests pin: the three env vars take effect, the MISTRAL_API_KEY
 * fallback works so a rollback needs no env edit, and the defaults still
 * reproduce the old hardcoded behaviour exactly.
 *
 * G10: nothing here reaches the network. Constructing an OpenAI client opens no
 * socket — the SDK is configuration until a request is made, and no request is
 * made. There is no fetch stub because there is nothing to stub.
 */

const KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "MISTRAL_API_KEY"] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // The client memoises the key and base URL it was built with, so a stale one
  // would answer for the previous test's environment.
  resetLlmClient();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetLlmClient();
});

describe("llm config — the base URL comes from the environment", () => {
  it("uses LLM_BASE_URL when set", () => {
    process.env.LLM_BASE_URL = "https://api.openai.com/v1";
    expect(llmBaseUrl()).toBe("https://api.openai.com/v1");
  });

  it("reaches the client the request actually uses", () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

    // Asserted on the constructed client, not on the helper: a getter that
    // returns the right string while the client is built from something else
    // would pass a helper-only test and still call the wrong host.
    expect(getLlmClient().baseURL).toBe("https://api.anthropic.com/v1");
  });

  it("defaults to Mistral, reproducing the old hardcoded value", () => {
    expect(llmBaseUrl()).toBe("https://api.mistral.ai/v1");
  });

  it("treats a blank value as unset rather than as an empty host", () => {
    process.env.LLM_BASE_URL = "   ";
    expect(llmBaseUrl()).toBe("https://api.mistral.ai/v1");
  });

  it("trims surrounding whitespace, which a copied env value carries", () => {
    process.env.LLM_BASE_URL = "  https://api.openai.com/v1  ";
    expect(llmBaseUrl()).toBe("https://api.openai.com/v1");
  });
});

describe("llm config — the model comes from the environment", () => {
  it("uses LLM_MODEL when set", () => {
    process.env.LLM_MODEL = "gpt-4o-mini";
    expect(llmModel()).toBe("gpt-4o-mini");
  });

  it("defaults to mistral-small-latest, the old hardcoded value", () => {
    expect(llmModel()).toBe("mistral-small-latest");
  });

  it("is read at call time, so a restart is enough to switch model", () => {
    // A module-level const would freeze this at first import and make a switch
    // need a rebuild. Two reads, two answers, same process.
    process.env.LLM_MODEL = "first-model";
    expect(llmModel()).toBe("first-model");
    process.env.LLM_MODEL = "second-model";
    expect(llmModel()).toBe("second-model");
  });
});

describe("llm config — the key, and the MISTRAL_API_KEY fallback", () => {
  it("prefers LLM_API_KEY", () => {
    process.env.LLM_API_KEY = "new-name";
    process.env.MISTRAL_API_KEY = "old-name";
    expect(llmApiKey()).toBe("new-name");
    expect(getLlmClient().apiKey).toBe("new-name");
  });

  it("falls back to MISTRAL_API_KEY when LLM_API_KEY is unset", () => {
    // This is the rollback path: reverting the commit leaves a deployment whose
    // only key is MISTRAL_API_KEY, and it must keep working with no env edit.
    process.env.MISTRAL_API_KEY = "old-name-only";
    expect(llmApiKey()).toBe("old-name-only");
    expect(getLlmClient().apiKey).toBe("old-name-only");
  });

  it("falls back when LLM_API_KEY is present but blank", () => {
    process.env.LLM_API_KEY = "";
    process.env.MISTRAL_API_KEY = "old-name-only";
    expect(llmApiKey()).toBe("old-name-only");
  });

  it("throws naming both variables when neither is set", () => {
    expect(() => getLlmClient()).toThrow(/LLM_API_KEY/);
    expect(() => getLlmClient()).toThrow(/MISTRAL_API_KEY/);
  });

  it("stays lazy — a missing key is not a boot failure", () => {
    // Importing this module with no key set must not throw. If it did, the
    // container would die on start and /api/healthz would stop answering for a
    // calculator that needs no model at all.
    expect(llmApiKey()).toBeUndefined();
    expect(llmBaseUrl()).toBe("https://api.mistral.ai/v1");
    expect(llmModel()).toBe("mistral-small-latest");
  });

  it("memoises the client, so one config serves the whole process", () => {
    process.env.LLM_API_KEY = "test-key";
    expect(getLlmClient()).toBe(getLlmClient());
  });
});
