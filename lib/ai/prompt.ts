// lib/ai/prompt.ts
// ข้อความที่ส่งให้ AI — คำสั่ง (system) และรูปแบบ JSON ชุดเดียวกับโปรแกรมเดิม
// ส่วน "ข้อมูลผู้ป่วย" สร้างจาก DeidentifiedCase เท่านั้น (ไม่มีชื่อ/HN/AN/วันที่/free text)
// ต่างจากโปรแกรมเดิมตรงที่ไม่ส่ง CC/HPI/PMH/การวินิจฉัยแรกรับที่พิมพ์/Course ที่แพทย์เขียน (กฎข้อ 2 ของ CLAUDE.md)

import legacy from "./legacy-prompt.json";
import type { DeidentifiedCase } from "./types";

export const SYSTEM_PROMPT: string = (legacy as { system: string }).system;

export const FORMAT = `Reply with only one JSON object in exactly this shape (example values):
{"pdx":{"code":"J18.9","name":"Pneumonia, unspecified","reason":"เหตุผลภาษาไทยสั้น ๆ","rule":"MB3","evidence":["CXR infiltrate"],"confidence":0.8},
 "secondary":[{"code":"E87.6","name":"Hypokalaemia","diagtype":3,"reason":"...","evidence":["K 3.1 D2","KCl"],"confidence":0.8}],
 "procedures":[{"code":"93.94","name":"Respiratory medication administered by nebulizer","reason":"...","evidence":["Salbutamol NB"],"confidence":0.7}],
 "remarks":["ข้อสังเกตภาษาไทย"],
 "course_draft":"ร่างสรุปการรักษาภาษาไทย 3-6 ประโยค จากข้อมูลในชาร์ตเท่านั้น"}
diagtype: 2=Comorbidity 3=Complication 4=Other 5=External cause. Include already-coded codes you agree with.
Use ICD-10-TM codes with a dot (E87.6) and ICD-9-CM codes with a dot (93.94).`;

const TYPE_LABEL: Record<string, string> = {
  "1": "Principal",
  "2": "Comorbidity",
  "3": "Complication",
  "4": "Other",
  "5": "External cause",
};

const d = (n: number | null) => (n == null ? "" : `D${n}`);
const v = (x: number | null) => (x == null ? "-" : String(x));

export function buildContext(c: DeidentifiedCase): string {
  const out: string[] = [];
  out.push(`Patient: ${c.age} y, sex=${c.sex === "M" ? "male" : c.sex === "F" ? "female" : "unknown"}`);
  out.push(
    c.stillAdmitted
      ? `LOS so far: ${v(c.losDays)} days (still admitted)`
      : `LOS: ${v(c.losDays)} days; Discharge status: ${c.dischargeStatus ?? "-"}; Discharge type: ${c.dischargeType ?? "-"}`,
  );
  if (c.vitals) {
    const s = c.vitals;
    out.push(`Vital signs on admission: BP ${v(s.bps)}/${v(s.bpd)}, PR ${v(s.pulse)}, RR ${v(s.rr)}, T ${v(s.temperature)}, BW ${v(s.bw)}`);
  }
  out.push("(Chief complaint, history and physician notes are free text and are not sent — use only the structured data below.)");
  if (c.admitDx.length) {
    out.push(`Diagnoses coded at the admitting ER/OPD visit (NOT final): ${c.admitDx.map((x) => `${x.code}${x.name ? " " + x.name : ""}`).join("; ")}`);
  }

  out.push("", "Current coding in HOSxP:");
  if (!c.diagnoses.length) {
    out.push("  (NO DIAGNOSIS CODED YET — the physician has not summarized this admission. Propose a COMPLETE draft: PDx + all supported secondary diagnoses + procedures.)");
  }
  for (const x of c.diagnoses) out.push(`  - ${x.code} [${TYPE_LABEL[x.type] ?? x.type}] ${x.name ?? ""}`.trimEnd());
  for (const p of c.procedures) out.push(`  - proc ${p.code} ${p.name ?? ""}${p.day != null ? ` (${d(p.day)})` : ""}`);

  if (c.labs.length) {
    out.push("", "Lab results (day of stay, H/L = abnormal):");
    for (const l of c.labs) {
      out.push(`  ${d(l.day)} ${l.test}: ${l.value}${l.unit ? " " + l.unit : ""}${l.ref ? ` (ref ${l.ref})` : ""}${l.flag ? " " + l.flag : ""}`.replace(/^ {2} /, "  "));
    }
  }
  if (c.drugs.length) {
    out.push("", "Medications / supplies given during admission:");
    for (const m of c.drugs) out.push(`  ${m.name} x${m.qty ?? "-"}${m.firstDay != null ? ` (${d(m.firstDay)}-${d(m.lastDay ?? m.firstDay)})` : ""}`);
  }
  if (c.hints.length) {
    out.push("", "Rule-based evidence already detected (verify, do not copy blindly):");
    for (const h of c.hints) out.push(`  - ${h.code}: ${h.reason}${h.evidence.length ? " | " + h.evidence.join("; ") : ""}`);
  }
  return out.join("\n");
}

/** ข้อความเต็มที่ส่ง AI (แสดงในหน้าจอ "ดูข้อความที่ส่งให้ AI" ด้วย) */
export function buildPrompt(c: DeidentifiedCase): string {
  return `${SYSTEM_PROMPT}\n\n${FORMAT}\n\nCode this inpatient episode:\n\n${buildContext(c)}`;
}
