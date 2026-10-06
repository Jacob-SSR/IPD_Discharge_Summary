// lib/ai/rules.ts
// engine แบบกฎ — ใช้เมื่อ AI_PROVIDER=rules หรือ Gemini ไม่ตอบ/ตอบผิด schema/ยังไม่ได้ตั้งค่า
// ทำงานบน DeidentifiedCase เหมือน Gemini ทุกประการ (หน้าเว็บไม่ต้องรู้ว่าผลมาจากไหน)

import { DRUG_PROCEDURE_RULES, LAB_RULES } from "./rules.config";
import type { AiProvider, AiSuggestion, DeidentifiedCase } from "./types";

function firstNumber(value: string): number | null {
  const m = /^[<>]?(-?\d+(?:\.\d+)?)/.exec(value);
  return m ? Number(m[1]) : null;
}

export function ruleSuggestions(c: DeidentifiedCase): AiSuggestion[] {
  const existing = c.existingDiagnoses.map((d) => d.code);
  const existingProcs = c.procedures.map((p) => p.code);
  const out: AiSuggestion[] = [];

  for (const rule of LAB_RULES) {
    if (existing.some((code) => rule.excludeIfPrefix.some((p) => code.startsWith(p)))) continue;
    const hits = c.labs.filter((l) => {
      if (!rule.test.test(l.test)) return false;
      if (l.value.includes("-")) return false; // ช่วงค่า ไม่ใช้ตัดสิน
      const v = firstNumber(l.value);
      if (v == null) return false;
      return rule.op === "<" ? v < rule.threshold : v > rule.threshold;
    });
    if (!hits.length) continue;
    const shown = hits
      .map((h) => `${h.test} ${h.value}${h.unit ? " " + h.unit : ""}${h.day != null ? ` (day ${h.day})` : ""}`)
      .join(", ");
    out.push({
      code: rule.code,
      system: "ICD10",
      diagtype: rule.diagtype,
      description: rule.description,
      rationale: `กฎ ${rule.id}: ${shown} ${rule.op} ${rule.threshold}`,
      evidence: hits.map((h) => h.id),
    });
  }

  for (const rule of DRUG_PROCEDURE_RULES) {
    if (existingProcs.includes(rule.code)) continue;
    const hits = c.drugs.filter((d) => rule.drug.test(d.name));
    if (!hits.length) continue;
    out.push({
      code: rule.code,
      system: "ICD9CM",
      diagtype: null,
      description: rule.description,
      rationale: `กฎ ${rule.id}: มีรายการ ${hits.map((h) => h.name).join(", ")}`,
      evidence: hits.map((h) => h.id),
    });
  }
  return out;
}

const fmtDay = (d: number | null) => (d == null ? "" : `Day ${d}`);

/** ร่าง Course in hospital จากข้อมูลมีโครงสร้าง (ภาษาอังกฤษ ใช้ Day N แทนวันที่) */
export function ruleCourse(c: DeidentifiedCase): string {
  const lines: string[] = [];
  const pdx = c.existingDiagnoses.find((d) => d.type === "1");
  const others = c.existingDiagnoses.filter((d) => d.type !== "1").map((d) => d.code);
  lines.push(
    `A ${c.age === "unknown" ? "" : c.age + "-year-old "}${c.sex === "M" ? "male" : c.sex === "F" ? "female" : "patient"} was admitted` +
      (pdx ? ` with a principal diagnosis of ${pdx.code}` : "") +
      (others.length ? ` (other diagnoses: ${others.join(", ")})` : "") +
      ".",
  );

  const abnormal = c.labs.filter((l) => {
    const v = firstNumber(l.value);
    if (v == null || !l.ref) return false;
    const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(l.ref);
    if (m) return v < Number(m[1]) || v > Number(m[2]);
    const lt = /^<(\d+(?:\.\d+)?)$/.exec(l.ref);
    return lt ? v >= Number(lt[1]) : false;
  });
  if (abnormal.length) {
    lines.push(
      `Abnormal investigations: ${abnormal.map((l) => `${l.test} ${l.value}${l.unit ? " " + l.unit : ""} (${fmtDay(l.day)})`).join("; ")}.`,
    );
  }

  const drugNames = [...new Set(c.drugs.map((d) => d.name))];
  if (drugNames.length) lines.push(`Treatment included ${drugNames.join(", ")}.`);
  if (c.procedures.length) {
    lines.push(`Procedures: ${c.procedures.map((p) => `${p.code} (${fmtDay(p.day)})`).join(", ")}.`);
  }
  lines.push(
    c.stillAdmitted
      ? "The patient is still admitted."
      : `The patient was discharged after ${c.losDays ?? "-"} day(s) of hospitalization.`,
  );
  return lines.join(" ");
}

export const rulesProvider: AiProvider = {
  name: "rules",
  model: null,
  async suggestCodes(input) {
    return ruleSuggestions(input);
  },
  async draftCourse(input) {
    return ruleCourse(input);
  },
};
