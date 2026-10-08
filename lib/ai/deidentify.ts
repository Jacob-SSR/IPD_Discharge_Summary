// lib/ai/deidentify.ts
// สร้างข้อมูลสำหรับ AI แบบ "whitelist" — หยิบเฉพาะฟิลด์ที่อนุญาต ไม่ใช่ลบฟิลด์ที่ห้าม
//   ตัดทิ้ง: ชื่อ, HN, AN, เลขบัตรประชาชน, ที่อยู่, เบอร์โทร, ชื่อแพทย์/พยาบาล, วันเกิด, หอผู้ป่วย
//   วันที่  : แปลงเป็นวันที่ของการนอน (D1 = วัน admit) แบบโปรแกรมเดิม
//   อายุ    : ≥ 90 ใช้ "90+"
//   free text: ไม่ส่ง — CC/HPI/PMH/การวินิจฉัยแรกรับที่พิมพ์/Course ที่แพทย์เขียน/ผล lab ที่เป็นข้อความ
// แล้วตรวจข้อความที่จะส่งซ้ำด้วย assertNoIdentifiers() — พบอะไรหลุด จะ throw และไม่เรียก AI

import { ruleHints, type RuleHint } from "@/lib/coding/legacyRules";
import { getCodebook } from "@/lib/coding/codebook";
import { daysBetween } from "@/lib/date";
import { labFlag } from "@/lib/patients/summary";
import type { AdmissionDetail } from "@/lib/patients/types";
import type { DeidentifiedCase } from "./types";

export { labFlag };

export class DeidentificationError extends Error {
  constructor(public reasons: string[]) {
    super(`พบข้อมูลที่อาจระบุตัวตนในข้อความที่จะส่ง AI (${reasons.length} จุด)`);
    this.name = "DeidentificationError";
  }
}

const TITLES = new Set(["dr", "md", "mr", "mrs", "ms", "miss", "นพ", "พญ", "นาย", "นาง", "นางสาว", "ด", "ช", "ญ", "เด็กชาย", "เด็กหญิง"]);
/** ผล lab ที่ส่งได้: ตัวเลข หรือช่วงตัวเลขสั้นๆ */
const NUMERIC_RESULT = /^[<>]?\d{1,5}(\.\d{1,3})?(-\d{1,5}(\.\d{1,3})?)?$/;
/** ชื่อ lab/ยา/หน่วย: ข้อความสั้นจากตาราง master (ไม่ใช่ข้อความที่คนพิมพ์) ไม่มีตัวเลขยาว */
function baseLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || t.length > 80 || /\d{6,}/.test(t) || /[\n\r]/.test(t)) return null;
  return t;
}
/** หลักฐานจากกฎที่มาจาก free text → ไม่ส่ง */
const FREE_TEXT_EVIDENCE = /^(CC|HPI|PMH|วินิจฉัยแรกรับ)\s*:/;

function dayOf(admitDate: string, d: string | null | undefined): number | null {
  if (!d) return null;
  try {
    return daysBetween(admitDate, d) + 1;
  } catch {
    return null;
  }
}

export function ageBand(age: number | null): string {
  if (age == null || !Number.isFinite(age) || age < 0) return "unknown";
  return age >= 90 ? "90+" : String(Math.floor(age));
}


