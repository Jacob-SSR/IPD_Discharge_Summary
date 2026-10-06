// lib/coding/checks.ts
// ตรวจชุดรหัสตามกฎ ICD-10 Vol.2 (morbidity coding):
//   MB1 ภาวะรองถูกบันทึกเป็นโรคหลัก, MB2 มีหลายโรคหลัก, MB3 อาการเป็นโรคหลักทั้งที่มีการวินิจฉัย,
//   MB4 ความเฉพาะเจาะจง, MB5 ตรวจไม่ได้จากข้อมูลมีโครงสร้าง (ต้องอ่านข้อความแพทย์)
//   + dagger/asterisk, sequelae, external cause, codebook
// ผลเป็น "คำเตือน" ให้แพทย์/ผู้ให้รหัสตัดสินใจ — ระบบไม่เปลี่ยนรหัสให้เอง

import type { CodeSystem } from "@/lib/appdb/types";
import type { DiagType } from "@/lib/patients/types";
import { getCodebook, type Codebook } from "./codebook";
import { category, inRange, isValidFormat } from "./icd";
import {
  ASTERISK_CATEGORIES,
  DAGGER_PAIRS,
  EXTERNAL_CAUSE_RANGE,
  INJURY_RANGE,
  MB1_BACKGROUND_CODES,
  SEQUELAE_CATEGORIES,
} from "./rules.config";

export type CodingRule =
  | "NO_PDX"
  | "MB1"
  | "MB2"
  | "MB3"
  | "MB4"
  | "ASTERISK_AS_PDX"
  | "ASTERISK_PAIR"
  | "SEQUELAE_AS_PDX"
  | "INJURY_NO_EXTERNAL_CAUSE"
  | "EXTERNAL_CAUSE_AS_PDX"
  | "EXTERNAL_CAUSE_DIAGTYPE"
  | "INVALID_FORMAT"
  | "NOT_IN_CODEBOOK"
  | "NO_CODEBOOK";

export type Severity = "error" | "warning" | "info";

export interface CodingIssue {
  rule: CodingRule;
  severity: Severity;
  message: string;
  codes: string[];
}

export interface CodeSetDiagnosis {
  code: string;
  diagtype: DiagType;
}

export interface CodeSet {
  diagnoses: CodeSetDiagnosis[];
  procedures: { code: string }[];
}

export function isAsterisk(code: string): boolean {
  return ASTERISK_CATEGORIES.includes(category(code)) || code in DAGGER_PAIRS;
}

export function isSequelae(code: string): boolean {
  return SEQUELAE_CATEGORIES.includes(category(code));
}

export function isExternalCause(code: string): boolean {
  return inRange(code, EXTERNAL_CAUSE_RANGE.from, EXTERNAL_CAUSE_RANGE.to);
}

export function isInjury(code: string): boolean {
  return inRange(code, INJURY_RANGE.from, INJURY_RANGE.to);
}

function isSymptom(code: string): boolean {
  return code.startsWith("R");
}

function isBackground(code: string): boolean {
  return MB1_BACKGROUND_CODES.some((c) => code === c || (c.length === 3 && category(code) === c));
}

/** โรคที่ "อธิบายได้" — ไม่ใช่อาการ (R), ไม่ใช่ Z, ไม่ใช่สาเหตุภายนอก */
function isDefinitiveDiagnosis(code: string): boolean {
  return !isSymptom(code) && !code.startsWith("Z") && !isExternalCause(code);
}

