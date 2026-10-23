# Block H-HEADERS — security headers on the API, and a page policy on the web

Opened 23 Oct 2026 from the cloud session. Branch `heatshield/h-headers` off `main` = `36457ba` (live).

## Why

Asked about CSP, X-Frame-Options, Referrer-Policy and Permissions-Policy. Measured live at `36457ba`: the web (`voltura-web`, a Render static site) sends only `strict-transport-security` and `x-content-type-options` (Render's own); the API sends none of the four, no `nosniff`, and `X-Powered-By: Express`.

## Ruling (operator, 23 Oct 2026 ~23:12): "API code + page meta tags"

Offered: (1) API in code + four web header rules he pastes into Render's dashboard; (2) API in code + `<meta>` tags on the page; (3) API only. Chosen (2), knowing the web page stays frameable and without Permissions-Policy: a static site's headers exist only in Render's settings, which this session's Render tools cannot write, and `X-Frame-Options`, `Permissions-Policy` and the CSP's `frame-ancestors` have no `<meta>` form.

## Tasks

| # | Task | Done when |
|---|---|---|
| HH.1 | API: CSP `default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a deny-all `Permissions-Policy`, `nosniff`, on every response; `X-Powered-By` off | over HTTP on the real app; mutations fail |
| HH.2 | Web: CSP and `no-referrer` as `<meta>` first in `<head>`, production builds only; `connect-src` from the same `VITE_API_URL` the app calls | function tests; built page inspected; mutations fail |
| HH.3 | Live: API headers present; page carries both tags; the page still works | probes + operator's own look at the page |

The CSP lists what the page loads, read from the source and the built bundle: own files, Google Fonts (`fonts.googleapis.com` stylesheet, `fonts.gstatic.com` files), the API. Inline style attributes need `'unsafe-inline'` for styles; no inline script, no eval, no frames, no workers. **This session has no browser** (Playwright's download is blocked), so whether the page renders under the policy is checked live after deploy.

## Fence

`app.ts`, new `lib/security-headers.ts`, `vite.config.ts`, new `security-meta.ts`, their tests. No dependency, no DDL. Known: Express's own 404/500 page writes its own CSP (`default-src 'none'`), replacing ours; `X-Frame-Options: DENY` still covers framing there.

## Merge

Operator's ruling (§14.2). `--no-ff`. Rollback target: `36457ba`.