export function deidentify(a: AdmissionDetail, hints: RuleHint[] = ruleHints(a)): DeidentifiedCase {
  const icd10 = getCodebook("ICD10");
  const s = a.screen;
  const n = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : x);
  // ชื่อ lab/ยาที่มีชื่อคน/HN/ที่อยู่ปน (เช่นตั้งชื่อรายการตามผู้ป่วย) → ตัดเฉพาะรายการนั้น ไม่ให้ทั้งรายถูกบล็อก
  const forbidden = forbiddenStrings(a, []);
  const safeLabel = (x: string | null | undefined) => {
    const t = baseLabel(x);
    return t && !forbidden.some((f) => t.includes(f)) ? t : null;
  };

  const labs: DeidentifiedCase["labs"] = [];
  for (const l of [...a.labs].sort((x, y) => (x.date ?? "").localeCompare(y.date ?? ""))) {
    const test = safeLabel(l.name);
    const value = l.value?.trim() ?? "";
    if (!test || !NUMERIC_RESULT.test(value)) continue; // ผล lab ที่เป็นข้อความอิสระ → ไม่ส่ง
    labs.push({ day: dayOf(a.admitDate, l.date), test, value, unit: safeLabel(l.unit), ref: safeLabel(l.normal), flag: labFlag(value, l.normal) });
  }

  // ยา: รวมรายการเดียวกันเป็นบรรทัดเดียว (จำนวนรวม + วันแรก–วันสุดท้าย) แบบโปรแกรมเดิม
  const drugMap = new Map<string, DeidentifiedCase["drugs"][number]>();
  for (const d of a.drugs) {
    const name = safeLabel([d.name, d.strength].filter(Boolean).join(" "));
    if (!name) continue;
    const first = dayOf(a.admitDate, d.date);
    const last = dayOf(a.admitDate, d.lastDate ?? d.date);
    const cur = drugMap.get(name);
    if (!cur) drugMap.set(name, { name, qty: d.qty, firstDay: first, lastDay: last });
    else {
      cur.qty = (cur.qty ?? 0) + (d.qty ?? 0);
      if (first != null && (cur.firstDay == null || first < cur.firstDay)) cur.firstDay = first;
      if (last != null && (cur.lastDay == null || last > cur.lastDay)) cur.lastDay = last;
    }
  }

  return {
    age: ageBand(a.ageYears),
    sex: a.sex,
    losDays: a.los,
    stillAdmitted: a.dischargeDate == null,
    dischargeStatus: safeLabel(a.dischargeStatus?.name),
    dischargeType: safeLabel(a.dischargeType?.name),
    vitals: s ? { bps: n(s.bps), bpd: n(s.bpd), pulse: n(s.pulse), rr: n(s.rr), temperature: n(s.temperature), bw: n(s.bw) } : null,
    admitDx: a.admitDx
      .filter((c) => /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/.test(c))
      .map((code) => ({ code, name: icd10.get(code)?.description ?? null })),
    diagnoses: a.diagnoses
      .filter((d) => /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$/.test(d.icd10))
      .map((d) => ({ code: d.icd10, type: d.diagtype, name: d.name ?? icd10.get(d.icd10)?.description ?? null })),
    procedures: a.procedures
      .filter((p) => /^[0-9]{2}(\.[0-9]{1,2})?$/.test(p.icd9))
      .map((p) => ({ code: p.icd9, name: safeLabel(p.name), day: dayOf(a.admitDate, p.opDate) })),
    labs,
    drugs: [...drugMap.values()],
    hints: hints.map((h) => ({ code: h.code, reason: h.reason, evidence: h.evidence.filter((e) => !FREE_TEXT_EVIDENCE.test(e)) })),
  };
}

/** ค่าที่ระบุตัวตนได้/ข้อความอิสระจากเวชระเบียนต้นฉบับ — ต้องไม่พบในข้อความที่ส่ง AI */
function forbiddenStrings(a: AdmissionDetail, extraFreeText: string[]): string[] {
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
  add(a.wardName, 4);
  const addPerson = (name: string | null | undefined) => {
    if (!name) return;
    add(name);
    for (const part of name.split(/[\s.]+/)) if (!TITLES.has(part.toLowerCase())) add(part, 3);
  };
  addPerson(a.patientName);
  for (const d of [a.admitDoctor, a.dischargeDoctor, a.pdxDoctor]) addPerson(d?.name);
  for (const d of a.diagnoses) addPerson(d.doctorName);
  for (const p of a.procedures) addPerson(p.doctorName);
  for (const x of [...a.labs.map((l) => l.date), ...a.drugs.map((d) => d.date), ...a.procedures.map((p) => p.opDate)]) add(x);
  // free text: ห้ามหลุดไปทั้งข้อความ
  for (const t of [a.screen?.cc, a.screen?.hpi, a.screen?.pmh, a.prediag, ...extraFreeText]) {
    if (t && t.trim().length >= 6 && t.trim() !== "-") add(t.trim().slice(0, 40), 6);
  }
  return [...out];
}

/** ตรวจข้อความที่จะส่ง AI — throw DeidentificationError ถ้าพบสิ่งที่อาจระบุตัวตนหรือ free text */
export function assertNoIdentifiers(text: string, source: AdmissionDetail, extraFreeText: string[] = []): void {
  const reasons: string[] = [];
  if (/\d{7,}/.test(text)) reasons.push("มีตัวเลขยาว ≥ 7 หลัก (อาจเป็น HN/AN/เลขบัตร/เบอร์โทร)");
  if (/\d{4}-\d{2}-\d{2}/.test(text)) reasons.push("มีวันที่รูปแบบ YYYY-MM-DD");
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(text)) reasons.push("มีวันที่รูปแบบ DD/MM/YYYY");
  if (/\b0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}\b/.test(text)) reasons.push("มีรูปแบบเบอร์โทร");
  for (const s of forbiddenStrings(source, extraFreeText)) {
    if (text.includes(s)) reasons.push("พบข้อมูลระบุตัวตนหรือข้อความอิสระจากเวชระเบียน");
  }
  if (reasons.length) throw new DeidentificationError([...new Set(reasons)]);
}
