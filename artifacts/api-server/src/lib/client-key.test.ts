import { describe, expect, it } from "vitest";
import { clientKey } from "./client-key";

/**
 * H-D17: the key every rate limiter counts by. A request object is enough -
 * clientKey reads one header and req.ip, nothing else.
 */
const req = (headers: Record<string, string>, ip?: string) => ({
  get: (name: string) => headers[name.toLowerCase()],
  ip,
});

describe("H-D17 — clientKey", () => {
  it("counts the address Cloudflare names, not the proxy address in req.ip", () => {
    expect(clientKey(req({ "cf-connecting-ip": "203.0.113.7" }, "10.0.0.1"))).toBe("203.0.113.7");
  });

  it("two requests through different proxies from one client get one key", () => {
    const a = clientKey(req({ "cf-connecting-ip": "203.0.113.7" }, "172.70.1.1"));
    const b = clientKey(req({ "cf-connecting-ip": "203.0.113.7" }, "172.70.9.9"));
    expect(a).toBe(b);
  });

  it("falls back to req.ip when the header is absent", () => {
    expect(clientKey(req({}, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("ignores a header that is not an IP address", () => {
    expect(clientKey(req({ "cf-connecting-ip": "not-an-ip" }, "198.51.100.4"))).toBe("198.51.100.4");
    expect(clientKey(req({ "cf-connecting-ip": "" }, "198.51.100.4"))).toBe("198.51.100.4");
  });

  it("groups an IPv6 client by its /56, so rotating within it does not reset the count", () => {
    const a = clientKey(req({ "cf-connecting-ip": "2001:db8:1:ff::1" }));
    const b = clientKey(req({ "cf-connecting-ip": "2001:db8:1:aa::99" }));
    const other = clientKey(req({ "cf-connecting-ip": "2001:db8:2::1" }));
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });

  it("a request with no address at all shares one bucket instead of getting its own", () => {
    expect(clientKey(req({}))).toBe("no-address");
  });
});
