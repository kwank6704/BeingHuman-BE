import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import { memories, errorHandler } from './routes/memories.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
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
app.use(errorHandler);
