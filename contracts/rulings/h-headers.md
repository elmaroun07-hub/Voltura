BLOCK / GATE
H-HEADERS / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `36457ba` (main, live on both services)

TASKS CLAIMED CLOSED
- HH.1 API security headers, banner off
- HH.2 page CSP + referrer `<meta>`, production builds only
- HH.3 OPEN — live, after merge

DIFF SUMMARY
`artifacts/api-server/src/app.ts`, new `artifacts/api-server/src/lib/security-headers.ts` (+ test, 4), `artifacts/green-energy-calculator/vite.config.ts`, new `artifacts/green-energy-calculator/security-meta.ts` (+ `scripts/security-meta.test.mjs`, 7), this ruling, `contracts/blocks/h-headers.md`.

TEST EVIDENCE
- Typecheck 0. API suite 620 passed / 5 failed / 625 (the 5 container-local PDF euro-sign failures, green in CI). Web suite 30/30.
- Build with `VITE_API_URL=https://voltura-api.onrender.com`: `check-i18n` clean; built `index.html` opens `<head>` with the CSP `<meta>` (connect-src `'self' https://voltura-api.onrender.com`) and `<meta name="referrer" content="no-referrer">`.
- The live bundle (`/assets/index-ISgFtoxu.js` at `36457ba`) contains `https://voltura-api.onrender.com`, so Render's web build does set `VITE_API_URL`; the policy will carry the API origin.
- Mutations, each restored after: H1 middleware removed — KILLED; H2 banner back on — KILLED; H3 X-Frame-Options SAMEORIGIN — KILLED; H4 page CSP drops the API origin — KILLED; H5 inline scripts allowed — KILLED; H6 referrer `unsafe-url` — KILLED. 6/6.
- Found while testing: Express's 404 page overwrites the CSP with `default-src 'none'` (no frame-ancestors); X-Frame-Options DENY, Referrer-Policy, Permissions-Policy and nosniff survive. Pinned as found.

LIVE EVIDENCE
OPEN until merge.

ROLLBACK COMMAND
Pre-merge: demonstrated available — `main` unchanged at `36457ba`, branch unmerged.

RESIDUE
- Web page frameable, no Permissions-Policy (ruled). The dashboard route stays available: Render → Voltura-web → Settings → Headers.
- No in-browser render check before deploy (no browser in this session).

RULING
OPEN — pre-merge criteria met; merge is the operator's ruling (§14.2).
