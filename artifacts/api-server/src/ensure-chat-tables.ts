import { pool } from "./db";
import { logger } from "./lib/logger";

/**
 * Idempotent startup migration for the AI Assistant chat tables.
 * Matches lib/db/src/schema/models/chat.ts exactly.
 * Safe to run on every boot: CREATE TABLE IF NOT EXISTS is a no-op
 * when the tables already exist (including half-migrated states where
 * only `conversations` was created).
 */
export async function ensureChatTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "conversations" (
      "id" serial PRIMARY KEY,
      "title" text NOT NULL,
      "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "messages" (
      "id" serial PRIMARY KEY,
      "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
      "role" text NOT NULL,
      "content" text NOT NULL,
      "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  logger.info("Chat tables ensured (conversations, messages)");
}
