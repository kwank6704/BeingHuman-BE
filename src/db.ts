import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

/** Returns the internal user id for a client-supplied external id, creating the user on first sight. */
export async function ensureUser(externalId: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (external_id) VALUES ($1)
     ON CONFLICT (external_id) DO UPDATE SET external_id = EXCLUDED.external_id
     RETURNING id`,
    [externalId],
  );
  return rows[0].id;
}
