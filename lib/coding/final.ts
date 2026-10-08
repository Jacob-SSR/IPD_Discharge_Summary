// lib/coding/final.ts
// รวม "ชุดรหัสสุดท้าย" = รหัสใน HOSxP + รหัสที่แพทย์กดยอมรับจากข้อเสนอ + รหัสที่แพทย์เพิ่มเอง
// ฟังก์ชันล้วน (ไม่แตะ DB/fs) ใช้ได้ทั้งฝั่ง server และ browser
// การตัดสินใจล่าสุดของรหัสเดียวกันเป็นตัวชี้ขาด

import type { CodeDecision, CodeSystem, DecisionSource } from "@/lib/appdb/types";
import type { AdmissionDetail, DiagType, OrType } from "@/lib/patients/types";

export type CodeOrigin = "hosxp" | DecisionSource;

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
}

export type SuggestionState = "pending" | "accepted" | "rejected";

function key(system: CodeSystem, code: string) {
  return `${system}:${code}`;
}

/** การตัดสินใจล่าสุดต่อ (AN, แหล่ง, รหัส) */
export function latestDecisions(decisions: CodeDecision[]): Map<string, CodeDecision> {
  const map = new Map<string, CodeDecision>();
  for (const d of [...decisions].sort((a, b) => a.id - b.id)) {
    const cls = d.source === "manual" ? "manual" : "suggested";
    map.set(`${d.an}|${cls}|${key(d.system, d.code)}`, d);
  }
  return map;
}

export function suggestionState(
  latest: Map<string, CodeDecision>,
  an: string,
  system: CodeSystem,
  code: string,
): SuggestionState {
  const d = latest.get(`${an}|suggested|${key(system, code)}`);
  return d?.action === "accept" ? "accepted" : d?.action === "reject" ? "rejected" : "pending";
}

export function buildFinalCodes(
  a: Pick<AdmissionDetail, "diagnoses" | "procedures">,
  decisions: CodeDecision[],
  names: Record<string, string> = {},
): FinalCode[] {
  const out: FinalCode[] = [];
  const seen = new Set<string>();
  const push = (c: FinalCode) => {
    const k = key(c.system, c.code);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };

  for (const d of a.diagnoses) {
    push({ system: "ICD10", code: d.icd10, diagtype: d.diagtype, orType: null, opDate: null, origin: "hosxp", name: d.name });
  }
  for (const p of a.procedures) {
    push({ system: "ICD9CM", code: p.icd9, diagtype: null, orType: null, opDate: p.opDate, origin: "hosxp", name: p.name, ext: p.ext ?? null });
  }
  for (const d of latestDecisions(decisions).values()) {
    const included = d.action === "accept" || d.action === "add";
    if (!included) continue;
    push({
      system: d.system,
      code: d.code,
      diagtype: d.diagtype,
      orType: d.orType,
      opDate: d.opDate,
      origin: d.source,
      name: names[key(d.system, d.code)] ?? null,
    });
  }
  // เรียง: PDx → SDx ตามประเภท → หัตถการ
  return out.sort((x, y) => {
    if (x.system !== y.system) return x.system === "ICD10" ? -1 : 1;
    return (x.diagtype ?? "9").localeCompare(y.diagtype ?? "9");
  });
}

/** ข้อความสำหรับคัดลอกไปลง HOSxP เอง */
export function codesToClipboardText(codes: FinalCode[]): string {
  const dx = codes.filter((c) => c.system === "ICD10");
  const px = codes.filter((c) => c.system === "ICD9CM");
  const lines: string[] = [];
  const pdx = dx.filter((c) => c.diagtype === "1");
  if (pdx.length) lines.push(`PDx: ${pdx.map((c) => c.code).join(", ")}`);
  const groups: [DiagType, string][] = [["2", "Comorbidity"], ["3", "Complication"], ["4", "Other"], ["5", "External cause"]];
  for (const [t, label] of groups) {
    const g = dx.filter((c) => c.diagtype === t);
    if (g.length) lines.push(`${label}: ${g.map((c) => c.code).join(", ")}`);
  }
  if (px.length) lines.push(`ICD-9-CM: ${px.map((c) => `${c.code}${c.orType ? ` (${c.orType})` : ""}`).join(", ")}`);
  return lines.join("\n");
}
