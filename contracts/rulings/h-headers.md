BLOCK / GATE
H-HEADERS / pre-merge gate

DATE, COMMIT (before)
23 Oct 2026 · `36457ba` (main, live on both services)

TASKS CLAIMED CLOSED
- HH.1 API security headers, banner off
- HH.2 page CSP + referrer `<meta>`, production builds only
- HH.3 live — **L1, L2, L3 PASS** (below)

DIFF SUMMARY
`artifacts/api-server/src/app.ts`, new `artifacts/api-server/src/lib/security-headers.ts` (+ test, 4), `artifacts/green-energy-calculator/vite.config.ts`, new `artifacts/green-energy-calculator/security-meta.ts` (+ `scripts/security-meta.test.mjs`, 7), this ruling, `contracts/blocks/h-headers.md`.

TEST EVIDENCE
- Typecheck 0. API suite 620 passed / 5 failed / 625 (the 5 container-local PDF euro-sign failures, green in CI). Web suite 30/30.
- Build with `VITE_API_URL=https://voltura-api.onrender.com`: `check-i18n` clean; built `index.html` opens `<head>` with the CSP `<meta>` (connect-src `'self' https://voltura-api.onrender.com`) and `<meta name="referrer" content="no-referrer">`.
- The live bundle (`/assets/index-ISgFtoxu.js` at `36457ba`) contains `https://voltura-api.onrender.com`, so Render's web build does set `VITE_API_URL`; the policy will carry the API origin.
- Mutations, each restored after: H1 middleware removed — KILLED; H2 banner back on — KILLED; H3 X-Frame-Options SAMEORIGIN — KILLED; H4 page CSP drops the API origin — KILLED; H5 inline scripts allowed — KILLED; H6 referrer `unsafe-url` — KILLED. 6/6.
- Found while testing: Express's 404 page overwrites the CSP with `default-src 'none'` (no frame-ancestors); X-Frame-Options DENY, Referrer-Policy, Permissions-Policy and nosniff survive. Pinned as found.

LIVE EVIDENCE
Merge `b4f7667` (`--no-ff`, parents `36457ba` + `2edf654`), pushed 23:26:54Z 23 Oct from the cloud session on the operator's ruling ("Merge now"). CI on the branch `40038717335` green (API 625/625, web 30/30). Render was not re-read before this push (last read 23:05Z; re-read before the next push, unchanged: autoDeploy on commit, branch main).
- **L1 PASS** — API and web live on `b4f7667` at 23:28:26Z.
- **L2 PASS** — measured live after the push, and again at 02:00:47Z 24 Oct on `9b6d5c1` (no header change since): `/api/version` sends the five headers exactly as `SECURITY_HEADERS`, no `X-Powered-By`; the served page opens `<head>` with the CSP `<meta>` (connect-src `'self' https://voltura-api.onrender.com`) and `<meta name="referrer" content="no-referrer">`; the web host itself sends only `nosniff`, as ruled.
- **L3 PASS** — 23 Oct ~23:30 local, the operator opened the site on his phone under the new CSP: "it's okay", and sent the PDF of a production calculation made then, **121** (Fuengirola, 5,000 kWh, 4,000 W, 10 kWh, €0.267/kWh → 3,860 kWh / €1,030 / 333 kg). Page, API calls, calculation and PDF download all work under the CSP. Fonts not checked separately.

ROLLBACK COMMAND
`git revert -m 1 b4f7667` — Tier B: computed on a scratch ref before the push, revert `f64491c`, its tree == `36457ba`'s tree. Cloud clone only, unpushed. **Deploy path UNPROVEN** (A13 debt stands).

RESIDUE
- Web page frameable, no Permissions-Policy (ruled). The dashboard route stays available: Render → Voltura-web → Settings → Headers.
- No in-browser render check before deploy (no browser in this session); L3 was the operator's phone after deploy.

RULING
**CLOSED (self-ruled under §14.2)** — 24 Oct 2026, `b4f7667`. L1, L2, L3 pass.
