// lib/ai/types.ts

import type { CodeSystem } from "@/lib/appdb/types";
import type { CodingIssue } from "@/lib/coding/checks";
import type { DiagType, OrType } from "@/lib/patients/types";

/**
 * ข้อมูลที่อนุญาตให้ส่ง AI — สร้างจาก deidentify() เท่านั้น
 * มีแต่ข้อมูลมีโครงสร้าง: รหัสเดิม, lab (ตัวเลข), ยา, หัตถการ, LOS, อายุ, เพศ
 * วันที่ทุกตัวแปลงเป็น "วันที่นับจาก admit" (day 0 = วัน admit)
 */
export interface DeidentifiedCase {
  age: string; // "45" | "90+" | "unknown"
  sex: "M" | "F" | "U";
  losDays: number | null;
  stillAdmitted: boolean;
  existingDiagnoses: { id: string; code: string; type: DiagType }[];
  procedures: { id: string; code: string; day: number | null }[];
  labs: { id: string; test: string; value: string; unit: string | null; ref: string | null; day: number | null }[];
  drugs: { id: string; name: string; day: number | null }[];
}

export interface AiSuggestion {
  code: string;
  system: CodeSystem;
  /** ประเภทการวินิจฉัย (ICD-10) — null สำหรับหัตถการ */
  diagtype: DiagType | null;
  description: string;
  rationale: string;
  /** id ของข้อมูลใน DeidentifiedCase ที่รองรับรหัสนี้ */
  evidence: string[];
}

export interface CheckedSuggestion extends AiSuggestion {
  /** null = ยังไม่มี codebook ให้ตรวจ */
  inCodebook: boolean | null;
  codebookDescription: string | null;
  /** ICD-9-CM: OR/Non-OR ตามตาราง ORP (null = ไม่ทราบ) */
  orType: OrType | null;
  evidenceLabels: string[];
  warnings: string[];
}

export type ProviderName = "gemini" | "rules";

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string | null;
  suggestCodes(input: DeidentifiedCase): Promise<AiSuggestion[]>;
  draftCourse(input: DeidentifiedCase): Promise<string>;
}

export interface SuggestResult {
  runId: number;
  provider: ProviderName;
  model: string | null;
  fallbackReason: string | null;
  suggestions: CheckedSuggestion[];
  /** รหัสที่ถูกตัดเพราะไม่อ้างหลักฐานที่มีอยู่จริง (กฎหลักฐาน) */
  droppedNoEvidence: { code: string; system: CodeSystem }[];
  createdAt: string;
}

export interface CourseResult {
  runId: number;
  provider: ProviderName;
  model: string | null;
  fallbackReason: string | null;
  text: string;
  createdAt: string;
}

export type { CodingIssue };
