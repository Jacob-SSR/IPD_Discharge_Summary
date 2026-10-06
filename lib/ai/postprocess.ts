// lib/ai/postprocess.ts
// ตรวจผลจาก AI/กฎ ทุกครั้งก่อนแสดง:
//   1) กฎหลักฐาน: ทุกรหัสต้องอ้าง id ข้อมูลที่มีอยู่จริงในเวชระเบียน — ไม่มีหลักฐาน = ตัดออก (แจ้งจำนวน)
//   2) codebook: ไม่พบใน codebook = แสดงพร้อมคำเตือน (ห้ามซ่อน)
//   3) จัดรูปแบบรหัส, ตัดรหัสซ้ำ/ที่มีอยู่แล้ว, OR/Non-OR จากตาราง ORP

import type { Codebook } from "@/lib/coding/codebook";
import { isValidFormat, normalizeCode } from "@/lib/coding/icd";
import { isOrProcedure, type TdrgTables } from "@/lib/drg/tables";
import type { AiSuggestion, CheckedSuggestion, DeidentifiedCase, SuggestResult } from "./types";

export function evidenceLabel(c: DeidentifiedCase, id: string): string | null {
  const day = (d: number | null) => (d == null ? "" : ` (day ${d})`);
  const lab = c.labs.find((l) => l.id === id);
  if (lab) return `Lab: ${lab.test} ${lab.value}${lab.unit ? " " + lab.unit : ""}${day(lab.day)}`;
  const drug = c.drugs.find((d) => d.id === id);
  if (drug) return `ยา: ${drug.name}${day(drug.day)}`;
  const proc = c.procedures.find((p) => p.id === id);
  if (proc) return `หัตถการเดิม: ${proc.code}${day(proc.day)}`;
  const dx = c.existingDiagnoses.find((d) => d.id === id);
  if (dx) return `รหัสเดิม: ${dx.code}`;
  return null;
}

export function postprocess(
  raw: AiSuggestion[],
  c: DeidentifiedCase,
  books: { icd10: Codebook; icd9: Codebook },
  tables: TdrgTables,
): { suggestions: CheckedSuggestion[]; dropped: SuggestResult["droppedNoEvidence"] } {
  const existing = new Set([
    ...c.existingDiagnoses.map((d) => `ICD10:${d.code}`),
    ...c.procedures.map((p) => `ICD9CM:${p.code}`),
  ]);
  const hasPdx = c.existingDiagnoses.some((d) => d.type === "1");
  const seen = new Set<string>();
  const suggestions: CheckedSuggestion[] = [];
  const dropped: SuggestResult["droppedNoEvidence"] = [];

  for (const s of raw) {
    const code = normalizeCode(s.system, s.code);
    const key = `${s.system}:${code}`;
    if (seen.has(key) || existing.has(key)) continue;
    seen.add(key);

    const evidence = [...new Set(s.evidence)].filter((id) => evidenceLabel(c, id) != null);
    if (!evidence.length) {
      dropped.push({ code, system: s.system });
      continue;
    }

    const book = s.system === "ICD10" ? books.icd10 : books.icd9;
    const warnings: string[] = [];
    const validFormat = isValidFormat(s.system, code);
    if (!validFormat) warnings.push("รูปแบบรหัสไม่ถูกต้อง");
    const inCodebook = book.size > 0 ? book.has(code) : null;
    if (inCodebook === false) warnings.push(`ไม่พบใน codebook${book.isDemo ? " (ชุด demo)" : ""} — ตรวจรหัสก่อนยืนยัน`);
    if (inCodebook === null) warnings.push("ยังไม่มี codebook ให้ตรวจ");
    if (s.system === "ICD10" && s.diagtype === "1" && hasPdx) {
      warnings.push("เสนอเป็น PDx แต่เวชระเบียนมี PDx อยู่แล้ว — ตรวจ MB2");
    }

    const or = s.system === "ICD9CM" ? isOrProcedure(code, tables) : null;
    suggestions.push({
      ...s,
      code,
      evidence,
      inCodebook,
      codebookDescription: book.get(code)?.description ?? null,
      orType: or == null ? null : or ? "OR" : "NonOR",
      evidenceLabels: evidence.map((id) => evidenceLabel(c, id)!),
      warnings,
    });
  }
  return { suggestions, dropped };
}
