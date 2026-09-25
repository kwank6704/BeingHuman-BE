import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { put, del } from '@vercel/blob';
import { config } from './config.js';

// Two drivers: Vercel Blob when BLOB_READ_WRITE_TOKEN is set (serverless has no
// persistent disk), otherwise local files under STORAGE_DIR served at /media.
// Blob keys are stored as full https URLs; local keys are "<userId>/<file>".
// "demo/..." keys are the seeded samples in public/media/demo and are never deleted.

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const isUrl = (key: string) => /^https?:\/\//.test(key);

export function extFor(mime: string): string | undefined {
  return EXT[mime.split(';')[0].trim().toLowerCase()];
}

/** Stores bytes for a user and returns the storage key. */
export async function saveFile(userId: string, data: Buffer, mime: string): Promise<string> {
  const name = `${userId}/${randomUUID()}.${extFor(mime) ?? 'bin'}`;
  if (useBlob()) {
    const blob = await put(name, data, { access: 'public', contentType: mime, addRandomSuffix: false });
    return blob.url;
  }
  const full = path.join(config.storageDir, name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return name;
}

/** Deletes a stored file. Shared demo assets are never removed. */
export async function removeFile(key: string | null): Promise<void> {
  if (!key || key.startsWith('demo/')) return;
  if (isUrl(key)) await del(key).catch(() => {});
  else await unlink(path.join(config.storageDir, key)).catch(() => {});
}

export function mediaUrl(key: string | null): string | null {
  if (!key) return null;
  return isUrl(key) ? key : `${config.publicUrl}/media/${key}`;
}
