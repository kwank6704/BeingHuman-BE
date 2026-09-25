import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../http.js';
import { sendMorningGreetings } from '../greeting.js';

/** True when the request carries "Authorization: Bearer <CRON_SECRET>" (what Vercel Cron sends). */
function fromCron(header: string | undefined): boolean {
  if (!config.cronSecret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${config.cronSecret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const cron = Router();

cron.use((req, _res, next) => {
  if (!fromCron(req.header('authorization'))) throw new HttpError(401, 'cron secret required');
  next();
});

/**
 * 07:00 Asia/Bangkok (vercel.json). GET is what Vercel Cron sends; POST is handy for a manual run.
 * `?dryRun=1` lists who would get what without sending anything.
 */
cron.all('/morning', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'use GET or POST');
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  if (!dryRun && !config.lineMessagingToken) throw new HttpError(503, 'LINE_MESSAGING_TOKEN is not set');
  res.json(await sendMorningGreetings({ dryRun }));
});
