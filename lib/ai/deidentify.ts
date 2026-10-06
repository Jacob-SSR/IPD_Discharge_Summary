// lib/ai/deidentify.ts
// สร้าง payload สำหรับ AI แบบ "whitelist" — หยิบเฉพาะฟิลด์ที่อนุญาต ไม่ใช่ลบฟิลด์ที่ห้าม
//   ตัดทิ้ง: ชื่อ, HN, AN, เลขบัตรประชาชน, ที่อยู่, เบอร์โทร, ชื่อแพทย์/พยาบาล, วันเกิด
//   วันที่  : แปลงเป็นจำนวนวันนับจาก admit (day 0 = วัน admit)
//   อายุ    : ≥ 90 ใช้ "90+"
//   free text: ไม่ส่งเลย (ผล lab ที่เป็นข้อความ, ชื่อที่มีภาษาไทย ถูกตัดทิ้ง)
// แล้วตรวจซ้ำด้วย assertNoIdentifiers() — ถ้าพบอะไรหลุด จะ throw และไม่เรียก AI

import { daysBetween } from "@/lib/date";
import type { AdmissionDetail } from "@/lib/patients/types";
import type { DeidentifiedCase } from "./types";

export class DeidentificationError extends Error {
  constructor(public reasons: string[]) {
    super(`พบข้อมูลที่อาจระบุตัวตนใน payload (${reasons.length} จุด)`);
    this.name = "DeidentificationError";
  }
}

const THAI = /[฀-๿]/;
const TITLES = new Set(["dr", "md", "mr", "mrs", "ms", "miss", "นพ", "พญ", "นาย", "นาง", "นางสาว", "ด", "ช", "ญ"]);
/** ผล lab ที่ส่งได้: ตัวเลข หรือช่วงตัวเลข เช่น "2.9", "<0.5", "50-100" (สั้นเท่านั้น) */
const NUMERIC_RESULT = /^[<>]?\d{1,5}(\.\d{1,3})?(-\d{1,5}(\.\d{1,3})?)?$/;
/** ชื่อ lab/ยา/หน่วย: อักษรอังกฤษ ตัวเลข และเครื่องหมายทั่วไป ไม่มีภาษาไทย ยาวไม่เกิน 80 */
const SAFE_LABEL = /^[A-Za-z0-9 .,%()/+\-:^[\]<>=]{1,80}$/;

function safeLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return SAFE_LABEL.test(t) && !/\d{6,}/.test(t) ? t : null;
}

function dayOf(admitDate: string, d: string | null): number | null {
  if (!d) return null;
  try {
    return daysBetween(admitDate, d);
  } catch {
    return null;
  }
}

export function ageBand(age: number | null): string {
  if (age == null || !Number.isFinite(age) || age < 0) return "unknown";
  return age >= 90 ? "90+" : String(Math.floor(age));
}

export function deidentify(a: AdmissionDetail): DeidentifiedCase {
  const labs: DeidentifiedCase["labs"] = [];
  a.labs.forEach((l, i) => {
    const test = safeLabel(l.name);
    const value = l.value?.trim() ?? "";
    if (!test || !NUMERIC_RESULT.test(value)) return; // ข้อความอิสระ/ชื่อภาษาไทย → ไม่ส่ง
    labs.push({
      id: `L${i + 1}`,
      test,
      value,
      unit: safeLabel(l.unit),
      ref: safeLabel(l.normal),
      day: dayOf(a.admitDate, l.date),
    });
  });

  const drugs: DeidentifiedCase["drugs"] = [];
  a.drugs.forEach((d, i) => {
    const name = safeLabel([d.name, d.strength].filter(Boolean).join(" "));
    if (!name) return;
    drugs.push({ id: `M${i + 1}`, name, day: dayOf(a.admitDate, d.date) });
  });

  return {
    age: ageBand(a.ageYears),
    sex: a.sex,
    losDays: a.los,
    stillAdmitted: a.dischargeDate == null,
    existingDiagnoses: a.diagnoses
      .filter((d) => /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/.test(d.icd10))
      .map((d, i) => ({ id: `D${i + 1}`, code: d.icd10, type: d.diagtype })),
    procedures: a.procedures
      .filter((p) => /^[0-9]{2}(\.[0-9]{1,2})?$/.test(p.icd9))
      .map((p, i) => ({ id: `P${i + 1}`, code: p.icd9, day: dayOf(a.admitDate, p.opDate) })),
    labs,
    drugs,
  };
}

/** รวบรวมค่าที่ระบุตัวตนได้จากเวชระเบียนต้นฉบับ เพื่อตรวจว่าไม่หลุดไปใน payload */
function identifierStrings(a: AdmissionDetail): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined, min = 3) => {
    const t = s?.trim();
    if (t && t.length >= min) out.add(t);
  };
  add(a.hn);
  add(a.an);
  add(a.cid);
  add(a.cid?.replace(/\D/g, ""));
  add(a.phone);
  add(a.phone?.replace(/\D/g, ""));
  add(a.address, 4);
  add(a.birthday);
  add(a.admitDate);
  add(a.dischargeDate);
  // ชื่อคน: ตรวจทั้งชื่อเต็มและแต่ละคำ (ยกเว้นคำนำหน้า)
  const addPerson = (name: string | null | undefined) => {
    if (!name) return;
    add(name);
    for (const part of name.split(/[\s.]+/)) {
      if (!TITLES.has(part.toLowerCase())) add(part, 3);
    }
  };
  addPerson(a.patientName);
  for (const d of [a.admitDoctor, a.dischargeDoctor, a.pdxDoctor]) addPerson(d?.name);
  for (const d of a.diagnoses) addPerson(d.doctorName);
  for (const p of a.procedures) addPerson(p.doctorName);
  for (const x of [...a.labs.map((l) => l.date), ...a.drugs.map((d) => d.date), ...a.procedures.map((p) => p.opDate)]) add(x);
  return [...out];
}

/** ตรวจ payload ที่จะส่ง AI — throw DeidentificationError ถ้าพบสิ่งที่อาจระบุตัวตน */
export function assertNoIdentifiers(payloadJson: string, source: AdmissionDetail): void {
  const reasons: string[] = [];
  if (THAI.test(payloadJson)) reasons.push("มีอักษรภาษาไทย (อาจเป็นชื่อ/ที่อยู่/ข้อความอิสระ)");
  if (/\d{7,}/.test(payloadJson)) reasons.push("มีตัวเลขยาว ≥ 7 หลัก (อาจเป็น HN/AN/เลขบัตร/เบอร์โทร)");
  if (/\d{4}-\d{2}-\d{2}/.test(payloadJson)) reasons.push("มีวันที่รูปแบบ YYYY-MM-DD");
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(payloadJson)) reasons.push("มีวันที่รูปแบบ DD/MM/YYYY");
  if (/\b0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}\b/.test(payloadJson)) reasons.push("มีรูปแบบเบอร์โทร");
  for (const s of identifierStrings(source)) {
    if (payloadJson.includes(s)) reasons.push("พบค่าที่ตรงกับข้อมูลระบุตัวตนของผู้ป่วย/บุคลากร");
  }
  if (reasons.length) throw new DeidentificationError([...new Set(reasons)]);
}

/** ใช้ก่อนเรียก AI ทุกครั้ง: สร้าง payload + ตรวจซ้ำ */
export function buildAiPayload(a: AdmissionDetail): DeidentifiedCase {
  const payload = deidentify(a);
  assertNoIdentifiers(JSON.stringify(payload), a);
  return payload;
}
