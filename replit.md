# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project Structure

### Artifacts
- `artifacts/api-server/` — Express 5 backend API (kind=api, preview path `/api`)
- `artifacts/green-energy-calculator/` — React + Vite frontend (kind=web, preview path `/`)
- `artifacts/mockup-sandbox/` — Design mockup sandbox (kind=design)

### Shared Libraries
- `lib/db/` — Drizzle ORM schema + DB client (`@workspace/db`)
  - `src/schema/schema.ts` — calculations, CARBON_INTENSITY_BY_COUNTRY, MonthlyEntry
  - `src/schema/models/chat.ts` — conversations, messages
- `lib/api-spec/` — OpenAPI spec (`@workspace/api-spec`)
- `lib/api-client-react/` — Generated React Query hooks (`@workspace/api-client-react`)

### Backend Routes (`artifacts/api-server/src/`)
- `routes/routes.ts` — Main app routes: POST /api/calculate, GET /api/history, POST /api/optimize, GET /api/calculate/:id/pdf
- `replit_integrations/chat/` — Chat routes (conversations, messages, OpenAI streaming)
- `shared-routes.ts` — API contract (paths, Zod schemas, types)
- `storage.ts` — DB storage layer for calculations
- `db.ts` — Drizzle DB client

### Frontend (`artifacts/green-energy-calculator/src/`)
- Uses Tailwind CSS v3 with custom green energy theme
- `lib/api.ts` — Frontend API contract (Zod schemas + types, no DB imports)
- `lib/queryClient.ts` — Custom React Query client
- `hooks/use-calculations.ts` — useHistory, useCalculate, useOptimize hooks
- `pages/` — Home (calculator), History, Optimizer, Assistant
- `components/calculator/` — CalculatorForm, ResultsDisplay (with recharts charts)
- `components/layout/Shell.tsx` — App shell with sidebar navigation

## Notes

- pdfkit and fontkit are externalized in api-server build (not bundled by esbuild)
- Frontend uses @/lib/api.ts for all API types (not @workspace/db — frontend must not import backend packages)
- Wouter Router uses `base={import.meta.env.BASE_URL}` for correct path routing
