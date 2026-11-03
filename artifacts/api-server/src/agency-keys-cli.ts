/**
 * Issue, list and revoke agency access keys. Run on the API service, where the
 * database is reachable (it accepts no connections from outside Render):
 *
 *   node artifacts/api-server/dist/agency-keys-cli.mjs create "Agency name"
 *   node artifacts/api-server/dist/agency-keys-cli.mjs list
 *   node artifacts/api-server/dist/agency-keys-cli.mjs revoke <id>
 *
 * `create` prints the key once. It is not stored and cannot be shown again:
 * send it to the agency privately, and make a new one if it is lost.
 */
import pg from "pg";
import { createAgencyKey, ensureAgencyKeyTables, listAgencyKeys, revokeAgencyKey } from "./lib/agency-keys";

async function main(): Promise<number> {
  const [command, arg] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    return 1;
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureAgencyKeyTables(pool);
    if (command === "create" && arg) {
      const { id, key, label } = await createAgencyKey(pool, arg);
      console.log(`Key ${id} for "${arg.trim()}" (${label}...):`);
      console.log(key);
      console.log("Shown once. Send it privately; it cannot be shown again.");
      return 0;
    }
    if (command === "list") {
      console.table(await listAgencyKeys(pool));
      return 0;
    }
    if (command === "revoke" && arg && /^\d+$/.test(arg)) {
      const done = await revokeAgencyKey(pool, Number(arg));
      console.log(done ? `Key ${arg} revoked.` : `No active key with id ${arg}.`);
      return done ? 0 : 1;
    }
    console.error('Usage: create "Agency name" | list | revoke <id>');
    return 1;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
