import type { NextFunction, Request, Response } from "express";

/**
 * H-HEADERS (operator ruling, 23 Oct 2026): the four security headers the API
 * did not send - measured live at 36457ba, none of them was present, and every
 * response announced `X-Powered-By: Express` (app.ts now disables that).
 *
 * The API serves JSON, an SSE stream, a PDF and a CSV, never a page, so the
 * strictest values cost nothing: nothing may load, nothing may frame it, no
 * referrer leaves it, no browser feature is granted. `nosniff` comes with them:
 * the web host adds it on its own, the API did not.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "X-Content-Type-Options": "nosniff",
};

/** Sets every header above on every response, error and rate-limit answers included. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  next();
}
