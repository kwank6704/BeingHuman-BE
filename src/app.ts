import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config.js';
import { pool } from './db.js';
import { errorHandler } from './http.js';
import { memories } from './routes/memories.js';
import { me } from './routes/me.js';
import { cron } from './routes/cron.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '16kb' }));

// On Vercel, public/ (demo photos) is served by the CDN and uploads live in Vercel
// Blob; these two handlers only matter when running as a normal server.
app.use(express.static(path.resolve('public'), { maxAge: '7d' }));
app.use('/media', express.static(config.storageDir, {
  maxAge: '7d',
  immutable: true,
  fallthrough: false,
  // Voice notes are recorded as .webm; label them as audio, not video.
  setHeaders: (res, file) => { if (file.endsWith('.webm')) res.setHeader('Content-Type', 'audio/webm'); },
}));

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/memories', memories);
app.use('/api/me', me);
app.use('/api/cron', cron);
app.use(errorHandler);

export default app;
