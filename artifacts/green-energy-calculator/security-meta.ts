/**
 * H-HEADERS (operator ruling, 23 Oct 2026: "API code + page meta tags").
 *
 * voltura-web is a Render static site, so response headers are set only in
 * Render's dashboard. The ruling keeps this in code instead: the page carries
 * its Content-Security-Policy and referrer policy as <meta> tags. Two headers
 * cannot be expressed that way and are knowingly not set: X-Frame-Options and
 * Permissions-Policy (and the CSP's frame-ancestors, which browsers ignore in a
 * <meta>), so the page can still be framed.
 *
 * The policy lists what the built page actually loads, read from the source on
 * 23 Oct 2026: its own scripts, styles, fonts and images; Google Fonts (the
 * stylesheet from fonts.googleapis.com, the font files from fonts.gstatic.com);
 * and the API at VITE_API_URL - the same variable the app calls it through, so
 * the two cannot disagree. React and the chart and menu libraries write inline
 * style attributes, which need 'unsafe-inline' for styles. No inline script, no
 * eval, no frame, no worker. PDF and CSV downloads are blob: links.
 */
export function contentSecurityPolicy(apiUrl: string | undefined): string {
  const api = apiUrl && apiUrl.trim() ? new URL(apiUrl).origin : null;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    api ? `connect-src 'self' ${api}` : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export const REFERRER_POLICY = "no-referrer";

/** The two tags, first in <head> so they apply before anything loads. */
export function securityMetaTags(apiUrl: string | undefined) {
  return [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(apiUrl) }, injectTo: "head-prepend" as const },
    { tag: "meta", attrs: { name: "referrer", content: REFERRER_POLICY }, injectTo: "head-prepend" as const },
  ];
}
