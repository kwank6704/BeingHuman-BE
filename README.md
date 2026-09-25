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

## Deploy ขึ้น Vercel

ต้องมี: repo นี้อยู่บน GitHub และบัญชี [vercel.com](https://vercel.com) (login ด้วย GitHub)

1. **สร้างโปรเจกต์** — บน Vercel กด **Add New… → Project** → เลือก **BeingHuman-BE** → Framework Preset จะขึ้นเป็น **Express** เอง → กด **Deploy**
   รอบแรก `/health` จะยัง error เพราะยังไม่มีฐานข้อมูล — ไม่เป็นไร จด URL ไว้ เช่น `https://beinghuman-be.vercel.app`
2. **ฐานข้อมูล** — ในโปรเจกต์นี้ไปแท็บ **Storage → Create Database → Neon** (Region: **Singapore**) แล้ว connect กับโปรเจกต์นี้
   Vercel จะเพิ่ม `DATABASE_URL` (แบบ pooled — backend ใช้ตัวนี้) และ `DATABASE_URL_UNPOOLED` ให้เอง
3. **สร้างตาราง** — ทำจากเครื่องตัวเองครั้งเดียว ดู [BeingHuman-Database → Deploy](https://github.com/kwank6704/BeingHuman-Database#deploy-ฐานข้อมูลบน-neon-vercel)
4. **ที่เก็บไฟล์** — แท็บ **Storage → Create Database → Blob** แล้ว connect กับโปรเจกต์นี้ → Vercel เพิ่ม `BLOB_READ_WRITE_TOKEN` ให้เอง
   (Vercel ไม่มีดิสก์ถาวร เจอตัวแปรนี้แล้ว backend จะเก็บรูป/เสียงใน Blob อัตโนมัติ)
5. **Redeploy** — แท็บ **Deployments** → **⋯** ที่อันล่าสุด → **Redeploy** (ตัวแปรใหม่ใช้ได้หลัง deploy ใหม่)
6. **ตรวจ** — เปิด `https://<backend>/health` ต้องเห็น `{"ok":true}` แล้วไป deploy หน้าเว็บต่อ ([BeingHuman](https://github.com/kwank6704/BeingHuman#deploy-ขึ้น-vercel))

บน Vercel อัปโหลดได้ไฟล์ละไม่เกิน 4 MB (Vercel ไม่รับ request เกิน 4.5 MB) — แอปย่อรูปเหลือ ~1400px และเสียง 3 นาทีไม่ถึง 1 MB จึงแทบไม่เจอ
ถ้ามีปัญหา ดู error ที่แท็บ **Logs** ของโปรเจกต์

## API

Every `/api` request says who is calling, one of:

- `Authorization: Bearer <LIFF ID token>` — checked with LINE ([verify ID token](https://developers.line.biz/en/reference/line-login/#verify-id-token))
  against `LINE_CHANNEL_ID`; the LINE user id becomes the user. An expired token gets `401 {"error":"token_expired"}`
  and the app logs in again.
- `X-User-Id: <device id>` — trusted as-is. Only accepted when `LINE_CHANNEL_ID` is empty (local development) or
  `ALLOW_DEVICE_IDS=true`.

Unknown users are created on first use.

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

Relations: ลูก, หลาน, คู่ชีวิต, พี่น้อง, เพื่อน, ตัวเอง, ครอบครัว, สัตว์เลี้ยง, สถานที่. Uploads are capped at 15 MB per file (4 MB on Vercel).
Settings: `textSize` normal|large|xlarge, `theme` light|dark, `autoSpeak`, `speechRate` slow|normal, `onboarded`.
`public/media/demo/` holds the seeded sample photos and is never deleted by the API.
Uploads go to `STORAGE_DIR` locally, or Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set.

## Not done yet

- Media URLs are unguessable UUIDs but not access-controlled.
- Vercel Blob URLs are public (unguessable, but anyone with the link can open the file).
