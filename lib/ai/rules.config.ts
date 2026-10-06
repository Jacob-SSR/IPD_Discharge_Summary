// lib/ai/rules.config.ts
// กฎของ engine แบบกฎ (fallback เมื่อ AI ไม่ตอบหรือไม่ได้ตั้งค่า)
// ⚠️ เกณฑ์ตัวเลขทุกข้อเป็นการตัดสินใจทางคลินิก — ยังไม่ได้เทียบกับกฎของโปรแกรมเดิม (legacy)
//    และต้องให้แพทย์/ผู้ให้รหัสตรวจทานก่อนใช้จริง (CLINICAL_REVIEWED = false)
//    ผลทุกข้อเป็นข้อเสนอแนะที่แพทย์ต้องกดยืนยันทีละรหัส

import type { DiagType } from "@/lib/patients/types";

export const CLINICAL_REVIEWED = false;

export interface LabRule {
  id: string;
  /** จับชื่อ lab (ชื่อใน HOSxP แต่ละที่ต่างกัน) */
  test: RegExp;
  op: "<" | ">";
  threshold: number;
  code: string;
  description: string;
  diagtype: DiagType;
  /** ไม่เสนอถ้ามีรหัสที่ขึ้นต้นด้วยค่าเหล่านี้อยู่แล้ว */
  excludeIfPrefix: string[];
}

export const LAB_RULES: LabRule[] = [
  {
    id: "hypokalaemia",
    test: /^(potassium|k|k\+)\b|\(k\)/i,
    op: "<",
    threshold: 3.5,
    code: "E87.6",
    description: "Hypokalaemia",
    diagtype: "2",
    excludeIfPrefix: ["E87.6"],
  },
  {
    id: "hyperkalaemia",
    test: /^(potassium|k|k\+)\b|\(k\)/i,
    op: ">",
    threshold: 5.5,
    code: "E87.5",
    description: "Hyperkalaemia",
    diagtype: "2",
    excludeIfPrefix: ["E87.5"],
  },
  {
    id: "hyponatraemia",
    test: /^(sodium|na|na\+)\b|\(na\)/i,
    op: "<",
    threshold: 135,
    code: "E87.1",
    description: "Hypo-osmolality and hyponatraemia",
    diagtype: "2",
    excludeIfPrefix: ["E87.1"],
  },
  {
    id: "hypernatraemia",
    test: /^(sodium|na|na\+)\b|\(na\)/i,
    op: ">",
    threshold: 145,
    code: "E87.0",
    description: "Hyperosmolality and hypernatraemia",
    diagtype: "2",
    excludeIfPrefix: ["E87.0"],
  },
  {
    id: "anaemia",
    test: /^(hemoglobin|haemoglobin|hb|hgb)\b/i,
    op: "<",
    threshold: 10,
    code: "D64.9",
    description: "Anaemia, unspecified",
    diagtype: "2",
    excludeIfPrefix: ["D50", "D51", "D52", "D53", "D55", "D56", "D57", "D58", "D59", "D60", "D61", "D62", "D63", "D64"],
  },
  {
    id: "thrombocytopenia",
    test: /^(platelet|plt)/i,
    op: "<",
    threshold: 100,
    code: "D69.6",
    description: "Thrombocytopenia, unspecified",
    diagtype: "2",
    // ไข้เลือดออก: เกล็ดเลือดต่ำเป็นส่วนหนึ่งของโรค ไม่ให้รหัสแยก
    excludeIfPrefix: ["D69", "A90", "A91"],
  },
];

export interface DrugProcedureRule {
  id: string;
  drug: RegExp;
  code: string;
  description: string;
}

/** ยา/เวชภัณฑ์ที่บ่งชี้หัตถการ ICD-9-CM */
export const DRUG_PROCEDURE_RULES: DrugProcedureRule[] = [
  { id: "prc-transfusion", drug: /packed red|\bprc\b|\blprc\b/i, code: "99.04", description: "Transfusion of packed cells" },
  { id: "platelet-transfusion", drug: /platelet concentrate|\bplt conc/i, code: "99.05", description: "Transfusion of platelets" },
];
