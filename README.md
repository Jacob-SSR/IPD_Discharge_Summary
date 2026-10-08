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

## ใช้งานจริงคู่กับ ppc-hos-10667 (เครื่องใน LAN)

**ไม่ต้องตั้งฐานข้อมูลใหม่** — แอปต้องมีที่เขียนข้อมูลของตัวเอง (การยืนยันรหัส, audit log, Course ที่บันทึก)
เพราะห้ามเขียน HOSxP แต่ใช้ฐาน `ppchos` เดิม (`DB_HOST2` ของ ppc-hos) ได้เลย:
ตารางของแอปขึ้นต้นด้วย `ipdsum_` ไม่ชนของเดิม และ login ด้วยบัญชีใน `ppchos.users` ชุดเดียวกับ ppc-hos

1. **HOSxP:** ให้ DBA สร้าง user อ่านอย่างเดียว [`docs/sql/create_readonly_user.sql`](docs/sql/create_readonly_user.sql)
   (อย่าใช้ user ของ ppc-hos เพราะเขียนได้ — หน้า `/system` จะแจ้งเตือนถ้า user มีสิทธิ์เขียน)
2. **ฐานแอป:** รัน [`docs/sql/appdb.sql`](docs/sql/appdb.sql) ในฐาน `ppchos` (หรือให้แอปสร้างเองถ้า user มีสิทธิ์ CREATE)
3. **env:** `cp .env.example .env.production` แล้วกรอก — ค่าหลัก:
   - `HOSXP_DB_HOST` / `HOSXP_DB_NAME` = `DB_HOST` / `DB_NAME` ของ ppc-hos, user = user อ่านอย่างเดียวจากข้อ 1
   - `APP_DB_URL=mysql://<DB_USER>:<DB_PASS>@<DB_HOST2>:3306/ppchos`, `APP_USERS_TABLE=ppchos.users`
   - `APP_ALLOWED_ROLES` (เข้าดูได้) / `APP_DECIDER_ROLES` (ยืนยันรหัสได้) ตาม role ใน `ppchos.users`
   - `JWT_SECRET` ใหม่ (ไม่ใช้ร่วมกับ ppc-hos — cookie ชื่อ `ipdsum_token` แยกกันอยู่แล้ว)
4. **ตรวจโครงสร้าง HOSxP:** `npm run check-schema` (ต้องมี `.env.local` ค่าเดียวกัน) — พิมพ์เฉพาะชื่อตาราง/ฟิลด์
   และบอกว่าคอลัมน์ที่ต่างกันตามเวอร์ชันถูกเลือกเป็นตัวไหน (แพทย์ผู้รับไว้, วันที่/แพทย์ผู้ทำหัตถการ, วันที่สั่งยา, lab ผู้ป่วยใน)
5. **รัน:** `docker compose up -d --build` → `http://<เครื่องนี้>:3600` แล้วเปิด `/system` ตรวจว่าเขียวทุกช่อง
6. **Gemini กับข้อมูลจริง:** เปิด billing แล้วตั้ง `GEMINI_PAID_TIER=true` (ไม่ตั้ง = ใช้ engine แบบกฎอัตโนมัติ)
7. **ก่อนใช้จริง:** ให้ผู้ให้รหัสเทียบกับ HOSxP อย่างน้อย 10 ราย

ถ้าไม่ใช้ ppchos: ตั้ง `APP_DB_URL` เป็นฐานอื่น + `APP_USERS_TABLE=users` แล้วสร้างบัญชีด้วย
`npm run create-user -- <username> DOCTOR "<ชื่อ>"`

## คำสั่ง

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # vitest (deidentify, กฎตรวจรหัส, AdjRW, SQL guard, ฯลฯ)
npm run check-schema
npm run create-user -- <username> <role> "<ชื่อ>"
npm run appdb-sql   # สร้าง docs/sql/appdb.sql ใหม่หลังแก้ lib/appdb/schema.ts
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
