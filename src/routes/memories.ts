import { Router, type Request } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { HttpError, withUser } from '../http.js';
import { extFor, mediaUrl, removeFile, saveFile } from '../storage.js';
import { pickDaily, today } from '../daily.js';

type Row = {
  id: string;
  relation: string;
  caption: string | null;
  favorite: boolean;
  image_key: string;
  voice_key: string | null;
  voice_duration_sec: number;
  created_at: Date;
};

const COLS = 'm.id, m.relation, m.caption, m.favorite, m.image_key, m.voice_key, m.voice_duration_sec, m.created_at';

const toDto = (r: Row) => ({
  id: r.id,
  relation: r.relation,
  caption: r.caption,
  favorite: r.favorite,
  imageUrl: mediaUrl(r.image_key)!,
  voiceUrl: mediaUrl(r.voice_key),
  voiceDurationSec: r.voice_duration_sec,
  createdAt: r.created_at.toISOString(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  // Vercel functions reject request bodies over 4.5 MB, so stay under it there.
  limits: { fileSize: (process.env.VERCEL ? 4 : 15) * 1024 * 1024, files: 2 },
});

const UUID = /^[0-9a-f-]{36}$/i;

async function listFor(userId: string): Promise<Row[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLS}
       FROM memories m JOIN relations r ON r.code = m.relation
      WHERE m.user_id = $1 AND m.deleted_at IS NULL
      ORDER BY r.sort_order, m.created_at DESC`,
    [userId],
  );
  return rows;
}

async function relationOrThrow(value: unknown): Promise<string> {
  const relation = String(value || 'ครอบครัว');
  const exists = await pool.query('SELECT 1 FROM relations WHERE code = $1', [relation]);
  if (!exists.rowCount) throw new HttpError(400, 'unknown relation');
  return relation;
}

/** Trimmed caption, or null when empty. */
function captionOf(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (s.length > 80) throw new HttpError(400, 'caption is longer than 80 characters');
  return s || null;
}

const durationOf = (value: unknown) => Math.max(0, Math.min(600, Math.round(Number(value) || 0)));

function voiceOrThrow(voice: Express.Multer.File | undefined) {
  if (voice && (!voice.mimetype.startsWith('audio/') || !extFor(voice.mimetype))) throw new HttpError(400, 'unsupported voice format');
}

export const memories = Router();
memories.use(withUser);

memories.get('/', async (_req, res) => {
  res.json({ memories: (await listFor(res.locals.userId)).map(toDto) });
});

memories.get('/today', async (req, res) => {
  const day = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : today();
  res.json({ date: day, memories: pickDaily(await listFor(res.locals.userId), day).map(toDto) });
});

memories.post(
  '/',
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'voice', maxCount: 1 }]),
  async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const image = files?.image?.[0];
    const voice = files?.voice?.[0];
    if (!image || !image.mimetype.startsWith('image/') || !extFor(image.mimetype)) throw new HttpError(400, 'image (jpeg/png/webp/heic) is required');
    voiceOrThrow(voice);

    const relation = await relationOrThrow(req.body.relation);
    const caption = captionOf(req.body.caption);
    const dur = voice ? durationOf(req.body.voiceDurationSec) : 0;

    const userId: string = res.locals.userId;
    const imageKey = await saveFile(userId, image.buffer, image.mimetype);
    const voiceKey = voice ? await saveFile(userId, voice.buffer, voice.mimetype) : null;
    try {
      const { rows } = await pool.query<Row>(
        `INSERT INTO memories AS m (user_id, relation, caption, image_key, image_mime, voice_key, voice_mime, voice_duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLS}`,
        [userId, relation, caption, imageKey, image.mimetype, voiceKey, voice ? voice.mimetype : null, dur],
      );
      res.status(201).json({ memory: toDto(rows[0]) });
    } catch (e) {
      await Promise.all([removeFile(imageKey), removeFile(voiceKey)]);
      throw e;
    }
  },
);

/** Change who is in the photo, its name, or whether it is a favourite. */
memories.patch('/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new HttpError(404, 'not found');
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [req.params.id, res.locals.userId];
  if ('relation' in body) { vals.push(await relationOrThrow(body.relation)); sets.push(`relation = $${vals.length}`); }
  if ('caption' in body) { vals.push(captionOf(body.caption)); sets.push(`caption = $${vals.length}`); }
  if ('favorite' in body) { vals.push(body.favorite === true); sets.push(`favorite = $${vals.length}`); }
  if (!sets.length) throw new HttpError(400, 'nothing to update');

  const { rows } = await pool.query<Row>(
    `UPDATE memories m SET ${sets.join(', ')}
      WHERE m.id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL
      RETURNING ${COLS}`,
    vals,
  );
  if (!rows.length) throw new HttpError(404, 'not found');
  res.json({ memory: toDto(rows[0]) });
});

/** Record (or re-record) the story of a photo that is already in the book. */
memories.put('/:id/voice', upload.single('voice'), async (req: Request<{ id: string }>, res) => {
  if (!UUID.test(req.params.id)) throw new HttpError(404, 'not found');
  const voice = req.file;
  if (!voice) throw new HttpError(400, 'voice is required');
  voiceOrThrow(voice);

  const userId: string = res.locals.userId;
  const { rows: old } = await pool.query<{ voice_key: string | null }>(
    'SELECT voice_key FROM memories WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [req.params.id, userId],
  );
  if (!old.length) throw new HttpError(404, 'not found');

  const voiceKey = await saveFile(userId, voice.buffer, voice.mimetype);
  const { rows } = await pool.query<Row>(
    `UPDATE memories m SET voice_key = $3, voice_mime = $4, voice_duration_sec = $5
      WHERE m.id = $1 AND m.user_id = $2
      RETURNING ${COLS}`,
    [req.params.id, userId, voiceKey, voice.mimetype, durationOf(req.body.voiceDurationSec)],
  );
  await removeFile(old[0].voice_key);
  res.json({ memory: toDto(rows[0]) });
});

// Deleting only hides the photo, so the elder can take it back ("เอาคืน").
// Files are removed for good by purgeDeleted() once the grace period is over.
memories.delete('/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new HttpError(404, 'not found');
  const { rowCount } = await pool.query(
    'UPDATE memories SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [req.params.id, res.locals.userId],
  );
  if (!rowCount) throw new HttpError(404, 'not found');
  // Serverless has no background timer (see index.ts), so clean up old deletes here.
  if (process.env.VERCEL) await purgeDeleted().catch(e => console.error('purge failed:', e.message));
  res.status(204).end();
});

memories.post('/:id/restore', async (req, res) => {
  if (!UUID.test(req.params.id)) throw new HttpError(404, 'not found');
  const { rows } = await pool.query<Row>(
    `UPDATE memories m SET deleted_at = NULL
      WHERE m.id = $1 AND m.user_id = $2 AND m.deleted_at IS NOT NULL
      RETURNING ${COLS}`,
    [req.params.id, res.locals.userId],
  );
  if (!rows.length) throw new HttpError(404, 'not found');
  res.json({ memory: toDto(rows[0]) });
});

/** Permanently removes memories deleted more than `days` ago, with their files. */
export async function purgeDeleted(days = 7): Promise<number> {
  const { rows } = await pool.query<Pick<Row, 'image_key' | 'voice_key'>>(
    `DELETE FROM memories WHERE deleted_at < now() - make_interval(days => $1)
     RETURNING image_key, voice_key`,
    [days],
  );
  await Promise.all(rows.flatMap(r => [removeFile(r.image_key), removeFile(r.voice_key)]));
  return rows.length;
}
