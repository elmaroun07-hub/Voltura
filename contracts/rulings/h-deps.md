BLOCK / GATE
H-DEPS / pre-merge gate

DATE, COMMIT (before)
24 Oct 2026 · `9b6d5c1` (main, live on both services)

TASKS CLAIMED CLOSED
- D.1 patched versions — `pnpm audit` 89 → **2** (0 critical, 1 high, 1 moderate, 0 low)
- D.2 behaviour unchanged — suites at baseline, built API boots and validates as before
- D.3 live — **L1, L2 PASS** (below)

DIFF SUMMARY
`pnpm-workspace.yaml` (catalog vite ^7.3.7, zod 4.6.7; esbuild override 0.28.2; 23 patched floors; one `packageExtensions` entry), `pnpm-lock.yaml`, version fields in 8 `package.json` files (vitest ^4.1.12 ×5, esbuild ^0.28.2, orval ^8.44.0, vite ^7.3.7 in mockup-sandbox, web zod pinned 3.25.76), `from "zod"` → `from "zod/v3"` in `chat/routes.ts` and `lib/api-zod/src/generated/api.ts`; this ruling and `contracts/blocks/h-deps.md`.

TEST EVIDENCE
- Baseline at `9b6d5c1` (this container): typecheck 0; api-server 631/636 (the 5 = container-local PDF euro-sign failures, `pdf-report.test.ts`, green in CI); web 30/30; lib/cte 72/72; lib/i18n 17/17; lib/screening 104/104.
- After: **identical** — typecheck 0; api-server 631/636 (same 5, same file); web 30; cte 72; i18n 17; screening 104. `pnpm peers check`: no issues.
- Builds: api-server `build.mjs` (esbuild 0.28.2) exit 0; web `vite build` with `VITE_API_URL` exit 0.
- Boot: the built `dist/index.mjs` on a throwaway local Postgres 16 (schema via `@workspace/db push`): `/api/version` 200; calculate bad input → 400 "Please enter a valid location"; optimize 25-hour pattern → 400; optimize 30,000-element pattern → 400 in 2.5 ms; conversation title 201 chars → 400; create → 201; message blank / 4,001 chars → 400; history 200. Database deleted after.
- Mutations (each restored after): M1 body-parser floor dropped, resolved from `9b6d5c1`'s lockfile → body-parser advisory back — KILLED (from the new lockfile alone it survives: the lockfile carries the fix, the floor stops a fresh resolution going lower); M2 api-server vitest back to ^3 → tinypool critical ×2 + vitest back — KILLED; M3 server zod back to 3.25.76 → zod advisory back on api-server, lib/api-zod, lib/db — KILLED.

REMAINING (2, both in the web app's build or browser code, none in the API)
- **zod 3.25.76 (high, GHSA-mrhx-c7xc-m3w5)** — `green-energy-calculator` and `mockup-sandbox`. No fixed 3.x exists. The web's zod validates the visitor's own form input in their browser; the form resolver (`@hookform/resolvers` 3) is built for zod 3, and moving it needs form-typing changes (tried and backed out: v5 types the form's input and output apart and breaks 9 call sites).
- **postcss-selector-parser 6.1.5 (moderate, GHSA-rj75-hqrm-r3gf)** — Tailwind CSS 3 at build time, parsing the site's own CSS. Fixed only in 7.x, which Tailwind 3 does not accept.

LIVE EVIDENCE
Merge `1a04df3` (`--no-ff`, parents `9b6d5c1` + `24567f7`), pushed 14:11:02Z 24 Oct from the cloud session on the operator's ruling ("Merge and test now"). CI on the branch `40100765805` green (test, build, screening-postgis — the 5 PDF tests that fail in this container pass there). Render re-read before push: API autoDeploy on commit, branch main, 1 instance.
- **L1 PASS** — `/api/version` and the web `build-sha` both `1a04df3` at 14:12:30Z.
- **L2 PASS** (14:12:57Z, no rows written, no model, geocoder or NASA call): calculate bad input → 400 "Please enter a valid location"; optimize 25-hour pattern → 400 "energyPattern must carry one weight per hour of the day"; conversation title 201 chars → 400; history and conversations for a fresh session → 200 `[]`; screening summary → 200 (2.31 s, first read after deploy fills the cache); building list → 200, run `h3-index-v2-14021-2026-10-21T22:28:58.722Z`, total 32,431; unknown PDF → 404; all five security headers present, no `X-Powered-By`. Web: page, its JS (1,103,301 B) and CSS (95,044 B) → 200; `/cribado`, `/assistant`, `/optimizer`, `/history` → 200.
- **voltura-proof refreshed** on the operator's second ruling ("Push after merge"): commit `44f86d3` on its `main` (parent `5ce6fdc`), the 58 code and data files byte-identical to `1a04df3`, README names `1a04df3`. Fresh clone: 33 / 72 / 21 tests pass, also with the outside network cut; typecheck 0; `pnpm audit` "No known vulnerabilities found"; detect-secrets = the public ENPE PDF sha256 and lockfile integrity lines only. Its GitHub "About" text still names `a15dd1d`: this session cannot write repository settings (proxy 403), so that edit is the operator's.

ROLLBACK COMMAND
`git revert -m 1 1a04df3` — Tier B: computed on scratch ref `scratch/h-deps-revert-proof` before the push, revert `580c962`, its tree == `9b6d5c1`'s tree, 13 files against the merge. Cloud clone only, unpushed. **Deploy path UNPROVEN** (A13 debt stands).

RULING
**CLOSED (self-ruled under §14.2)** — 24 Oct 2026, `1a04df3`. L1, L2 pass; 2 advisories remain as recorded, both in the web app's own code.
