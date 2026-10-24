BLOCK / GATE
H-DEPS / pre-merge gate

DATE, COMMIT (before)
24 Oct 2026 · `9b6d5c1` (main, live on both services)

TASKS CLAIMED CLOSED
- D.1 patched versions — `pnpm audit` 89 → **2** (0 critical, 1 high, 1 moderate, 0 low)
- D.2 behaviour unchanged — suites at baseline, built API boots and validates as before
- D.3 OPEN — live, after merge

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
OPEN until merge.

ROLLBACK COMMAND
Pre-merge: `main` unchanged at `9b6d5c1`, branch unmerged.

RULING
OPEN — pre-merge criteria met; merge is the operator's ruling (§14.2).
