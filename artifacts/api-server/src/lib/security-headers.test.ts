import { describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

/**
 * H-HEADERS: the API's security headers, checked on the real app (app.ts) over
 * HTTP - on a normal answer, on a 404, and with no framework banner. The
 * database is stubbed; nothing here reaches it.
 */
vi.mock("../db", () => ({ db: {}, pool: {} }));
process.env.WEB_ORIGIN ??= "https://voltura-web.onrender.com";
const { default: app } = await import("../app");
const { SECURITY_HEADERS } = await import("./security-headers");

async function get(path: string) {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    await res.text();
    return res;
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe("H-HEADERS — every API response carries the security headers", () => {
  it("the values are the strict ones for an API that serves no page", () => {
    expect(SECURITY_HEADERS).toEqual({
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy":
        "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      "X-Content-Type-Options": "nosniff",
    });
  });

  it("a normal answer carries all of them", async () => {
    const res = await get("/api/version");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value);
  });

  it("Express's own error page keeps them, except that it writes its own CSP", async () => {
    // finalhandler (Express's 404/500 page) sets Content-Security-Policy to
    // "default-src 'none'", replacing ours and dropping frame-ancestors. The
    // page still cannot be framed: X-Frame-Options: DENY stays.
    const res = await get("/api/no-such-route");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
    for (const name of ["X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "X-Content-Type-Options"])
      expect(res.headers.get(name)).toBe(SECURITY_HEADERS[name]);
  });

  it("no longer announces the framework", async () => {
    const res = await get("/api/version");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});
