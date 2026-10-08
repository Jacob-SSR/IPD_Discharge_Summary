@AGENTS.md

# CLAUDE.md — IPD Discharge Summary + AI แนะนำรหัส (รพ.พลับพลาชัย)

## เป้าหมาย

ย้ายโปรแกรมสรุปเวชระเบียนผู้ป่วยใน + AI แนะนำรหัส จาก Python/Flask (`IPD_Discharge_Summary.zip`) ไปเป็น Next.js (App Router) + TypeScript

- AI ช่วงนี้ใช้ Gemini API (API key) ส่วน Ollama ยังไม่ทำ แต่ต้องออกแบบให้สลับไปใช้ได้ภายหลังโดยไม่ต้องแก้หน้าเว็บ
- โค้ด Flask เดิมใช้เป็นต้นแบบด้าน logic ได้แก่ SQL, กฎตรวจรหัส, สูตร AdjRW และรูปแบบแบบฟอร์ม A4 ไม่ต้องคง Flask ไว้

สถานะของเดิม: ทดสอบกับข้อมูลสมมติและฐานจำลองโครงสร้าง HOSxP แล้ว ยังไม่เคยต่อ HOSxP จริง

## กฎที่ห้ามละเมิด

1. ห้ามเขียนลง HOSxP ทุกกรณี connection ที่ต่อ HOSxP ใช้ user แบบอ่านอย่างเดียว ห้ามมี INSERT/UPDATE/DELETE/DDL ใน `lib/hosxp/**`
2. ข้อมูลที่ส่งไป Gemini ต้องผ่าน `lib/ai/deidentify.ts` เสมอ — ตัดชื่อ, HN, AN, เลขบัตรประชาชน, วันที่ (แปลงเป็นวันที่นับจาก admit), ที่อยู่, เบอร์โทร, ชื่อแพทย์/พยาบาล; อายุ ≥ 90 ใช้ "90+"
   - ต้องมี unit test ที่ใส่ข้อมูลสมมติซึ่งมีตัวระบุตัวตนทุกแบบ แล้วยืนยันว่า payload ที่จะส่งไม่มีหลงเหลือ
   - free text (ข้อความที่แพทย์/พยาบาลพิมพ์เอง) ห้ามส่งไป Gemini จนกว่าจะมี de-identification สำหรับข้อความอิสระที่ผ่านการตรวจ เพราะอาจมีชื่อหรือเลขประจำตัวปนอยู่ ช่วงนี้ส่งเฉพาะข้อมูลที่มีโครงสร้าง (รหัสเดิม, lab, ยา, หัตถการ, LOS, อายุ, เพศ)
   - เรียก Gemini จากฝั่ง server เท่านั้น (route handler / server action) ห้ามส่ง API key ไปฝั่ง browser
3. ต้องใช้ Gemini แบบเสียเงิน (เปิด billing) ห้ามใช้ free tier กับข้อมูลผู้ป่วย — ถ้า env ไม่ได้ตั้ง `GEMINI_PAID_TIER=true` ให้ระบบใช้ได้เฉพาะโหมด demo (ข้อมูลสมมติ)
4. ห้ามใส่ข้อมูลผู้ป่วยจริงในโค้ด, fixture, log หรือ commit ใช้ข้อมูลสมมติเท่านั้น ห้าม log payload ที่ยังไม่ได้ตัดข้อมูล
5. ห้าม commit `.env*` (ให้มี `.env.example`)
6. รหัสที่ AI แนะนำเป็นแค่ร่าง แพทย์ต้องกดยืนยันทีละรหัส ห้ามทำ UI ที่ยอมรับอัตโนมัติ และทุกหน้าที่แสดงคำแนะนำ AI ต้องมีข้อความว่าเป็นข้อเสนอแนะ ไม่ใช่การวินิจฉัย
7. ก่อนแก้โค้ด ให้อ่านโค้ดจริงก่อนเสมอ อย่าเดาโครงสร้าง ถ้ามีเรื่องต้องตัดสินใจทางคลินิกหรือการเงิน (กฎให้รหัส, ค่า RW) ให้หยุดถาม

## Stack และ convention (ให้ตรงกับระบบ ppc-hos-10667 ที่มีอยู่)

