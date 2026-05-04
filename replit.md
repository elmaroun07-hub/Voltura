# Green Energy Savings Calculator

A comprehensive full-stack web application for modeling residential solar + battery systems, with live NASA POWER irradiance data, 8760-hour simulation, AI optimization, and PDF reports.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI (Replit AI Integration) for chat assistant and system optimizer
- **Charts**: Recharts (bar chart, donut pie chart)
- **PDF**: pdfkit

## Key Features

### Calculation Engine (`server/routes.ts`)
1. **NASA POWER API** — Geocodes the location via Nominatim (OSM), then fetches 12-month irradiance (`ALLSKY_SFC_SW_DWN`) and temperature (`T2M`) from `power.larc.nasa.gov`. Falls back to latitude-based estimates if the API is unavailable.
2. **8760-hour battery simulation** — Hourly solar generation using monthly irradiance + bell-curve daily profile; ML-predicted consumption (features: month, hour, irradiance, temp); battery charge/discharge with round-trip efficiency (sqrt(η) per direction); monthly totals tracked.
3. **Country carbon intensity lookup** — Static table in `shared/schema.ts` covering 25+ countries; detected from geocoded location string.
4. **ML consumption prediction** — Formula-based model: base load × seasonal factor × hourly profile × temperature effect × lighting reduction.
5. **Carbon footprint tracking** — Computation CO₂ (CodeCarbon-style): duration × CPU power × carbon intensity → mg CO₂.
6. **Enhanced PDF reports** — Green-header PDF with summary table, results table, and 12-month breakdown table (pdfkit).

### New Inputs Added
- **Electricity Tariff** (€/kWh) — used to compute annual € savings
- **Battery Round-Trip Efficiency** (%) — applied as sqrt(η) per charge/discharge direction
- **Panel Tilt Angle** (°) — replaces/refines roofAngle; optimal ~35° with penalty for deviation

### Response Fields
- `savingsKwh`, `co2Reduction`, `annualSavingsEur` — key outputs
- `carbonIntensity` — g CO₂/kWh for detected country
- `avgIrradiance` — annual average kWh/m²/day from NASA
- `irradianceSource` — "NASA POWER API" or "Estimated (lat-based)"
- `monthlyData` — array of 12 `MonthlyEntry` objects with generation, consumption, savings, grid import, CO₂

## File Structure

```
shared/
  schema.ts          — DB schema + CARBON_INTENSITY_BY_COUNTRY + MonthlyEntry type + Zod schemas
  routes.ts          — API route definitions + shared types (CalculationResponse, etc.)

server/
  routes.ts          — Express route handlers (main calculation, PDF, optimize, history)
  storage.ts         — DatabaseStorage (Drizzle ORM)
  db.ts              — PostgreSQL pool + Drizzle instance
  index.ts           — Express app entry point
  replit_integrations/ — Chat, audio, image AI integration routes

client/src/
  pages/
    Home.tsx         — Calculator page (form + results side-by-side)
    History.tsx      — Past calculations table with PDF download
    Optimizer.tsx    — AI system size optimizer
    Assistant.tsx    — AI chat assistant
  components/
    calculator/
      CalculatorForm.tsx   — Form with all inputs including advanced params
      ResultsDisplay.tsx   — KPI cards + monthly bar chart + donut + recommendation + PDF button
    layout/
      Shell.tsx            — Sidebar navigation layout
  hooks/
    use-calculations.ts    — TanStack Query hooks for calculations
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session signing secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (Replit integration)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI base URL (Replit integration)

## Running

The `Start application` workflow runs `npm run dev` which starts both Express (port 5000) and Vite dev server on the same port.

To apply schema changes: `npm run db:push`
