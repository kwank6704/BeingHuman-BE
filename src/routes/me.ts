import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError, withUser } from '../http.js';
import { today } from '../daily.js';

/** Display settings the elder picks for themselves. Anything else sent is dropped. */
const SETTINGS: Record<string, (v: unknown) => boolean> = {
  textSize: v => v === 'normal' || v === 'large' || v === 'xlarge',
  theme: v => v === 'light' || v === 'dark',
  autoSpeak: v => typeof v === 'boolean',
  speechRate: v => v === 'slow' || v === 'normal',
  onboarded: v => typeof v === 'boolean',
  morningGreeting: v => typeof v === 'boolean', // the 07:00 LINE message; on unless set to false
};

function cleanSettings(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'settings must be an object');
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!SETTINGS[k]) continue;
    if (!SETTINGS[k](v)) throw new HttpError(400, `invalid ${k}`);
    out[k] = v;
  }
  return out;
}

const prevDay = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);

/** Consecutive days with a visit, ending today (or yesterday, so the streak survives until the day is over). */
export async function streakFor(userId: string): Promise<{ streak: number; visitedToday: boolean }> {
  const { rows } = await pool.query<{ day: string }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day FROM visits WHERE user_id = $1 ORDER BY day DESC LIMIT 400`,
    [userId],
  );
  const days = rows.map(r => r.day);
  const now = today();
  const visitedToday = days[0] === now;
  let expect = visitedToday ? now : prevDay(now);
  let streak = 0;
  for (const d of days) {
    if (d !== expect) break;
    streak++;
    expect = prevDay(expect);
  }
  return { streak, visitedToday };
}

async function profile(userId: string) {
  const { rows } = await pool.query<{ nickname: string | null; settings: Record<string, unknown> }>(
    'SELECT nickname, settings FROM users WHERE id = $1',
    [userId],
  );
  return { nickname: rows[0].nickname, settings: rows[0].settings, ...(await streakFor(userId)) };
}

export const me = Router();
me.use(withUser);

me.get('/', async (_req, res) => {
  res.json(await profile(res.locals.userId));
});

me.patch('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const userId: string = res.locals.userId;
  if ('nickname' in body) {
    const nick = body.nickname == null ? null : String(body.nickname).replace(/\s+/g, ' ').trim() || null;
    if (nick && nick.length > 40) throw new HttpError(400, 'nickname is longer than 40 characters');
    await pool.query('UPDATE users SET nickname = $2 WHERE id = $1', [userId, nick]);
  }
  if ('settings' in body) {
    await pool.query('UPDATE users SET settings = settings || $2::jsonb WHERE id = $1', [userId, JSON.stringify(cleanSettings(body.settings))]);
  }
  res.json(await profile(userId));
});

/** Marks that the elder looked at today's photos. */
me.post('/visit', async (_req, res) => {
  const userId: string = res.locals.userId;
  await pool.query('INSERT INTO visits (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, today()]);
  res.json(await streakFor(userId));
});
