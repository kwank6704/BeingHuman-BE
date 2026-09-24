import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { pool, ensureUser } from '../db.js';
import { extFor, mediaUrl, removeFile, saveFile } from '../storage.js';
import { pickDaily, today } from '../daily.js';

type Row = {
  id: string;
  relation: string;
  image_key: string;
  voice_key: string | null;
  voice_duration_sec: number;
  created_at: Date;
};

const toDto = (r: Row) => ({
  id: r.id,
  relation: r.relation,
  imageUrl: mediaUrl(r.image_key)!,
  voiceUrl: mediaUrl(r.voice_key),
  voiceDurationSec: r.voice_duration_sec,
  createdAt: r.created_at.toISOString(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
});

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Identity comes from the X-User-Id header (LIFF user id or device id).
// TODO: verify a LIFF ID token instead of trusting the header once LINE login is wired up.
async function withUser(req: Request, res: Response, next: NextFunction) {
  const ext = req.header('x-user-id');
  if (!ext || !USER_ID.test(ext)) return res.status(401).json({ error: 'missing or invalid X-User-Id' });
  res.locals.userId = await ensureUser(ext);
  next();
}

async function listFor(userId: string): Promise<Row[]> {
  const { rows } = await pool.query<Row>(
    `SELECT m.id, m.relation, m.image_key, m.voice_key, m.voice_duration_sec, m.created_at
       FROM memories m JOIN relations r ON r.code = m.relation
      WHERE m.user_id = $1
      ORDER BY r.sort_order, m.created_at DESC`,
    [userId],
  );
  return rows;
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
    if (voice && (!voice.mimetype.startsWith('audio/') || !extFor(voice.mimetype))) throw new HttpError(400, 'unsupported voice format');

    const relation = String(req.body.relation || 'ครอบครัว');
    const exists = await pool.query('SELECT 1 FROM relations WHERE code = $1', [relation]);
    if (!exists.rowCount) throw new HttpError(400, 'unknown relation');
    const dur = voice ? Math.max(0, Math.min(600, Math.round(Number(req.body.voiceDurationSec) || 0))) : 0;

    const userId: string = res.locals.userId;
    const imageKey = await saveFile(userId, image.buffer, image.mimetype);
    const voiceKey = voice ? await saveFile(userId, voice.buffer, voice.mimetype) : null;
    try {
      const { rows } = await pool.query<Row>(
        `INSERT INTO memories (user_id, relation, image_key, image_mime, voice_key, voice_mime, voice_duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, relation, image_key, voice_key, voice_duration_sec, created_at`,
        [userId, relation, imageKey, image.mimetype, voiceKey, voice ? voice.mimetype : null, dur],
      );
      res.status(201).json({ memory: toDto(rows[0]) });
    } catch (e) {
      await Promise.all([removeFile(imageKey), removeFile(voiceKey)]);
      throw e;
    }
  },
);

memories.delete('/:id', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw new HttpError(404, 'not found');
  const { rows } = await pool.query<Pick<Row, 'image_key' | 'voice_key'>>(
    'DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING image_key, voice_key',
    [req.params.id, res.locals.userId],
  );
  if (!rows.length) throw new HttpError(404, 'not found');
  await Promise.all([removeFile(rows[0].image_key), removeFile(rows[0].voice_key)]);
  res.status(204).end();
});

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(413).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'internal error' });
}
