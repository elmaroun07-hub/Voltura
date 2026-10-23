import { isIP } from "node:net";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * H-D17: the one key every rate limiter in this API counts by.
 *
 * Render serves this API behind Cloudflare: live responses carry
 * `server: cloudflare` and a `cf-ray` id. With `trust proxy 1`, `req.ip`
 * resolved to a proxy address that changed from request to request. Measured
 * live on 23 Oct 2026 at a15dd1d: three consecutive requests from one client
 * to /api/screening/:ine/export.csv each answered `RateLimit: remaining=9`.
 * Every limiter in the app was counting each request as a new visitor, so
 * none of them limited anything.
 *
 * Cloudflare writes the connecting client's address into CF-Connecting-IP on
 * every request it proxies, replacing any value the client sent. That is the
 * address counted here. The hop count behind it is not published by Render, so
 * it is not guessed with a larger `trust proxy` number.
 *
 * Absent or not an IP address (a direct request in tests or local dev), the key
 * is `req.ip`, which is what the limiters used before this block. That fallback
 * is not proof the header arrives in production: the gate's live probe is.
 *
 * `ipKeyGenerator` groups an IPv6 address by its /56, so one host cannot rotate
 * through its own subnet to reset the count.
 */
export function clientKey(req: { get(name: string): string | undefined; ip?: string }): string {
  const forwarded = req.get("cf-connecting-ip")?.trim();
  if (forwarded && isIP(forwarded)) return ipKeyGenerator(forwarded);
  if (req.ip) return ipKeyGenerator(req.ip);
  // No address at all (a socket closed before the request was read). These
  // share one bucket rather than each getting an unlimited one.
  return "no-address";
}
