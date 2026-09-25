import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config } from './config.js';
import { ensureUser } from './db.js';
import { verifyLineToken } from './line.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Works out who is calling:
 *  • `Authorization: Bearer <LIFF ID token>` — verified with LINE; the LINE user id is the identity.
 *  • `X-User-Id: <device id>` — trusted as-is; only accepted when LINE login is off (local development)
 *    or ALLOW_DEVICE_IDS=true.
 */
export async function withUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.header('authorization');
  if (auth?.startsWith('Bearer ')) {
    const line = await verifyLineToken(auth.slice(7).trim());
    res.locals.userId = await ensureUser(line.sub, line.name);
    return next();
  }
  if (!config.allowDeviceIds) return res.status(401).json({ error: 'login required' });
  const ext = req.header('x-user-id');
  if (!ext || !USER_ID.test(ext)) return res.status(401).json({ error: 'missing or invalid X-User-Id' });
  res.locals.userId = await ensureUser(ext);
  next();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
  }
  // Errors that already carry a 4xx status (e.g. express.static's 404, a malformed JSON body).
  const status = (err as { status?: number })?.status;
  if (status && status >= 400 && status < 500) return res.status(status).json({ error: (err as Error).message });
  console.error(err);
  res.status(500).json({ error: 'internal error' });
}
