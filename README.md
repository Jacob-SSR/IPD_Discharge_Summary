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

โหมด demo ใช้ข้อมูลสมมติ 22 รายชุดเดียวกับ "สนามลอง AI ให้รหัส" ของโปรแกรมเดิม (`lib/demo/patients.json`),
ผลจัดกลุ่มย้อนหลังและตาราง DRG ค่าสมมติ (`data/tdrg/demo/`) และเก็บฐานข้อมูลแอปเป็นไฟล์ `.data/appdb.json`
codebook จริงจากโปรแกรมเดิม: ICD-10-TM 2009 (14,298 รหัส ชื่อไทยหมวด A–L) + ICD-9-CM FY15 ฉบับ สรท. พร้อม OR/Non-OR
(`data/codebooks/` — อ่านด้วย OCR ยังไม่ได้ตรวจทาน)

ถ้าตั้ง `GEMINI_API_KEY` + `GEMINI_MODEL` ปุ่ม "วิเคราะห์ด้วย AI" จะเรียก Gemini (free tier ใช้ได้เฉพาะโหมด demo)
ถ้าไม่ตั้ง หน้าจอแสดงเฉพาะข้อเสนอจากกฎหลักฐาน (แบบโปรแกรมเดิมเมื่อเรียก AI ไม่ได้)

## หน้าจอ

| หน้า | ทำอะไร |
|---|---|
| `/patients` | หน้าทำงาน 3 คอลัมน์แบบโปรแกรมเดิม: **รายชื่อ** ("รอสรุป · ยังไม่ลง PDx" / "ลงรหัสแล้ว" + จุดผลตรวจกฎ/AI, ช่วงด่วน, ช่วงวัน admit หรือจำหน่าย, แพทย์ 3 แบบ, หอผู้ป่วย, ค้น AN/HN) · **ชาร์ต** (ข้อมูล, ผลตรวจรหัส, CC/HPI/V/S, รหัสใน HOSxP, รหัสที่ยืนยัน, lab ครั้งแรก→ล่าสุด, ยา, สรุปการรักษาบันทึกอัตโนมัติ) / **แบบฟอร์ม Discharge Summary** (A4 พิมพ์/PDF, Excel) · **AI แนะนำรหัส** (DRG/RW ก่อน–หลัง, ยอมรับ/ไม่ยอมรับทีละรหัส กดซ้ำ = ยกเลิก, เพิ่มรหัสเองพร้อมค้น codebook, ร่างสรุป, คัดลอกรหัส, ดูข้อความที่ส่ง AI) |
| `/reports/rw` | RW/AdjRW จริงจาก `an_stat`, CMI รายเดือน/หอ/แพทย์, ประมาณการรายรับ สปสช. |
| `/reports/ai` | ผลงาน AI: อัตรายอมรับ, sensitivity (เทียบรหัสที่แพทย์เพิ่มเอง), AdjRW ที่เพิ่ม (ค่าประมาณ) |
| `/system` | ตรวจการเชื่อมต่อ HOSxP (รวมตรวจว่า user อ่านอย่างเดียวจริง), ฐานแอป, Redis, AI, codebook, ตาราง TDRG |

หน้าทำงานมี animation แบบ React Bits (ตัวเลขนับขึ้น, ข้อความเบลอแล้วชัด, การ์ดแสงตามเมาส์, รายการขึ้นทีละใบ, ประกายตอนกดยอมรับ,
พื้นหลัง aurora หน้าเข้าสู่ระบบ, แผงกระจก + dot grid เรืองแสง, เส้นแสงวิ่งรอบแผง AI และเส้นสแกนชาร์ตขณะ AI อ่าน)
เขียนด้วย CSS ไม่เพิ่ม dependency และปิดเองเมื่อเครื่องตั้ง "ลดการเคลื่อนไหว" — รองรับ dark mode (ตามเครื่อง หรือสลับเองใน command palette)
พิมพ์แบบฟอร์มออกมาเป็นกระดาษขาวเสมอ

คีย์ลัด: **Ctrl/⌘ + K** ค้นหาผู้ป่วย (ชื่อ/AN/HN/PDx) และสั่งงาน (วิเคราะห์ด้วย AI, สลับแท็บ, พิมพ์ A4, Excel, เพิ่มรหัสเอง, สลับธีม)
· **Alt + ↑/↓** ผู้ป่วยก่อนหน้า/ถัดไป — ไม่มีคำสั่ง "ยอมรับรหัส" ทางคีย์ลัดโดยตั้งใจ (แพทย์ต้องกดยืนยันทีละรหัสที่การ์ด)

## ใช้งานจริงคู่กับ ppc-hos-10667 (เครื่องใน LAN)

