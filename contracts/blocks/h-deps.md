# Block H-DEPS — dependency advisories closed before the Basis application

Opened 24 Oct 2026 from the cloud session. Branch `heatshield/h-deps` off `main` = `9b6d5c1` (live).

## Why

`pnpm audit` at `9b6d5c1`: 89 advisories (14 critical, 36 high, 31 moderate, 8 low). On the public `voltura-proof` (`a15dd1d` slice): 8 (2 critical tinypool, 2 high zod and body-parser, 3 moderate vitest, 1 low esbuild). Runtime ones in the API: body-parser (DoS on compressed bodies), proxy-addr, path-to-regexp, qs, ip-address, zod.

## Ruling (operator, 24 Oct 2026 13:45): "B should be fixed also C/D/E"

Gate B of the Basis screen = the dependency holes and a `voltura-proof` refreshed from current code, before applying. Moves the dependency items ahead of his 13:34 "after the applications" order.

## Tasks

| # | Task | Done when |
|---|---|---|
| D.1 | Patched versions: vitest 3 → 4.1.12 (drops tinypool), vite 7.3.7, orval 8.44, esbuild 0.28.2, floors for every transitive package the audit names, server-side zod 3.25.76 → 4.6.7 | `pnpm audit` re-run; typecheck 0; every suite at its baseline; both production builds pass; the built API boots and validates |
| D.2 | Behaviour unchanged: files importing the zod root (v3 API) import `zod/v3` from zod 4 — the same v3 code; `zod/v4` imports get the patched v4 core | suites + boot probes |
| D.3 | Live after merge: both services on the merge; calculator, Assistant, screening answer as before | probes |

## Fence

`package.json` version fields, `pnpm-workspace.yaml` (catalog, overrides, one package extension), `pnpm-lock.yaml`, two import lines (`chat/routes.ts`, `lib/api-zod/src/generated/api.ts`). No logic, no DDL, no regenerated code. The web app keeps zod 3.25.76 (its form resolver is built for zod 3); its zod validates the visitor's own input in the browser.

## Merge

Operator's ruling (§14.2). `--no-ff`. Rollback target: `9b6d5c1`.
