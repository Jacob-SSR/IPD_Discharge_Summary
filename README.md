# IPD Discharge Summary + AI แนะนำรหัส (รพ.พลับพลาชัย)

สรุปเวชระเบียนผู้ป่วยใน (Discharge Summary) จาก HOSxP แบบอ่านอย่างเดียว พร้อมระบบแนะนำรหัส ICD-10-TM / ICD-9-CM
(Gemini หรือ engine แบบกฎ) ที่แพทย์ต้องยืนยันทีละรหัส — Next.js 16 (App Router) + TypeScript

> กฎของโปรเจกต์ (ห้ามเขียน HOSxP, de-identification, paid tier ฯลฯ) อยู่ใน [CLAUDE.md](CLAUDE.md)

## เริ่มใช้งานโหมด demo (ไม่ต้องต่อ HOSxP)

```bash
npm install
cp .env.example .env.local
# แก้ .env.local: JWT_SECRET (openssl rand -hex 32), DEMO_PASSWORD
npm run dev            # http://localhost:3000  → login ด้วย DEMO_USERNAME / DEMO_PASSWORD
```

โหมด demo ใช้ข้อมูลสมมติ 26 ราย (`lib/demo/data.ts`), codebook ชุดย่อย (`data/codebooks/demo/`),
ตาราง TDRG ค่าสมมติ (`data/tdrg/demo/`) และเก็บฐานข้อมูลแอปเป็นไฟล์ `.data/appdb.json`

ถ้าตั้ง `GEMINI_API_KEY` + `GEMINI_MODEL` ระบบจะเรียก Gemini (free tier ใช้ได้เฉพาะโหมด demo)
ถ้าไม่ตั้ง จะใช้ engine แบบกฎแทนโดยอัตโนมัติ

## หน้าจอ

| หน้า | ทำอะไร |
|---|---|
| `/patients` | รายชื่อผู้ป่วยใน — กรองช่วงวัน admit / จำหน่าย แยกกัน, ช่วงด่วน, แพทย์ผู้จำหน่าย / ผู้รับไว้ / ผู้วินิจฉัยหลัก, หอผู้ป่วย, AN/HN · แท็บ **รอสรุป** (ยังไม่มี PDx ใน iptdiag หรือยังนอนอยู่) |
| `/patients/[an]` | แบบฟอร์ม A4 (พิมพ์/บันทึก PDF), Export Excel, คัดลอกรหัสไปลง HOSxP, คำแนะนำรหัส (ยอมรับ/ไม่ยอมรับทีละรหัส), เพิ่มรหัสเอง (OR/Non-OR + วันที่), ตรวจกฎ MB1–MB5 / dagger-asterisk / sequelae / external cause / codebook, ร่าง Course in hospital, DRG/RW จริง + ค่าประมาณ |
| `/reports/rw` | RW/AdjRW จริงจาก `an_stat`, CMI รายเดือน/หอ/แพทย์, ประมาณการรายรับ สปสช. |
| `/reports/ai` | ผลงาน AI: อัตรายอมรับ, sensitivity (เทียบรหัสที่แพทย์เพิ่มเอง), AdjRW ที่เพิ่ม (ประมาณ) |
| `/system` | ตรวจการเชื่อมต่อ HOSxP (รวมตรวจว่า user อ่านอย่างเดียวจริง), ฐานแอป, Redis, AI, codebook, ตาราง TDRG |

## ต่อ HOSxP จริง (เครื่องใน LAN)

1. ให้ DBA สร้าง user อ่านอย่างเดียว: [`docs/sql/create_readonly_user.sql`](docs/sql/create_readonly_user.sql) (แนะนำต่อ Slave/Replica)
2. เตรียมฐานข้อมูลของแอป (MySQL/MariaDB แยกจาก HOSxP) แล้วตั้ง `APP_DB_URL` — ตารางถูกสร้างอัตโนมัติ (`lib/appdb/schema.ts`)
3. ตั้ง `.env.local`: `APP_MODE=hosxp`, `HOSXP_DB_*`, `HOSXP_DB_CHARSET` (`tis620` หรือ `latin1`)
4. ตรวจโครงสร้าง: `npm run check-schema` — พิมพ์เฉพาะชื่อตาราง/ฟิลด์ที่ไม่มีจริง (ไม่พิมพ์ข้อมูลผู้ป่วย)
   ถ้าพบ ให้แก้ `lib/hosxp/queries.ts` และ `lib/hosxp/schema.ts` คู่กัน (โดยเฉพาะ `ipt.dch_doctor`)
5. สร้างบัญชี: `npm run create-user -- <username> DOCTOR "<ชื่อ>"` (role `DOCTOR`/`ADMIN` ยืนยันรหัสได้, `USER` ดูอย่างเดียว)
6. เปิด `/system` ตรวจว่าทุกช่องเขียว
7. ใช้ Gemini กับข้อมูลจริง: ต้องเปิด billing แล้วตั้ง `GEMINI_PAID_TIER=true` (ไม่ตั้ง = ใช้ engine แบบกฎ)

## Docker (server ใน LAN)

```bash
cp .env.example .env.production   # กรอกค่าจริง
docker compose up -d --build      # app + redis → http://<เครื่องนี้>:3600
```

build ไม่ต้องใช้ค่า env (อ่านตอน runtime ทั้งหมด) แต่เครื่องที่ build ต้องต่อเน็ตได้ (โหลดฟอนต์ Prompt/Sarabun)

## คำสั่ง

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # vitest (deidentify, กฎตรวจรหัส, AdjRW, SQL guard, ฯลฯ)
npm run check-schema
npm run create-user -- <username> <role> "<ชื่อ>"
```

## โครงสร้าง

```
lib/
  hosxp/      pool อ่านอย่างเดียว + queries + schema (รายการตาราง/ฟิลด์ที่ใช้)
  sql-guard.ts  ด่านปฏิเสธ SQL ที่ไม่ใช่การอ่าน (อยู่นอก lib/hosxp โดยตั้งใจ)
  appdb/      ฐานข้อมูลของแอป: การตัดสินใจรหัส, ผล AI (ไม่มีข้อมูลระบุตัวตน), Course, audit log, users
  ai/         provider.ts (interface), gemini.ts, rules.ts, deidentify.ts (+test), index.ts (เลือก provider + fallback)
  coding/     codebook, กฎตรวจรหัส (MB1–MB5, dagger/asterisk, sequelae, external cause), ชุดรหัสสุดท้าย
  drg/        ตาราง TDRG, สูตร AdjRW, ค่าประมาณจากผลจัดกลุ่มย้อนหลัง
  demo/       ข้อมูลสมมติ
  reports/    RW/CMI, ผลงาน AI
data/codebooks/  icd10tm_2009_AL.csv, icd9cm_fy15.csv (ยังไม่มี — ชุด demo อยู่ใน demo/)
data/tdrg/       tdrg_rw_table.csv, tdrg_orp_table.csv (ยังไม่มี — ค่าสมมติอยู่ใน demo/)
```
