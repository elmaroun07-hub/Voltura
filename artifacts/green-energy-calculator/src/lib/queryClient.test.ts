import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H2b: the API writes its sentences (errors, the recommendation, the PDF) in
 * the language the request asks for. sessionFetch is the one place request
 * headers are set, so it is the one place the reader's choice must ride.
 */
describe("sessionFetch carries the reader's language", () => {
  const store = new Map<string, string>();
  const seen: Headers[] = [];

  beforeEach(() => {
    vi.resetModules();
    store.clear();
    seen.length = 0;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response("[]", { status: 200 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Spanish when nothing was chosen (2b.1)", async () => {
    const { sessionFetch } = await import("./queryClient");
    await sessionFetch("/api/history");
    expect(seen[0].get("Accept-Language")).toBe("es");
    expect(seen[0].get("X-Session-Id")).toBeTruthy();
  });

  it("sends the language the reader switched to, on the very next request", async () => {
    const { sessionFetch } = await import("./queryClient");
    const { setLocale } = await import("@/i18n");
    setLocale("en");
    await sessionFetch("/api/history");
    expect(seen[0].get("Accept-Language")).toBe("en");
    // ...and the choice is remembered for the next visit.
    expect(store.get("voltura.locale")).toBe("en");
  });

  it("starts in the remembered language on a later visit", async () => {
    store.set("voltura.locale", "en");
    const { sessionFetch } = await import("./queryClient");
    await sessionFetch("/api/history");
    expect(seen[0].get("Accept-Language")).toBe("en");
  });

  it("ignores a remembered value that is not a supported language", async () => {
    store.set("voltura.locale", "ar");
    const { sessionFetch } = await import("./queryClient");
    await sessionFetch("/api/history");
    expect(seen[0].get("Accept-Language")).toBe("es");
  });
});