- Next.js App Router + TypeScript (strict)
- รูปแบบสามไฟล์: `types.ts` / `queries.ts` / `route.ts` + `page.tsx`
- HOSxP: `mysql2/promise` pool แยกสำหรับ HOSxP (อ่านอย่างเดียว) ตั้งค่า charset ได้ (`tis620` / แก้ latin1) ผ่าน env
- cache: `cachedQuery([keyParts], fn, ttl)` + `invalidate(prefix)` จาก `@/lib/cache` (Redis)
- ธีมเขียว/มินต์, ฟอนต์ Prompt/Sarabun, ใช้ component กลางแบบ KpiCard, SectionCard, ReportTable ถ้ามี
- วันที่: แสดงเป็น พ.ศ. (ปี + 543), ปีงบประมาณเริ่ม 1 ต.ค.
- env ใช้ `process.env.X!` ไม่มีค่า fallback ที่ hardcode
- deploy: Docker แบบ multi-stage + Docker Compose บน server ใน LAN
- commit message ภาษาไทยแบบ conventional

ผู้ใช้ตัดสินใจแล้ว: เป็นโปรเจกต์แยกของตัวเอง ไม่รวมเข้า ppc-hos-10667 (ใช้ ppc-hos-10667 / drg_grouper เป็นต้นแบบด้าน convention เช่น ล็อกอิน, cache, component)

## โครงสร้างที่เสนอ

```
lib/
  hosxp/            pool อ่านอย่างเดียว + queries (port จาก queries.py)
  appdb/            ฐานข้อมูลของแอปเอง (แยกจาก HOSxP) — การตัดสินใจยอมรับ/ไม่ยอมรับรหัส, รหัสที่แพทย์เพิ่ม, audit log
  ai/
    provider.ts     interface AiProvider { suggestCodes(input): Promise<Suggestion[]>; draftCourse(input): Promise<string> }
    gemini.ts       ใช้ @google/genai, structured output (responseSchema / JSON) + validate ด้วย zod
    rules.ts        engine แบบกฎ (fallback เมื่อ AI ไม่ตอบหรือไม่ได้ตั้งค่า)
    deidentify.ts   + deidentify.test.ts
    index.ts        เลือก provider จาก env AI_PROVIDER = gemini | rules  (ollama ไว้ทีหลัง)
  coding/           กฎตรวจรหัส ICD-10 Vol.2 หมวด 4.5 (MB1–MB5, dagger/asterisk, sequelae, external cause)
  drg/              AdjRW TDRG 6.3 + อ่าน tdrg_rw_table.csv / tdrg_orp_table.csv
data/codebooks/     icd9cm_fy15.csv, icd10tm_2009_AL.csv (จาก OCR ยังไม่ได้ตรวจ)
```

## env (`.env.example`)

```
APP_MODE=demo                # demo | hosxp
HOSXP_DB_HOST=
HOSXP_DB_USER=               # user อ่านอย่างเดียว (create_readonly_user.sql), แนะนำต่อ Slave/Replica
HOSXP_DB_PASSWORD=
HOSXP_DB_NAME=
HOSXP_DB_CHARSET=            # tis620 หรือ latin1 แล้วแปลง
APP_DB_URL=                  # ฐานข้อมูลของแอปเอง
REDIS_URL=
AI_PROVIDER=gemini           # gemini | rules
GEMINI_API_KEY=
GEMINI_MODEL=                # ให้ผู้ใช้กำหนด ห้าม hardcode ชื่อรุ่นในโค้ด
GEMINI_PAID_TIER=false       # ต้องเป็น true ถึงจะส่งข้อมูลจากโหมด hosxp ได้
AI_TIMEOUT_MS=30000
NHSO_RATE_PER_ADJRW=8350     # อัตรา สปสช. 2569
```

## งาน (เรียงตามลำดับ ทำทีละข้อ)

### 0. อ่านของเดิม

- แตก zip ไว้ใน `legacy/` (ไม่ต้อง build) อ่าน app, queries.py, กฎตรวจรหัส, สูตร DRG, template แบบฟอร์ม
- สรุปให้ผู้ใช้ว่ามีหน้า/ฟีเจอร์อะไรบ้าง และ logic ส่วนไหนต้อง port แบบตรงตัว รอผู้ใช้ยืนยันก่อนเริ่มข้อ 1

### 1. โครงโปรเจกต์ + โหมด demo

