# BeingHuman-BE

Express + TypeScript API for **สมุดความทรงจำ** (Memory Book). Stores photos and voice stories on disk and
their metadata in PostgreSQL ([BeingHuman-Database](https://github.com/kwank6704/BeingHuman-Database)).
The Next.js client is [BeingHuman](https://github.com/kwank6704/BeingHuman).

## Run

> วิธีรันทั้งระบบ (ฐานข้อมูล + backend + หน้าเว็บ) ทีละขั้น อยู่ที่ [BeingHuman README](https://github.com/kwank6704/BeingHuman#วิธีรันในเครื่อง-getting-started)

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:4000
```

Start the database first (`npm run db:up && npm run seed` in BeingHuman-Database).
`npm run build && npm start` for production.

## API

Every `/api` request carries `X-User-Id` (the LIFF user id, or a device id). Unknown ids are created on first use.

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/health` | | `{ ok: true }` |
| GET | `/api/memories` | | `{ memories: Memory[] }` grouped by relation, newest first |
| GET | `/api/memories/today` | `?date=YYYY-MM-DD` (optional) | `{ date, memories }` — 3 photos, stable for the whole day (Asia/Bangkok) |
| POST | `/api/memories` | multipart: `image` (required), `relation`, `caption`, `voice`, `voiceDurationSec` | `201 { memory }` |
| PATCH | `/api/memories/:id` | JSON `{ relation?, caption?, favorite? }` | `{ memory }` |
| PUT | `/api/memories/:id/voice` | multipart: `voice`, `voiceDurationSec` | `{ memory }` — replaces the old story |
| DELETE | `/api/memories/:id` | | `204` — hidden, restorable for 7 days, then purged with its files |
| POST | `/api/memories/:id/restore` | | `{ memory }` (undo a delete) |
| GET | `/api/me` | | `{ nickname, settings, streak, visitedToday }` |
| PATCH | `/api/me` | JSON `{ nickname?, settings? }` | same as GET; settings are merged and validated |
| POST | `/api/me/visit` | | `{ streak, visitedToday }` — marks today's photos as seen |
| GET | `/media/<key>` | | the stored photo / voice file |

```ts
type Memory = {
  id: string; relation: string; caption: string | null; favorite: boolean;
  imageUrl: string; voiceUrl: string | null; voiceDurationSec: number;
  createdAt: string;
};
```

Relations: ลูก, หลาน, คู่ชีวิต, พี่น้อง, เพื่อน, ตัวเอง, ครอบครัว, สัตว์เลี้ยง, สถานที่.
Settings: `textSize` normal|large|xlarge, `theme` light|dark, `autoSpeak`, `speechRate` slow|normal, `onboarded`. Uploads are capped at 15 MB per file.
`storage/demo/` holds the seeded sample photos and is never deleted by the API.

## Not done yet

- `X-User-Id` is trusted as-is. Before going live, verify a LIFF ID token (`liff.getIDToken()`) against LINE and
  derive the user from it; media URLs are unguessable UUIDs but not access-controlled.
- Local-disk storage; swap `src/storage.ts` for S3/GCS when deploying to more than one instance.
