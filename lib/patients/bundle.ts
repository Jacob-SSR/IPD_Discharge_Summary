// lib/patients/bundle.ts — ชนิดข้อมูลที่ API หน้าทำงาน (3 คอลัมน์) ส่งให้ browser (type อย่างเดียว)

import type { AiStatus, Workspace } from "@/lib/ai";
import type { ChartLevel } from "@/lib/coding/legacyRules";
import type { LabLine, MedLine } from "./summary";
import type { AdmissionRow } from "./types";

export interface RefInfo {
  source: string | null;
  isDemo: boolean;
  size: number;
}

export interface WorkspaceBundle extends Workspace {
  labs: LabLine[];
  meds: MedLine[];
  ai: AiStatus;
  canDecide: boolean;
  hospital: { name: string; code: string; province: string };
  baseRate: number;
  refs: [string, string][];
  reference: {
    icd10: RefInfo;
    icd9: RefInfo;
    tdrg: RefInfo & { formulaVerified: boolean };
    rulesReviewed: boolean;
  };
}

/** แถวในรายชื่อด้านซ้าย */
export interface ListItem extends AdmissionRow {
  /** ยังไม่มี PDx ใน HOSxP */
  pending: boolean;
  level: ChartLevel;
  aiRan: boolean;
}

export interface Tally {
  from: string;
  to: string;
  analyzed: number;
  accepted: number;
  rejected: number;
  rate: number | null;
  /** รายที่ลงรหัสแล้ว = RW ที่เพิ่ม · รายรอสรุป = RW ทั้งราย (ค่าประมาณ) */
  rwGain: number;
  capped: boolean;
}
