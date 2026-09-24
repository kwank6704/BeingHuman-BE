import path from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://beinghuman:beinghuman@localhost:5432/beinghuman',
  corsOrigin: (env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim()),
  storageDir: path.resolve(env.STORAGE_DIR || './storage'),
  // Prefix for media URLs. Empty = relative "/media/..." (the frontend proxies it).
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
  dailyTimeZone: env.TZ_DAILY || 'Asia/Bangkok',
};
