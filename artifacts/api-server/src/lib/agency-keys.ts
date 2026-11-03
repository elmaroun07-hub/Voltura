import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";

/**
 * Agency access keys (operator ruling 3 Nov 2026).
 *
 * The public screening shows buildings with two or more dwellings; single-
 * family houses are scored but not published one by one. An agency the
 * maintainer works with gets an access key, issued by hand with
 * `agency-keys-cli`, and with it sees every scored building.
 *
 * - A key is 32 random bytes, base64url, behind the prefix `vak_`. It is shown
 *   once, when it is made, and never stored: the table keeps its SHA-256. A
 *   key this random needs no slow hash; a stolen table gives nothing to guess.
 * - A key can be revoked; a revoked key stops working at once.
 * - Every request made with a valid key is logged (key, time, method, path).
 * - No passwords, accounts or emails: nothing else about a person is stored.
 */

export const AGENCY_KEY_PREFIX = "vak_";
const KEY_FORMAT = /^vak_[A-Za-z0-9_-]{43}$/;

export function generateAgencyKey(): string {
  return AGENCY_KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function isAgencyKeyFormat(key: string): boolean {
  return KEY_FORMAT.test(key);
}

export function hashAgencyKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** The first characters after the prefix: enough to tell keys apart in a list, useless to sign in. */
export function agencyKeyLabel(key: string): string {
  return key.slice(0, AGENCY_KEY_PREFIX.length + 6);
}

export interface Agency {
  readonly keyId: number;
  readonly agencyName: string;
}

/** Idempotent, run at boot like ensureChatTables. */
export async function ensureAgencyKeyTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agency_keys (
      id serial PRIMARY KEY,
      agency_name text NOT NULL,
      key_hash text NOT NULL UNIQUE,
      key_label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz,
      last_used_at timestamptz
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agency_key_uses (
      id bigserial PRIMARY KEY,
      key_id integer NOT NULL REFERENCES agency_keys(id),
      used_at timestamptz NOT NULL DEFAULT now(),
      method text NOT NULL,
      path text NOT NULL
    );
  `);
}

/** A valid, unrevoked key's agency, or null. A malformed key never reaches the database. */
export async function verifyAgencyKey(pool: Pool, key: string): Promise<Agency | null> {
  if (!isAgencyKeyFormat(key)) return null;
  const r = await pool.query<{ id: number; agency_name: string }>(
    `SELECT id, agency_name FROM agency_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hashAgencyKey(key)],
  );
  const row = r.rows[0];
  return row ? { keyId: row.id, agencyName: row.agency_name } : null;
}

export async function logAgencyKeyUse(pool: Pool, keyId: number, method: string, path: string): Promise<void> {
  await pool.query(`INSERT INTO agency_key_uses (key_id, method, path) VALUES ($1, $2, $3)`, [keyId, method, path]);
  await pool.query(`UPDATE agency_keys SET last_used_at = now() WHERE id = $1`, [keyId]);
}

export async function createAgencyKey(pool: Pool, agencyName: string): Promise<{ id: number; key: string; label: string }> {
  const name = agencyName.trim();
  if (!name) throw new Error("An agency name is required.");
  const key = generateAgencyKey();
  const label = agencyKeyLabel(key);
  const r = await pool.query<{ id: number }>(
    `INSERT INTO agency_keys (agency_name, key_hash, key_label) VALUES ($1, $2, $3) RETURNING id`,
    [name, hashAgencyKey(key), label],
  );
  return { id: r.rows[0].id, key, label };
}

export async function revokeAgencyKey(pool: Pool, id: number): Promise<boolean> {
  const r = await pool.query(`UPDATE agency_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  return r.rowCount !== null && r.rowCount > 0;
}

export async function listAgencyKeys(pool: Pool) {
  const r = await pool.query(
    `SELECT k.id, k.agency_name, k.key_label, k.created_at, k.revoked_at, k.last_used_at,
            (SELECT count(*)::int FROM agency_key_uses u WHERE u.key_id = k.id) AS uses
       FROM agency_keys k ORDER BY k.id`,
  );
  return r.rows;
}
