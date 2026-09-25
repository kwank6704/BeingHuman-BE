import { config } from './config.js';
import { HttpError } from './http.js';

export type LineUser = { sub: string; name?: string; exp: number };

// Verified tokens, so LINE is asked once per token rather than on every request.
const cache = new Map<string, LineUser>();

/**
 * Checks a LIFF ID token with LINE and returns who it belongs to.
 * https://developers.line.biz/en/reference/line-login/#verify-id-token
 * Throws 401 "token_expired" when the token is old, so the app knows to log in again.
 */
export async function verifyLineToken(idToken: string): Promise<LineUser> {
  if (!config.lineChannelId) throw new HttpError(401, 'LINE login is not configured on the server');
  const hit = cache.get(idToken);
  if (hit && hit.exp * 1000 > Date.now()) return hit;

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: config.lineChannelId }),
  });
  const body = (await res.json().catch(() => ({}))) as { sub?: string; name?: string; exp?: number; error_description?: string };
  if (!res.ok || !body.sub || !body.exp) {
    throw new HttpError(401, /expired/i.test(body.error_description ?? '') ? 'token_expired' : 'invalid LINE token');
  }

  if (cache.size > 1000) cache.clear();
  const user = { sub: body.sub, name: body.name, exp: body.exp };
  cache.set(idToken, user);
  return user;
}