- สร้าง Next.js + ข้อมูลสมมติ 20+ ราย (port จากของเดิม) ให้รันได้โดยไม่ต้องต่อ HOSxP
- หน้า: รายชื่อผู้ป่วยใน (ตัวกรองช่วงวัน admit / ช่วงวันจำหน่าย แยกกัน, ช่วงด่วน, แพทย์ผู้จำหน่าย / ผู้รับไว้ / ผู้วินิจฉัยหลัก, หอผู้ป่วย), แท็บ "รอสรุป" (ยังไม่มี PDx ใน iptdiag + ยังนอนอยู่)
- ระบบล็อกอิน (ใช้แบบเดียวกับ ppc-hos ถ้ามี)

### 2. แบบฟอร์ม Discharge Summary

- หน้า A4 พร้อม print CSS (พิมพ์/บันทึก PDF จาก browser), Export Excel (exceljs)
- ปุ่มคัดลอกรหัสเพื่อไปลงใน HOSxP เอง

### 3. AI ผ่าน Gemini

- `AiProvider` + `gemini.ts` + `rules.ts` + `deidentify.ts` (ตามกฎข้อ 2–3)
- บังคับผลเป็น JSON ตาม schema แล้ว validate ด้วย zod ถ้าไม่ผ่านให้ retry ไม่เกิน 1 ครั้งแล้ว fallback เป็น rules
- ตรวจรหัสที่ AI เสนอกับ codebook ทุกครั้ง รหัสที่ไม่มีใน codebook ให้แสดงเตือน ห้ามซ่อน
- ผ่านกฎหลักฐาน (ทุกรหัสต้องอ้างข้อมูลในเวชระเบียนที่รองรับ) และกฎ MB1–MB5
- UI: ยอมรับ/ไม่ยอมรับทีละรหัส, เพิ่มรหัส ICD-10 / ICD-9-CM เอง (OR/Non-OR + วันที่, Enter หรือปุ่มเพิ่ม), ร่าง Course in hospital
- บันทึกการตัดสินใจลง appdb (ใคร/เมื่อไร/รหัส/ยอมรับหรือไม่) ห้ามเก็บ payload ที่ส่ง AI ถ้ายังมีข้อมูลระบุตัวตน
- แสดงชื่อ provider และรุ่นที่ใช้ในหน้าจอ

### 4. DRG/RW + รายงาน

- RW จริงจาก `an_stat`; ค่าประมาณจากผลจัดกลุ่มย้อนหลัง + สูตร AdjRW TDRG 6.3 (port จากของเดิม พร้อม unit test โดยใช้เคสจากของเดิมเป็นค่าที่คาดหวัง)
- รายงาน RW/CMI, หน้า "ผลงาน AI" (อัตรายอมรับ, รหัสที่แพทย์เพิ่มเอง = sensitivity, RW ที่เพิ่ม)
- ตาราง TDRG: เติมจากคู่มือที่ผู้ใช้ให้มาเท่านั้น ห้ามเดาค่า RW

### 5. ต่อ HOSxP จริง (ต้องรันบนเครื่องใน LAN)

- สคริปต์ `scripts/check-schema.ts` อ่าน `INFORMATION_SCHEMA` แล้วรายงานตาราง/ฟิลด์ที่ queries ใช้แต่ไม่มีจริง (พิมพ์แค่ชื่อตาราง/ฟิลด์ ไม่พิมพ์ข้อมูลผู้ป่วย)
- ปรับ queries ให้ตรงกับ HOSxP ของโรงพยาบาล โดยเฉพาะฟิลด์แพทย์ผู้จำหน่าย (`ipt.dch_doctor`)
- หน้า "ตรวจการเชื่อมต่อ"
- เสร็จเมื่อ: ผู้ให้รหัสเทียบกับ HOSxP แล้วถูกต้องอย่างน้อย 10 ราย

### 6. Docker

- Dockerfile แบบ multi-stage + docker-compose (app + redis) ตามแบบ ppc-hos

### ภายหลัง (ยังไม่ต้องทำจนกว่าผู้ใช้สั่ง)