export function checkCodeSet(
  set: CodeSet,
  books?: { icd10: Codebook; icd9: Codebook },
): CodingIssue[] {
  const issues: CodingIssue[] = [];
  const dx = set.diagnoses;
  const pdxList = dx.filter((d) => d.diagtype === "1");
  const sdx = dx.filter((d) => d.diagtype !== "1");
  const pdx = pdxList[0]?.code;

  // ── PDx ──────────────────────────────────────────────────────────────────
  if (pdxList.length === 0) {
    issues.push({ rule: "NO_PDX", severity: "error", message: "ยังไม่มีโรคหลัก (PDx)", codes: [] });
  }
  if (pdxList.length > 1) {
    issues.push({
      rule: "MB2",
      severity: "error",
      message: "MB2: มีโรคหลักมากกว่า 1 รหัส — เลือกโรคที่เป็นเหตุผลหลักของการรับไว้รักษาเพียงรหัสเดียว",
      codes: pdxList.map((d) => d.code),
    });
  }

  if (pdx) {
    // MB1
    const acute = sdx.filter((d) => isDefinitiveDiagnosis(d.code) && !isBackground(d.code));
    if (isBackground(pdx) && acute.length) {
      issues.push({
        rule: "MB1",
        severity: "warning",
        message: `MB1: PDx ${pdx} เป็นภาวะเรื้อรัง/ภาวะรอง แต่มีโรคที่อาจเป็นเหตุผลหลักของการรับไว้ใน SDx — ตรวจว่าควรสลับหรือไม่`,
        codes: [pdx, ...acute.map((d) => d.code)],
      });
    }
    // MB3
    const definitive = sdx.filter((d) => isDefinitiveDiagnosis(d.code));
    if (isSymptom(pdx) && definitive.length) {
      issues.push({
        rule: "MB3",
        severity: "warning",
        message: `MB3: PDx ${pdx} เป็นอาการ/อาการแสดง ขณะที่มีการวินิจฉัยที่อธิบายอาการได้ — พิจารณาใช้โรคที่วินิจฉัยได้เป็น PDx`,
        codes: [pdx, ...definitive.map((d) => d.code)],
      });
    }
    // MB4
    const moreSpecific = sdx.filter(
      (d) => category(d.code) === category(pdx) && d.code !== pdx && !d.code.endsWith(".9"),
    );
    if ((pdx.endsWith(".9") || pdx.length === 3) && moreSpecific.length) {
      issues.push({
        rule: "MB4",
        severity: "warning",
        message: `MB4: PDx ${pdx} ไม่เฉพาะเจาะจง แต่มีรหัสในหมวดเดียวกันที่ระบุชัดกว่า — พิจารณาใช้รหัสที่เฉพาะเจาะจงเป็น PDx`,
        codes: [pdx, ...moreSpecific.map((d) => d.code)],
      });
    }
    // dagger/asterisk
    if (isAsterisk(pdx)) {
      issues.push({
        rule: "ASTERISK_AS_PDX",
        severity: "error",
        message: `${pdx} เป็นรหัส asterisk (*) ใช้เป็นโรคหลักไม่ได้ — ใช้รหัสสาเหตุ (dagger †) เป็น PDx`,
        codes: [pdx],
      });
    }
    // sequelae
    if (isSequelae(pdx)) {
      issues.push({
        rule: "SEQUELAE_AS_PDX",
        severity: "warning",
        message: `${pdx} เป็นรหัส sequelae — ถ้าระบุภาวะที่หลงเหลืออยู่ได้ ให้ใช้ภาวะนั้นเป็น PDx และใส่ sequelae เป็นรหัสเพิ่มเติม`,
        codes: [pdx],
      });
    }
    // external cause เป็น PDx
    if (isExternalCause(pdx)) {
      issues.push({
        rule: "EXTERNAL_CAUSE_AS_PDX",
        severity: "error",
        message: `${pdx} เป็นรหัสสาเหตุภายนอก (V01–Y98) ใช้เป็นโรคหลักไม่ได้ — ใช้รหัสการบาดเจ็บเป็น PDx`,
        codes: [pdx],
      });
    }
  }

  // ── asterisk ทุกตำแหน่งต้องมีคู่ dagger ──────────────────────────────────
  const allCodes = dx.map((d) => d.code);
  for (const d of dx) {
    if (!isAsterisk(d.code)) continue;
    const pairs = DAGGER_PAIRS[d.code];
    if (pairs) {
      if (!pairs.some((p) => allCodes.includes(p))) {
        issues.push({
          rule: "ASTERISK_PAIR",
          severity: "warning",
          message: `${d.code}* ต้องมีรหัสสาเหตุคู่กัน (${pairs.join(", ")})`,
          codes: [d.code],
        });
      }
    } else if (!allCodes.some((c) => c !== d.code && !isAsterisk(c))) {
      issues.push({
        rule: "ASTERISK_PAIR",
        severity: "warning",
        message: `${d.code}* เป็นรหัส asterisk — ตรวจว่ามีรหัสสาเหตุ (dagger †) คู่กัน`,
        codes: [d.code],
      });
    }
  }

  // ── external cause ────────────────────────────────────────────────────────
  const injuries = dx.filter((d) => isInjury(d.code));
  const externals = dx.filter((d) => isExternalCause(d.code));
  if (injuries.length && !externals.length) {
    issues.push({
      rule: "INJURY_NO_EXTERNAL_CAUSE",
      severity: "warning",
      message: "มีรหัสการบาดเจ็บ/พิษ (S00–T98) แต่ไม่มีรหัสสาเหตุภายนอก (V01–Y98)",
      codes: injuries.map((d) => d.code),
    });
  }
  for (const d of dx) {
    if (d.diagtype === "1") continue;
    const ext = isExternalCause(d.code);
    if (ext !== (d.diagtype === "5")) {
      issues.push({
        rule: "EXTERNAL_CAUSE_DIAGTYPE",
        severity: "warning",
        message: ext
          ? `${d.code} เป็นสาเหตุภายนอก ควรบันทึกเป็นประเภท 5 (External cause)`
          : `${d.code} ไม่ใช่รหัสสาเหตุภายนอก แต่บันทึกเป็นประเภท 5`,
        codes: [d.code],
      });
    }
  }

  // ── รูปแบบรหัส + codebook (ห้ามซ่อน) ──────────────────────────────────────
  const b = books ?? { icd10: getCodebook("ICD10"), icd9: getCodebook("ICD9CM") };
  const check = (system: CodeSystem, code: string, book: Codebook) => {
    if (!isValidFormat(system, code)) {
      issues.push({
        rule: "INVALID_FORMAT",
        severity: "error",
        message: `${code} รูปแบบรหัส ${system === "ICD10" ? "ICD-10" : "ICD-9-CM"} ไม่ถูกต้อง`,
        codes: [code],
      });
    } else if (book.size > 0 && !book.has(code)) {
      issues.push({
        rule: "NOT_IN_CODEBOOK",
        severity: "warning",
        message: `${code} ไม่พบใน codebook ${system === "ICD10" ? "ICD-10-TM" : "ICD-9-CM"}${book.isDemo ? " (ชุด demo)" : ""}`,
        codes: [code],
      });
    }
  };
  for (const d of dx) check("ICD10", d.code, b.icd10);
  for (const p of set.procedures) check("ICD9CM", p.code, b.icd9);
  for (const [sys, book] of [["ICD-10", b.icd10], ["ICD-9-CM", b.icd9]] as const) {
    if (book.size === 0) {
      issues.push({
        rule: "NO_CODEBOOK",
        severity: "warning",
        message: `ยังไม่มี codebook ${sys} — ตรวจรหัสกับ codebook ไม่ได้`,
        codes: [],
      });
    }
  }

  return issues;
}
