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
  // Channel ID of the LINE Login channel that owns the LIFF app. When set, every request must carry a
  // LINE ID token; the X-User-Id header is then refused unless ALLOW_DEVICE_IDS=true.
  lineChannelId: env.LINE_CHANNEL_ID || '',
  allowDeviceIds: !env.LINE_CHANNEL_ID || env.ALLOW_DEVICE_IDS === 'true',

  // ── 07:00 morning message from the LINE Official Account (see src/greeting.ts) ──
  // Channel access token of the OA's Messaging API channel. Empty = morning messages off.
  lineMessagingToken: env.LINE_MESSAGING_TOKEN || '',
  // The LIFF app the message's button opens (same id as the frontend's NEXT_PUBLIC_LIFF_ID).
  liffId: env.LIFF_ID || '',
  // The deployed frontend, e.g. https://beinghuman-iota.vercel.app — turns relative /media/... photo
  // links into full URLs LINE can fetch for the message picture.
  appUrl: (env.APP_URL || '').replace(/\/$/, ''),
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; the cron endpoint refuses anything else.
  cronSecret: env.CRON_SECRET || '',
  // Overridable for tests only.
  lineApiBase: (env.LINE_API_BASE || 'https://api.line.me').replace(/\/$/, ''),
};