**ไม่สร้างตารางหรือเขียนข้อมูลบน server HOSxP / ppchos เลย** — ข้อมูลของโปรแกรม (การยืนยันรหัส, ผล AI, สรุปการรักษา, audit log)
เก็บใน MariaDB ของโปรแกรมเองที่ `docker compose` รันให้ (service `appdb`, ตาราง `ipdsum_*` สร้างอัตโนมัติจาก
[`docs/sql/appdb.sql`](docs/sql/appdb.sql) ตอนเริ่มครั้งแรก) โปรแกรมไม่ยอมเริ่มถ้า `APP_DB_URL` ชี้ไปที่ server HOSxP หรือ ppchos

| ต่อกับ | ใช้ทำอะไร | สิทธิ์ |
|---|---|---|
| HOSxP (`HOSXP_DB_*`) | ข้อมูลผู้ป่วยใน | อ่านอย่างเดียว (user SELECT + session read only + SQL guard) |
| `ppchos.users` (`AUTH_DB_*`) | login ด้วยบัญชีเดียวกับ ppc-hos / rca | อ่านอย่างเดียว — ไม่อัปเกรดรหัสผ่านกลับ |
| `appdb` ใน Docker (`APP_DB_URL`) | ข้อมูลของโปรแกรม | อ่าน/เขียน — ที่เดียวที่สร้างตาราง |

1. **HOSxP:** ให้ DBA สร้าง user อ่านอย่างเดียว [`docs/sql/create_readonly_user.sql`](docs/sql/create_readonly_user.sql)
   (อย่าใช้ user ของ ppc-hos เพราะเขียนได้ — หน้า `/system` จะแจ้งเตือนถ้า user มีสิทธิ์เขียน)
2. **env:** `cp .env.example .env.production` แล้วกรอก — ค่าหลัก:
   - `HOSXP_DB_HOST` / `HOSXP_DB_NAME` = `DB_HOST` / `DB_NAME` ของ ppc-hos, user = user อ่านอย่างเดียวจากข้อ 1
   - `AUTH_DB_HOST` / `AUTH_DB_PORT` / `AUTH_DB_USER` / `AUTH_DB_PASS` = `DB_HOST2` / `DB_PORT` / `DB_USER` / `DB_PASS` ของ ppc-hos, `AUTH_DB_NAME=ppchos` (แบบเดียวกับ rca)
   - `MARIADB_ROOT_PASSWORD` / `MARIADB_PASSWORD` สุ่มใหม่ แล้วใส่รหัสเดียวกันใน `APP_DB_URL=mysql://ipdsum:<MARIADB_PASSWORD>@appdb:3306/ipdsum`
   - `APP_ALLOWED_ROLES` (เข้าดูได้, `*` = ทุกบัญชี) / `APP_DECIDER_ROLES` (ยืนยันรหัสได้) ตาม role ใน `ppchos.users`
   - `HOSPITAL_NAME` / `HOSPITAL_CODE` / `HOSPITAL_PROVINCE` (หัวแบบฟอร์ม)
   - `JWT_SECRET` ใหม่ (ไม่ใช้ร่วมกับ ppc-hos — cookie ชื่อ `ipdsum_token` แยกกันอยู่แล้ว)
3. **ตรวจโครงสร้าง HOSxP:** `npm run check-schema` (ต้องมี `.env.local` ค่าเดียวกัน) — พิมพ์เฉพาะชื่อตาราง/ฟิลด์
   และบอกว่าคอลัมน์ที่ต่างกันตามเวอร์ชันถูกเลือกเป็นตัวไหน (DRG/RW/AdjRW, แพทย์ผู้รับไว้, วันที่/แพทย์ผู้ทำหัตถการ, วันที่สั่งยา ฯลฯ)
4. **รัน:** `docker compose up -d --build` (app + appdb + redis) → `http://<เครื่องนี้>:3600` แล้วเปิด `/system` ตรวจว่าเขียวทุกช่อง
   — ข้อมูลของโปรแกรมอยู่ใน volume `appdb-data` (สำรองด้วย `docker exec ipd-discharge-appdb mariadb-dump ...`)
5. **Gemini กับข้อมูลจริง:** เปิด billing แล้วตั้ง `GEMINI_PAID_TIER=true` (ไม่ตั้ง = แสดงเฉพาะผลจากกฎหลักฐาน)
6. **ก่อนใช้จริง:** ให้ผู้ให้รหัสเทียบกับ HOSxP อย่างน้อย 10 ราย

### รันโปรแกรมนอก Docker (npm run dev / npm start) แต่ใช้ฐานข้อมูลของโปรแกรมใน Docker

