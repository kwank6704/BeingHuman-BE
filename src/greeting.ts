import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { pool } from './db.js';
import { pickDaily, today } from './daily.js';
import { mediaUrl } from './storage.js';
import { listFor } from './routes/memories.js';
import { streakFor } from './routes/me.js';

// The 07:00 "สวัสดีตอนเช้าค่ะ" message from the LINE Official Account. The elder keeps the book
// themselves, so the card speaks to them about their own photos and invites them to add more:
//  • with photos — the first of today's photos, how many are waiting, the "N days in a row" streak,
//    and two buttons: ดูรูปวันนี้ / + เพิ่มรูปใหม่. Daily, until they've finished today's photos.
//  • no photos yet — an invitation to keep their first photo, at most every NO_PHOTO_EVERY days.
// It goes to elders who logged in with LINE and haven't turned it off. The LINE user id from the LIFF
// login is the one the OA pushes to only if the LINE Login channel and the OA's Messaging API channel
// belong to the same provider — and the elder must have added the OA as a friend.

const LINE_USER_ID = '^U[0-9a-f]{32}$';
const NO_PHOTO_EVERY = 3;

// App colours (app/industry.css): ink, accent, accent-700/800, muted ink.
const INK = '#1d1f20', ACCENT = '#5980a6', ACCENT_700 = '#416180', ACCENT_800 = '#2c455d', MUTED = '#5d5d60';

type Candidate = { id: string; external_id: string; nickname: string | null; greeted_on: string | null; has_photos: boolean };

export type GreetingResult = {
  date: string;
  dryRun: boolean;
  candidates: number;
  sent: number;
  failed: number;
  /** Set when LINE could not be reached or refused for rate/quota reasons; the rest were left for a later run. */
  stoppedEarly?: string;
  preview?: { to: string; photos: number; message: unknown }[];
};

/** Opens the LIFF app on a screen the frontend understands: ?screen=today or ?screen=add. */
function appLink(screen: 'today' | 'add'): string {
  if (config.liffId) return `https://liff.line.me/${config.liffId}?screen=${screen}`;
  return `${config.appUrl}/?screen=${screen}`;
}

/** A photo URL LINE can download: https and absolute. */
function absolute(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('/') && config.appUrl.startsWith('https://')) return config.appUrl + url;
  return null;
}

export type MorningCard = {
  nickname: string | null;
  /** How many of today's photos are waiting (0 = the book is still empty). */
  photos: number;
  /** The first of today's photos, or null. */
  imageUrl: string | null;
  /** Its name as the app shows it (caption, else "รูป" + relation). */
  firstTitle: string | null;
  /** Days in a row the elder finished today's photos, up to yesterday. */
  streak: number;
};

const text = (t: string, size: string, extra: Record<string, unknown> = {}) => ({ type: 'text', text: t, size, wrap: true, color: INK, ...extra });
const button = (label: string, uri: string, primary: boolean) => ({
  type: 'button', height: 'md', style: primary ? 'primary' : 'secondary', ...(primary && { color: ACCENT }),
  action: { type: 'uri', label, uri },
});

export function morningMessage(c: MorningCard) {
  const hello = 'สวัสดีตอนเช้าค่ะ' + (c.nickname ? ' ' + c.nickname : '');
  // On the card the name gets its own line, so a large "คุณแม่" never breaks as "คุณ / แม่".
  const helloCard = c.nickname ? 'สวัสดีตอนเช้าค่ะ\n' + c.nickname : hello;
  const add = appLink('add');

  if (c.photos === 0) {
    // The illustration from the rich menu, shipped with the frontend (public/line/invite.jpg).
    const art = absolute('/line/invite.jpg');
    return {
      type: 'flex',
      altText: `${hello} มาเก็บรูปแรกลงสมุดกันค่ะ`,
      contents: {
        type: 'bubble',
        ...(art && { hero: { type: 'image', url: art, size: 'full', aspectRatio: '40:27', aspectMode: 'cover', action: { type: 'uri', label: 'เพิ่มรูปแรก', uri: add } } }),
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          contents: [
            text(helloCard, 'xxl', { weight: 'bold' }),
            text('มาเก็บรูปแรกลงสมุดกันค่ะ', 'xl'),
            text('ถ่ายรูปคนที่รัก หรือถ่ายรูปเก่าในอัลบั้มก็ได้ แล้วเล่าเรื่องให้ฟังหน่อยนะคะ', 'lg', { color: MUTED }),
          ],
        },
        footer: { type: 'box', layout: 'vertical', contents: [button('+ เพิ่มรูปแรก', add, true)] },
      },
    };
  }

  const waiting = `วันนี้มีรูปที่คุณเก็บไว้ให้ดู ${c.photos} รูป`;
  const today = appLink('today');
  return {
    type: 'flex',
    altText: `${hello} ${waiting}`,
    contents: {
      type: 'bubble',
      ...(c.imageUrl && {
        hero: { type: 'image', url: c.imageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover', action: { type: 'uri', label: 'ดูรูปวันนี้', uri: today } },
      }),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          text(helloCard, 'xxl', { weight: 'bold' }),
          text(waiting, 'xl'),
          ...(c.firstTitle ? [text('รูปแรก · ' + c.firstTitle, 'lg', { color: ACCENT_700, weight: 'bold' })] : []),
          ...(c.streak > 0 ? [text(`✿ ดูรูปมาแล้ว ${c.streak} วันติดกัน วันนี้มาดูต่อกันนะคะ`, 'md', { color: ACCENT_800 })] : []),
          { type: 'separator', margin: 'lg' },
          text('มีรูปคนที่รักรูปไหนอยากเก็บเพิ่ม ถ่ายแล้วเล่าเรื่องให้ฟังได้เลยนะคะ', 'md', { color: MUTED, margin: 'lg' }),
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [button('ดูรูปวันนี้', today, true), button('+ เพิ่มรูปใหม่', add, false)],
      },
    },
  };
}

