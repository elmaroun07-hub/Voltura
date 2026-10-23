import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, REFERRER_POLICY, securityMetaTags } from "../security-meta.ts";

/** H-HEADERS: the page's CSP and referrer policy, built from VITE_API_URL. */
const API = "https://voltura-api.onrender.com";
const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("H-HEADERS — the page's Content-Security-Policy", () => {
  it("lets the page call its API, and only that origin besides itself", () => {
    expect(directives(contentSecurityPolicy(API))["connect-src"]).toEqual(["'self'", API]);
  });

  it("takes the origin of VITE_API_URL, dropping any path", () => {
    expect(directives(contentSecurityPolicy(`${API}/v1/`))["connect-src"]).toEqual(["'self'", API]);
  });

  it("with no API address, the page may call only itself", () => {
    expect(directives(contentSecurityPolicy(undefined))["connect-src"]).toEqual(["'self'"]);
    expect(directives(contentSecurityPolicy(" "))["connect-src"]).toEqual(["'self'"]);
  });

  it("allows no inline script and no eval", () => {
    const d = directives(contentSecurityPolicy(API));
    expect(d["script-src"]).toEqual(["'self'"]);
    expect(contentSecurityPolicy(API)).not.toMatch(/unsafe-eval/);
  });

  it("allows Google Fonts' stylesheet and font files, and nothing else from outside", () => {
    const d = directives(contentSecurityPolicy(API));
    expect(d["style-src"]).toEqual(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
    expect(d["font-src"]).toEqual(["'self'", "https://fonts.gstatic.com"]);
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
  });

  it("refuses a malformed API address at build time rather than shipping a broken policy", () => {
    expect(() => contentSecurityPolicy("not a url")).toThrow();
  });
});

describe("H-HEADERS — the tags", () => {
  it("are the CSP and a no-referrer policy, both first in <head>", () => {
    const tags = securityMetaTags(API);
    expect(tags).toEqual([
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(API) }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "no-referrer" }, injectTo: "head-prepend" },
    ]);
    expect(REFERRER_POLICY).toBe("no-referrer");
  });
});
