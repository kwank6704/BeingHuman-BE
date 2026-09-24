import { config } from './config.js';

export const DAILY_COUNT = 3;

// FNV-1a, same as the prototype, so a day's picks are stable across reopens.
function hash(str: string): number {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

/** Calendar date (YYYY-MM-DD) in the configured zone. */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.dailyTimeZone }).format(now);
}

export function pickDaily<T extends { id: string }>(items: T[], day: string, count = DAILY_COUNT): T[] {
  return items
    .map(m => ({ m, h: hash(m.id + day) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, count)
    .map(x => x.m);
}
