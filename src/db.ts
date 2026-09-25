import pg from 'pg';
import { config } from './config.js';

// Serverless instances each hold their own pool; keep it small and use a pooled
// connection string (e.g. Neon's "-pooler" host) in production.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10_000,
});

/**
 * Returns the internal user id for an external id (LINE user id, or a device id), creating the user on
 * first sight. `displayName` (the LINE profile name) is kept up to date when given.
 */
export async function ensureUser(externalId: string, displayName?: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (external_id, display_name) VALUES ($1, $2)
     ON CONFLICT (external_id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
     RETURNING id`,
    [externalId, displayName ?? null],
  );
  return rows[0].id;
}
