// Sends the 07:00 morning card to ONE LINE user, right now, to see it in LINE.
//
//   npm run greeting:test -- <LINE user id> [nickname] [--real | --empty] [--dry]
//
//   (default) sample data — a demo photo, "3 รูป", a 4-day streak — just to see the design
//   --real    that person's real book from DATABASE_URL: the same card the 07:00 run would build today
//             (read-only; it does not count as today's greeting). Point DATABASE_URL at production to
//             check a real account — if the user id isn't found, the LINE Login and Messaging API
//             channels are probably in different providers, and the 07:00 run can't reach them.
//   --empty   sample card for a book with no photos yet (invitation to add the first one)
//   --dry     print the message instead of sending it
//
// Needs LINE_MESSAGING_TOKEN, LIFF_ID and APP_URL in .env. The user id is on LINE Developers →
// the OA's Messaging API channel → Basic settings → "Your user ID", and that account must have
// added the OA as a friend.
import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { cardFor, morningMessage, push, type MorningCard } from '../src/greeting.js';

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const [to, nickname] = args.filter(a => !a.startsWith('--'));
const dry = flag('--dry');

const missing = [
  !/^U[0-9a-f]{32}$/.test(to ?? '') && 'a LINE user id (U + 32 hex characters) as the first argument',
  !dry && !config.lineMessagingToken && 'LINE_MESSAGING_TOKEN in .env',
  !config.liffId && 'LIFF_ID in .env',
  !config.appUrl.startsWith('https://') && 'APP_URL in .env (the https frontend URL)',
].filter(Boolean);
if (missing.length) {
  console.error('Missing:\n  - ' + missing.join('\n  - '));
  process.exit(1);
}

async function realCard(): Promise<MorningCard | null> {
  const { rows } = await pool.query<{ id: string; nickname: string | null }>(
    'SELECT id, nickname FROM users WHERE external_id = $1', [to],
  );
  if (!rows.length) return null;
  const card = await cardFor(rows[0]);
  if (nickname) card.nickname = nickname; // optional override, e.g. to try another name
  return card;
}

let card: MorningCard | null;
if (flag('--real')) {
  const host = new URL(config.databaseUrl).host;
  card = await realCard().finally(() => pool.end());
  if (!card) {
    console.error(`No user with LINE id ${to} in the database at ${host}.`);
    console.error('Either this account has not opened the app through LINE yet (open the LIFF link once),');
    console.error('or the LINE Login channel and the OA\'s Messaging API channel are in different providers —');
    console.error('then the 07:00 run cannot reach this person either.');
    process.exit(1);
  }
  console.log(`Real book (${host}): ${card.photos} of today's photos, streak ${card.streak}, nickname ${card.nickname ?? '—'}`);
} else if (flag('--empty')) {
  card = { nickname: nickname || null, photos: 0, imageUrl: null, firstTitle: null, streak: 0 };
} else {
  card = {
    nickname: nickname || null,
    photos: 3,
    imageUrl: `${config.appUrl}/media/demo/fah-garden.jpg`,
    firstTitle: 'ฟ้า วิ่งเล่นหน้าบ้าน',
    streak: 4,
  };
  console.log('Sample card (made-up book: 3 photos, 4-day streak). Use --real for this person\'s actual book.');
}

const message = morningMessage(card);
if (dry) {
  console.log(JSON.stringify(message, null, 2));
} else {
  const outcome = await push(to, message);
  console.log(outcome === 'sent' ? `Sent to ${to} — check LINE.` : `Not sent (${outcome}); the reason is printed above.`);
  process.exitCode = outcome === 'sent' ? 0 : 1;
}