```bash
# 1) ใส่ใน .env.local
MARIADB_ROOT_PASSWORD=<สุ่ม>      # openssl rand -hex 16
MARIADB_DATABASE=ipdsum
MARIADB_USER=ipdsum
MARIADB_PASSWORD=<สุ่ม>
APP_DB_URL=mysql://ipdsum:<MARIADB_PASSWORD>@127.0.0.1:3307/ipdsum
REDIS_URL=redis://127.0.0.1:6379

# 2) สร้างฐาน (MariaDB 10.11 ใช้แทน MySQL ได้) + Redis — ตาราง ipdsum_* สร้างให้อัตโนมัติ
docker compose -f docker-compose.db.yml up -d --wait

# 3) รันโปรแกรม แล้วเปิด /system ดูว่า "ฐานข้อมูลแอป" เป็นสีเขียว
npm run dev
```

port 3307 / 6379 เปิดเฉพาะเครื่องนี้ (127.0.0.1) · ข้อมูลอยู่ใน volume `ipd-discharge-db_appdb-data` (ลบ container แล้วข้อมูลยังอยู่)

### เคยรันเวอร์ชันเก่าที่สร้างตารางใน ppchos

เวอร์ชันก่อนหน้าสร้างตาราง `ipdsum_*` ในฐานที่ `APP_DB_URL` ชี้ (ถ้าชี้ไปที่ `ppchos` = อยู่ในฐาน HOSxP)
ตอนนี้โปรแกรมไม่ยอมสร้างตารางบน server ที่มีฐาน HOSxP แล้ว ให้ DBA ตรวจและลบตารางเก่า:

```sql
SHOW TABLES FROM ppchos LIKE 'ipdsum\_%';
-- ถ้าต้องการเก็บประวัติการยืนยันรหัสไว้ ให้ mysqldump 4 ตารางนี้ก่อน แล้วค่อยลบ
DROP TABLE ppchos.ipdsum_code_decisions, ppchos.ipdsum_ai_runs, ppchos.ipdsum_course_texts, ppchos.ipdsum_audit_log;
```

ถ้าไม่ใช้บัญชี ppc-hos: ไม่ต้องตั้ง `AUTH_DB_*` แล้วสร้างบัญชีในตาราง `users` ของ appdb ด้วย
`npm run create-user -- <username> DOCTOR "<ชื่อ>"` (appdb ไม่เปิด port ออกนอกเครื่อง — เปิด `ports: ["127.0.0.1:3307:3306"]` ชั่วคราว
แล้วตั้ง `APP_DB_URL=mysql://ipdsum:<รหัส>@127.0.0.1:3307/ipdsum` ใน `.env.local`)

## คำสั่ง

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # vitest (deidentify, กฎตรวจรหัส, AdjRW, SQL guard, ฯลฯ)
npm run check-schema
npm run create-user -- <username> <role> "<ชื่อ>"
npm run appdb-sql   # สร้าง docs/sql/appdb.sql ใหม่หลังแก้ lib/appdb/schema.ts (Docker ใช้ไฟล์นี้สร้างตาราง)
```

## โครงสร้าง

```
app/(app)/patients/   หน้าทำงาน 3 คอลัมน์ (Workspace, PatientList, CenterPane, AiPanel)
components/motion/    animation (CountUp, BlurText, ShinyText, spotlight, spark)
lib/
  hosxp/      pool อ่านอย่างเดียว + queries + schema (รายการตาราง/ฟิลด์ที่ใช้) + columns (เลือกคอลัมน์ตามเวอร์ชัน)
  sql-guard.ts  ด่านปฏิเสธ SQL ที่ไม่ใช่การอ่าน (อยู่นอก lib/hosxp โดยตั้งใจ)
  appdb/      ฐานข้อมูลของแอป: การตัดสินใจรหัส, ผล AI (ไม่มีข้อมูลระบุตัวตน), Course, audit log
  ai/         prompt.ts (prompt โปรแกรมเดิม), gemini.ts, merge.ts (merge_and_validate), deidentify.ts (+test), index.ts
  coding/     codebook, legacyRules.ts (กฎหลักฐาน + ผลตรวจรหัสของโปรแกรมเดิม), กฎ ICD-10 Vol.2, ชุดรหัสในแบบฟอร์ม
  drg/        ตาราง TDRG, สูตร AdjRW (rw_estimator.py), ประมาณ DRG 4 ระดับจากผลจัดกลุ่มย้อนหลัง
  demo/       ข้อมูลสมมติ 22 ราย
  reports/    RW/CMI, ผลงาน AI
data/codebooks/  icd10tm_2009_AL.csv, icd9cm_fy15.csv (จากโปรแกรมเดิม อ่านด้วย OCR ยังไม่ได้ตรวจทาน)
data/tdrg/       tdrg_rw_table.csv (ยังไม่มี — ต้องเติมจากคู่มือ TDRG 6.3 · ค่าสมมติอยู่ใน demo/), refs.json
```
