-- Manual prod catch-up migration — run against the Render Postgres (voltura-db).
-- Applied via Render's SQL console; kept in git so prod schema is reproducible.
-- Idempotent: safe to run repeatedly (IF NOT EXISTS throughout).
--
-- Brings prod in line with lib/db/src/schema/:
--   1. chat tables (models/chat.ts) — prerequisite for enabling the Assistant
--   2. three nullable calculations columns (schema.ts) added by commit ac6d02d

-- 1) Chat tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id serial PRIMARY KEY,
  title text NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2) calculations columns (all nullable — legacy rows stay valid) ─────────────

ALTER TABLE calculations ADD COLUMN IF NOT EXISTS installation_cost_eur real;
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS payback_years real;
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS lifetime_savings_eur real;

-- Verification ────────────────────────────────────────────────────────────────
-- Expect 2 rows:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN ('conversations','messages');
-- Expect 3 rows, all "real":
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='calculations'
--     AND column_name IN ('installation_cost_eur','payback_years','lifetime_savings_eur');
