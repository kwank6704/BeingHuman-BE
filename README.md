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

## ข้อความทักทายตอนเช้า (LINE OA, 07:00)

ทุกเช้า LINE OA ส่งการ์ดทักทาย พูดกับผู้สูงอายุเรื่องสมุดของตัวเอง และชวนให้เก็บรูปเพิ่ม มี 2 แบบ:

| สมุด | การ์ด | ปุ่ม |
| --- | --- | --- |
| **มีรูปแล้ว** | รูปแรกของรูปวันนี้, "สวัสดีตอนเช้าค่ะ \<ชื่อเรียก\>", "วันนี้มีรูปที่คุณเก็บไว้ให้ดู 3 รูป", ชื่อรูปแรก, "ดูรูปมาแล้ว N วันติดกัน" (ถ้ามี) และคำชวนเก็บรูปเพิ่ม | **ดูรูปวันนี้** (`?screen=today`) / **+ เพิ่มรูปใหม่** (`?screen=add`) |
| **ยังไม่มีรูป** | ภาพประกอบ (`public/line/invite.jpg` ของหน้าเว็บ) + "มาเก็บรูปแรกลงสมุดกันค่ะ" | **+ เพิ่มรูปแรก** (`?screen=add`) |

ปุ่มเปิดแอปใน LINE (`https://liff.line.me/<LIFF_ID>?screen=…`) ตรงไปหน้านั้นเลย

**ส่งให้ใคร:** คนที่ login ด้วย LINE, วันนี้ยังไม่ได้ดูรูปวันนี้จนจบ, และไม่ได้ปิดไว้ (`settings.morningGreeting = false` ผ่าน `PATCH /api/me`)
— คนที่มีรูปได้วันละครั้ง คนที่ยังไม่มีรูปได้คำชวน **ทุก 3 วัน** (ไม่ตื๊อทุกวัน) และ cron รันซ้ำก็ไม่ส่งซ้ำ

### ตั้งค่า (Vercel → BeingHuman-BE → Settings → Environment Variables)

| ตัวแปร | เอามาจาก |
| --- | --- |
| `LINE_MESSAGING_TOKEN` | LINE Developers → channel **Messaging API** ของ OA → แท็บ Messaging API → **Channel access token (long-lived)** → Issue |
| `LIFF_ID` | LIFF ID เดียวกับหน้าเว็บ เช่น `2011737325-i60YjxK4` |
| `APP_URL` | URL หน้าเว็บ เช่น `https://beinghuman-iota.vercel.app` (ใช้ทำลิงก์รูปในข้อความ) |
| `CRON_SECRET` | สุ่มข้อความยาวๆ เอง (เช่น 32 ตัวอักษรขึ้นไป) — Vercel Cron ส่งค่านี้มาให้เองทุกครั้ง |

แล้ว **Redeploy** — ตารางเวลาอยู่ใน `vercel.json` (`0 0 * * *` = 00:00 UTC = **07:00 เวลาไทย**) Vercel อ่านเองตอน deploy
ดูได้ที่แท็บ **Settings → Cron Jobs** ของโปรเจกต์ (กด **Run** เพื่อลองส่งทันทีได้)

ต้องรัน migration `003_morning_greeting.sql` บนฐานข้อมูลก่อน (`npm run migrate` ใน BeingHuman-Database)

### เงื่อนไขที่ต้องเป็นจริง ไม่อย่างนั้นข้อความไม่ถึง

- channel **LINE Login** (ที่มี LIFF) กับ channel **Messaging API** ของ OA ต้องอยู่ **Provider เดียวกัน** — LINE user id ถึงจะตรงกัน
- ผู้สูงอายุต้อง **เพิ่ม OA เป็นเพื่อน** และไม่ได้บล็อก
- **จำนวนข้อความต่อเดือนของ OA มีจำกัด** ตามแพ็กเกจ (แพ็กเกจฟรีส่งได้น้อย) ส่งทุกวันใช้ประมาณ 30 ข้อความ/คน/เดือน
  ถ้าเกินโควตา LINE จะตอบ 429 ระบบจะหยุดและลองใหม่รอบถัดไป ดูโควตาได้ที่ LINE OA Manager
- Vercel แพ็กเกจฟรี (Hobby) ให้ cron รันวันละครั้ง และอาจคลาดได้ภายในชั่วโมงนั้น (07:00–07:59)

### ลองโดยไม่ส่งจริง

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://<backend>/api/cron/morning?dryRun=1"
```

ได้รายชื่อคนที่จะได้ข้อความ และตัวข้อความ (Flex Message) โดยไม่ส่งอะไรออกไป — ตัด `?dryRun=1` ออกเพื่อส่งจริง
ผลลัพธ์บอก `sent` / `failed` / `stoppedEarly` และ error ของแต่ละคนอยู่ในแท็บ **Logs**

**ส่งการ์ดให้บัญชีเดียว** (ดูใน LINE จริง) — ใส่ `LINE_MESSAGING_TOKEN`, `LIFF_ID`, `APP_URL` ใน `.env` แล้ว:

```bash
npm run greeting:test -- <LINE user id> --real            # การ์ดจากสมุดจริงของคนนั้น (ตัวเดียวกับที่ 07:00 จะส่ง)
npm run greeting:test -- <LINE user id> คุณแม่            # ตัวอย่าง: ข้อมูลสมมติ 3 รูป, 4 วันติดกัน (ดูดีไซน์)
npm run greeting:test -- <LINE user id> คุณแม่ --empty    # ตัวอย่าง: การ์ดชวนเพิ่มรูปแรก
```

`--real` อ่านจาก `DATABASE_URL` เท่านั้น (ไม่แก้ข้อมูล ไม่นับเป็นข้อความของวันนี้) — จะดูบัญชีจริงให้ตั้ง `DATABASE_URL` เป็นของ Neon
ถ้าขึ้นว่า **ไม่พบ user** แปลว่าบัญชีนี้ยังไม่เคยเปิดแอปผ่าน LINE หรือ channel LINE Login กับ Messaging API อยู่คนละ Provider
(กรณีหลัง 07:00 ก็จะส่งหาคนนี้ไม่ได้)

LINE user id ของตัวเองอยู่ที่ channel Messaging API ของ OA → Basic settings → **Your user ID** (ต้องเพิ่ม OA เป็นเพื่อนก่อน) ใส่ `--dry` เพื่อดูข้อความโดยไม่ส่ง

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
| GET/POST | `/api/cron/morning` | `Authorization: Bearer <CRON_SECRET>`; `?dryRun=1` | `{ date, candidates, sent, failed, stoppedEarly? }` — the 07:00 LINE message (not per-user; no `X-User-Id`) |
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
