import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { config } from './config.js';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};

export function extFor(mime: string): string | undefined {
  return EXT[mime.split(';')[0].trim().toLowerCase()];
}

/** Writes bytes under <storage>/<userId>/ and returns the storage key. */
export async function saveFile(userId: string, data: Buffer, mime: string): Promise<string> {
  const key = `${userId}/${randomUUID()}.${extFor(mime) ?? 'bin'}`;
  const full = path.join(config.storageDir, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

/** Deletes a stored file. Shared demo assets are never removed. */
export async function removeFile(key: string | null): Promise<void> {
  if (!key || key.startsWith('demo/')) return;
  await unlink(path.join(config.storageDir, key)).catch(() => {});
}

export function mediaUrl(key: string | null): string | null {
  return key ? `${config.publicUrl}/media/${key}` : null;
}
