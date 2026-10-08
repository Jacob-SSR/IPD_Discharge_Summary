// lib/ai/types.ts — ชนิดข้อมูลของ AI แนะนำรหัส (รูปแบบเดียวกับโปรแกรมเดิม / สนามลอง AI ให้รหัส)

import type { HintKind, RuleHint } from "@/lib/coding/legacyRules";
import type { DiagType, OrType, Sex } from "@/lib/patients/types";

export type { HintKind };

/**
 * ข้อมูลที่อนุญาตให้ส่ง AI — สร้างจาก deidentify() เท่านั้น
 * มีเฉพาะข้อมูลมีโครงสร้าง: อายุ, เพศ, LOS, สถานะจำหน่าย, สัญญาณชีพ (ตัวเลข), รหัสเดิม, lab (ตัวเลข), ยา, หัตถการ
 * วันที่ทุกตัวเป็น "วันที่ของการนอน" D1 = วัน admit (แบบโปรแกรมเดิม)
 * ไม่มี free text: CC/HPI/PMH/การวินิจฉัยแรกรับที่พิมพ์/Course ที่แพทย์เขียน (กฎข้อ 2)
 */
export interface DeidentifiedCase {
  age: string; // "45" | "90+" | "unknown"
  sex: Sex;
  losDays: number | null;
  stillAdmitted: boolean;
  dischargeStatus: string | null;
  dischargeType: string | null;
  vitals: { bps: number | null; bpd: number | null; pulse: number | null; rr: number | null; temperature: number | null; bw: number | null } | null;
  admitDx: { code: string; name: string | null }[];
  diagnoses: { code: string; type: DiagType; name: string | null }[];
  procedures: { code: string; name: string | null; day: number | null }[];
  labs: { day: number | null; test: string; value: string; unit: string | null; ref: string | null; flag: "H" | "L" | "" }[];
  drugs: { name: string; qty: number | null; firstDay: number | null; lastDay: number | null }[];
  /** ข้อเสนอจากกฎ (เหตุผล + หลักฐานที่ไม่ใช่ free text) */
  hints: { code: string; reason: string; evidence: string[] }[];
}

export type ItemSource = "ai" | "rule" | "ai+rule" | "manual";

/** รายการรหัสหนึ่งตัว (จาก AI / กฎ / แพทย์เพิ่ม) ก่อนตรวจ */
export interface CodeItem {
  kind: HintKind;
  code: string;
  name?: string | null;
  diagtype: number | null;
  reason: string;
  evidence: string[];
  confidence: number;
  source: ItemSource;
  origin?: RuleHint["origin"];
  /** หัตถการที่แพทย์เพิ่มเอง */
  procClass?: OrType | null;
  procDate?: string | null;
}

/** รายการหลังรวม (merge) + ตรวจกับ codebook แล้ว — ที่แสดงบนหน้าจอ */
export interface MergedItem extends CodeItem {
  key: string;
  name: string | null;
  formatOk: boolean;
  inBook: boolean;
  /** มีอยู่แล้วใน HOSxP */
  already: boolean;
  procClass: OrType | null;
  /** หลักฐานไม่ตรงกับข้อมูลในชาร์ต (กฎหลักฐาน) */
  evidenceUnmatched: boolean;
}

/** ผลจาก AI หนึ่งครั้ง (เก็บใน ai_runs.result — ไม่มีข้อมูลระบุตัวตน) */
export interface AiAnalysis {
  items: CodeItem[];
  remarks: string[];
  draft: string;
  /** รหัสที่ AI เสนอแต่ไม่อ้างหลักฐานเลย → ตัดออก (กฎหลักฐาน) */
  droppedNoEvidence: string[];
  secs: number;
}

export type ProviderName = "gemini" | "rules";

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string | null;
  /** วิเคราะห์ทั้งรหัส + ร่าง Course ในครั้งเดียว (แบบโปรแกรมเดิม) */
  analyze(prompt: string): Promise<Omit<AiAnalysis, "secs" | "droppedNoEvidence">>;
}

export interface AnalyzeResult extends AiAnalysis {
  runId: number;
  provider: ProviderName;
  model: string | null;
  fallbackReason: string | null;
  createdAt: string;
}

export type { DiagType };
