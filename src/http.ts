import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ensureUser } from './db.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Identity comes from the X-User-Id header (LIFF user id or device id).
// TODO: verify a LIFF ID token instead of trusting the header once LINE login is wired up.
export async function withUser(req: Request, res: Response, next: NextFunction) {
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