type PushOutcome = 'sent' | 'failed' | 'retry-later';

/** Pushes one message to one LINE user (also used by scripts/send-test-greeting.ts). */
export async function push(to: string, message: unknown): Promise<PushOutcome> {
  let res: Response;
  try {
    res = await fetch(`${config.lineApiBase}/v2/bot/message/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.lineMessagingToken}`,
        'Content-Type': 'application/json',
        'X-Line-Retry-Key': randomUUID(),
      },
      body: JSON.stringify({ to, messages: [message] }),
    });
  } catch (e) {
    console.error(`morning greeting to ${to}: could not reach LINE: ${(e as Error).message}`);
    return 'retry-later';
  }
  if (res.ok) return 'sent';
  const detail = await res.text().catch(() => '');
  console.error(`morning greeting to ${to} failed: ${res.status} ${detail.slice(0, 300)}`);
  // 429 = rate limit or the OA's monthly message quota; 5xx = LINE trouble. Worth another try later.
  return res.status === 429 || res.status >= 500 ? 'retry-later' : 'failed';
}

/** The card for one elder's real book today: today's photos, the first one's name, their streak. */
export async function cardFor(u: { id: string; nickname: string | null }, day = today()): Promise<MorningCard> {
  const picks = pickDaily(await listFor(u.id), day);
  const first = picks[0];
  return {
    nickname: u.nickname,
    photos: picks.length,
    imageUrl: first ? absolute(mediaUrl(first.image_key)) : null,
    firstTitle: first ? first.caption || 'รูป' + first.relation : null,
    streak: (await streakFor(u.id)).streak,
  };
}

/**
 * Sends today's morning message. With `dryRun`, sends nothing and returns what would be sent.
 * Each elder is claimed (greeted_on = today) before sending, so overlapping runs can't double-send;
 * the claim is released again when LINE asks us to retry later.
 */
export async function sendMorningGreetings({ dryRun = false } = {}): Promise<GreetingResult> {
  const day = today();
  const { rows } = await pool.query<Candidate>(
    `SELECT u.id, u.external_id, u.nickname, to_char(u.greeted_on, 'YYYY-MM-DD') AS greeted_on, p.has_photos
       FROM users u
      CROSS JOIN LATERAL (
        SELECT EXISTS (SELECT 1 FROM memories m WHERE m.user_id = u.id AND m.deleted_at IS NULL) AS has_photos
      ) p
      WHERE u.external_id ~ '${LINE_USER_ID}'
        AND COALESCE((u.settings->>'morningGreeting')::boolean, true)
        AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.user_id = u.id AND v.day = $1::date)
        -- daily with photos; an empty book only gets the invitation every ${NO_PHOTO_EVERY} days
        AND (u.greeted_on IS NULL OR u.greeted_on <= $1::date - CASE WHEN p.has_photos THEN 1 ELSE $2::int END)
      ORDER BY u.created_at`,
    [day, NO_PHOTO_EVERY],
  );

  const result: GreetingResult = { date: day, dryRun, candidates: rows.length, sent: 0, failed: 0 };
  if (dryRun) result.preview = [];

  for (const u of rows) {
    const card = await cardFor(u, day);
    const message = morningMessage(card);

    if (dryRun) {
      result.preview!.push({ to: u.external_id, photos: card.photos, message });
      continue;
    }

    const claimed = await pool.query(
      `UPDATE users SET greeted_on = $2::date WHERE id = $1 AND (greeted_on IS NULL OR greeted_on < $2::date)`,
      [u.id, day],
    );
    if (!claimed.rowCount) continue; // another run got here first

    const outcome = await push(u.external_id, message);
    if (outcome === 'sent') result.sent++;
    else if (outcome === 'failed') result.failed++;
    else {
      await pool.query('UPDATE users SET greeted_on = $2::date WHERE id = $1', [u.id, u.greeted_on]);
      result.stoppedEarly = 'LINE could not take messages right now (network, rate limit, monthly quota, or an outage); the rest are left for the next run';
      break;
    }
  }
  return result;
}
