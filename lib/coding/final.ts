// lib/coding/final.ts
// ชุดรหัสในแบบฟอร์ม = รหัสใน HOSxP + รหัสที่แพทย์ยืนยัน (ยอมรับจากข้อเสนอ / เพิ่มเอง) — แบบ renderForm ของโปรแกรมเดิม
// ฟังก์ชันล้วน ใช้ได้ทั้งฝั่ง server และ browser

import type { MergedItem } from "@/lib/ai/types";
import type { CodeSystem } from "@/lib/appdb/types";
import type { AdmissionDetail, DiagType, OrType } from "@/lib/patients/types";

export type CodeOrigin = "hosxp" | "ai" | "manual";

export const ORIGIN_LABEL: Record<CodeOrigin, string> = { hosxp: "HOSxP", ai: "ยืนยันจาก AI", manual: "แพทย์เพิ่ม" };

export interface FinalCode {
  system: CodeSystem;
  code: string;
  diagtype: DiagType | null;
  orType: OrType | null;
  opDate: string | null;
  origin: CodeOrigin;
  name: string | null;
  /** extension code ของหัตถการใน HOSxP (เช่น 990401 → "01") */
  ext?: string | null;
  /** PDx เดิมใน HOSxP ที่แพทย์ยืนยัน PDx ใหม่แทน (แสดงขีดฆ่า "เสนอเปลี่ยน") */
  replaced?: boolean;
}

const asDiagType = (n: number | null): DiagType | null => (n && n >= 1 && n <= 5 ? (String(n) as DiagType) : null);

export function finalCodes(
  a: Pick<AdmissionDetail, "diagnoses" | "procedures">,
  accepted: MergedItem[],
): { dx: FinalCode[]; px: FinalCode[] } {
  const accDx = accepted.filter((x) => x.kind === "dx");
  const accPx = accepted.filter((x) => x.kind === "proc");
  const accPdx = accDx.some((x) => x.diagtype === 1);
  const origin = (x: MergedItem): CodeOrigin => (x.source === "manual" ? "manual" : "ai");
  const dx: FinalCode[] = [
    ...a.diagnoses.map<FinalCode>((d) => ({
      system: "ICD10",
      code: d.icd10,
      diagtype: d.diagtype,
      orType: null,
      opDate: null,
      origin: "hosxp",
      name: d.name,
      replaced: accPdx && d.diagtype === "1",
    })),
    ...accDx.map<FinalCode>((x) => ({
      system: "ICD10",
      code: x.code,
      diagtype: asDiagType(x.diagtype),
      orType: null,
      opDate: null,
      origin: origin(x),
      name: x.name,
    })),
  ].sort((x, y) => (x.replaced ? 9 : Number(x.diagtype ?? 9)) - (y.replaced ? 9 : Number(y.diagtype ?? 9)));
  const px: FinalCode[] = [
    ...a.procedures.map<FinalCode>((p) => ({
      system: "ICD9CM",
      code: p.icd9,
      diagtype: null,
      orType: p.orType ?? null,
      opDate: p.opDate,
      origin: "hosxp",
      name: p.name,
      ext: p.ext ?? null,
    })),
    ...accPx.map<FinalCode>((x) => ({
      system: "ICD9CM",
      code: x.code,
      diagtype: null,
      orType: x.procClass,
      opDate: x.procDate ?? null,
      origin: origin(x),
      name: x.name,
    })),
  ].sort((x, y) => (x.orType === "OR" ? 0 : 1) - (y.orType === "OR" ? 0 : 1));
  return { dx, px };
}

export const DT_SHORT: Record<number, string> = { 1: "PDx", 2: "Comorbidity", 3: "Complication", 4: "Other", 5: "External cause" };

/** ข้อความ "รหัสที่ยอมรับ" แบบโปรแกรมเดิม: E87.6 (Comorbidity), 93.94 [หัตถการ] */
export function acceptedLabel(acc: MergedItem[]): string {
  return acc.map((s) => s.code + (s.kind === "dx" ? ` (${DT_SHORT[s.diagtype ?? 0] ?? ""})` : " [หัตถการ]")).join(", ");
}

/** ข้อความสำหรับคัดลอกไปลง HOSxP เอง (รหัสคั่นด้วยช่องว่าง แบบโปรแกรมเดิม) */
export function copyText(acc: MergedItem[]): string {
  return acc.map((s) => s.code).join(" ");
}