- `ollama.ts` provider / API กลาง AI ของโรงพยาบาล
- ตรวจทาน codebook จาก OCR (สคริปต์หาความผิดปกติแล้วส่งออก CSV ให้คนตรวจ; ยังไม่มี ICD-10-TM เล่ม M–Z)
- Export สำหรับงานวิจัย (AN → รหัสลำดับ, ต้องผ่าน EC)
- HOSxP IPD Paperless: free text เข้า context AI, ปุ่ม "บันทึกลง HOSxP" + audit log ผ่านช่องทางที่ BMS รองรับ

## วิธีทำงาน

- ทำทีละข้อ จบแต่ละข้อให้รัน `tsc --noEmit`, lint และ test ให้ผ่าน แล้วสรุปสิ่งที่เปลี่ยนสั้นๆ พร้อมเสนอ commit message ภาษาไทยแบบ conventional (ผู้ใช้ commit เอง)
- ทุกฟีเจอร์ต้องทำงานได้ในโหมด `demo` ก่อน

## สถานะปัจจุบัน (อัปเดตล่าสุด 8 ต.ค. 2569)

ทำครบทุกข้อ 1–6 แล้ว และ port หน้าจอ/logic ตาม **"สนามลอง AI ให้รหัส"** (artifact ของโปรแกรมเดิมที่ผู้ใช้ให้มา
แทนไฟล์ `IPD_Discharge_Summary.zip` ซึ่งยังไม่ได้รับ): หน้าทำงาน 3 คอลัมน์, prompt + รูปแบบ JSON เดิม, merge_and_validate,
กฎหลักฐาน/ผลตรวจรหัส (ผลตรงกับของเดิมทั้ง 22 ราย — `tests/legacy-rules.test.ts`), ประมาณ DRG 4 ระดับ + สูตร AdjRW ของ rw_estimator.py,
codebook ICD-10-TM/ICD-9-CM (OR/Non-OR) และข้อมูลสมมติ 22 ราย

ข้อที่ต่างจากของเดิมโดยตั้งใจ (กฎข้อ 2): ของเดิมส่ง CC/HPI/PMH/วินิจฉัยแรกรับ/Course ที่แพทย์พิมพ์ให้ AI —
ที่นี่**ไม่ส่ง free text** (แสดงในหน้าจออย่างเดียว) จนกว่าจะมี de-identification ข้อความอิสระที่ผ่านการตรวจ

ยังต้องตรวจ/ยืนยัน:
- เกณฑ์ lab ของกฎหลักฐาน (`lib/coding/legacyRules.ts`, `CLINICAL_REVIEWED = false`) อนุมานจากผลของโปรแกรมเดิม — ให้แพทย์/ผู้ให้รหัสตรวจ
- ตาราง TDRG 6.3 จริง (`data/tdrg/tdrg_rw_table.csv`) ยังไม่มี — ค่าใน `data/tdrg/demo/` เป็นค่าสมมติ ห้ามเดาค่า RW
- codebook จาก OCR ยังไม่ได้ตรวจทาน
- SQL (`lib/hosxp/queries.ts`) ปรับตาม ppc-hos-10667 / rca แล้ว (ipt.dch_doctor, ipt.vn → opdscreen/ovstdiag, an_stat.aid/pttype, DRG/RW/AdjRW จาก ipt ก่อนแล้วค่อย an_stat,
  รหัสไม่มีจุด/มี extension) คอลัมน์ที่ต่างตามเวอร์ชันเลือกอัตโนมัติ (`lib/hosxp/columns.ts`) ทดสอบกับฐานจำลอง 3 รุ่น ยังไม่เคยต่อ HOSxP จริง

ฐานข้อมูลแอป: MariaDB ของโปรแกรมใน Docker (service `appdb` ใน docker-compose, ตาราง `ipdsum_*` จาก `docs/sql/appdb.sql`)
**ผู้ใช้สั่ง: ห้ามสร้างตารางบน server HOSxP** — `lib/appdb/guard.ts` ไม่ยอมให้ `APP_DB_URL` ชี้ไป server HOSxP / ppchos
login ด้วย `ppchos.users` แบบอ่านอย่างเดียว (`AUTH_DB_*` แบบ rca — ไม่อัปเกรดรหัสผ่านกลับ, `lib/auth/users.ts`)
สิทธิ์ตาม role: `APP_ALLOWED_ROLES` (เข้าดู, `*` = ทุกบัญชี) / `APP_DECIDER_ROLES` (ยืนยันรหัส)
