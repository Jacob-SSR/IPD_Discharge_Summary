// lib/ai/merge.ts
// รวมรหัสจากกฎ + AI + แพทย์เพิ่มเอง แล้วตรวจกับ codebook — port จาก merge_and_validate ของโปรแกรมเดิม
// ใช้ได้ทั้งฝั่ง server และ browser (ไม่แตะ DB/fs — codebook ส่งเข้ามาเป็นฟังก์ชัน)

import type { CodeDecision } from "@/lib/appdb/types";
import type { RuleHint } from "@/lib/coding/legacyRules";
import type { AdmissionDetail, OrType } from "@/lib/patients/types";
import type { CodeItem, DeidentifiedCase, HintKind, MergedItem } from "./types";

export const norm = (c: string | null | undefined) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const fmt10 = (c: string) => {
  const n = norm(c);
  return n.length <= 3 ? n : `${n.slice(0, 3)}.${n.slice(3)}`;
};
export const fmt9 = (c: string) => {
  const n = norm(c);
  return n.length <= 2 ? n : `${n.slice(0, 2)}.${n.slice(2)}`;
};
export const itemKey = (kind: HintKind, code: string) => `${kind}|${norm(code)}`;
export const systemOf = (kind: HintKind) => (kind === "dx" ? "ICD10" : "ICD9CM") as "ICD10" | "ICD9CM";
export const kindOf = (system: "ICD10" | "ICD9CM"): HintKind => (system === "ICD10" ? "dx" : "proc");

export interface BookLookup {
  /** ชื่อรหัสจาก codebook (null = ไม่มีในตาราง) */
  name(kind: HintKind, code: string): string | null;
  procClass(code: string): OrType;
}

export type DecisionState = "accepted" | "rejected" | undefined;

/** สถานะล่าสุดของแต่ละ key (ยอมรับ/ไม่ยอมรับ/ยกเลิก) + รายการที่แพทย์เพิ่มเอง */
export function decisionView(decisions: CodeDecision[]) {
  const state = new Map<string, DecisionState>();
  const manual = new Map<string, CodeItem>();
  for (const d of [...decisions].sort((a, b) => a.id - b.id)) {
    const k = itemKey(kindOf(d.system), d.code);
    if (d.source === "manual") {
      if (d.action === "add") {
        manual.set(k, {
          kind: kindOf(d.system),
          code: d.code,
          diagtype: d.diagtype ? Number(d.diagtype) : null,
          reason: "แพทย์เพิ่มเอง",
          evidence: [],
          confidence: 1,
          source: "manual",
          procClass: d.orType,
          procDate: d.opDate,
        });
        state.set(k, "accepted");
      } else if (d.action === "remove") {
        manual.delete(k);
        state.delete(k);
      }
      continue;
    }
    if (d.action === "accept") state.set(k, "accepted");
    else if (d.action === "reject") state.set(k, "rejected");
    else if (d.action === "undo") state.delete(k);
  }
  return { state, manual: [...manual.values()] };
}

/** หลักฐานที่อ้างตรงกับข้อมูลในชาร์ตไหม (กฎหลักฐาน) */
export function evidenceMatcher(c: DeidentifiedCase): (evidence: string[]) => boolean {
  const tokens = [
    ...c.labs.map((l) => l.test),
    ...c.labs.map((l) => l.test.split(/[:\s]+/).pop() ?? ""),
    ...c.drugs.map((d) => d.name.split(" ")[0]),
    ...c.diagnoses.map((d) => d.code),
    ...c.admitDx.map((d) => d.code),
    ...c.procedures.map((p) => p.code),
    ...c.hints.map((h) => h.code),
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  return (evidence) => evidence.some((e) => tokens.some((t) => e.toLowerCase().includes(t)));
}

export function merge(
  a: Pick<AdmissionDetail, "diagnoses" | "procedures">,
  hints: RuleHint[],
  aiItems: CodeItem[] | null,
  manual: CodeItem[],
  book: BookLookup,
  evidenceOk?: (evidence: string[]) => boolean,
): MergedItem[] {
  const haveDx = new Map(a.diagnoses.map((d) => [norm(d.icd10), Number(d.diagtype)]));
  const havePx = new Set(a.procedures.map((x) => norm(x.icd9)));
  type Tmp = CodeItem & { aiName?: string | null };
  const m = new Map<string, Tmp>();

  for (const it0 of [...hints.map((h) => ({ ...h }) as Tmp), ...((aiItems ?? []) as Tmp[])]) {
    const it: Tmp = { ...it0, evidence: [...(it0.evidence ?? [])] };
    const c = norm(it.code);
    if (!c) continue;
    it.confidence = Math.max(0, Math.min(1, Number(it.confidence) || 0));
    const k = `${it.kind}|${c}`;
    const x = m.get(k);
    if (x) {
      if (x.source !== it.source) x.source = "ai+rule";
      x.confidence = Math.min(1, Math.max(x.confidence, it.confidence) + 0.1);
      x.evidence = [...new Set([...x.evidence, ...it.evidence])];
      if (it.source === "ai") {
        if (it.reason) x.reason = it.reason;
        if (it.name) x.aiName = it.name;
        if (it.diagtype) x.diagtype = it.diagtype;
        delete x.origin;
      }
    } else {
      if (it.source === "ai") it.aiName = it.name;
      m.set(k, it);
    }
  }

  const aiRan = [...m.values()].some((v) => v.source !== "rule");
  if (aiRan) {
    // รหัสจาก ER ที่ AI ไม่เลือก และรหัสกว้างๆ จากกฎที่ AI มีรหัสหมวดเดียวกันที่เจาะจงกว่า → ไม่แสดงซ้ำ
    const cats = new Set([...m.values()].filter((v) => v.source !== "rule" && v.kind === "dx").map((v) => norm(v.code).slice(0, 3)));
    const dm = [...cats].some((c) => /^E1[0-4]/.test(c));
    const anemia = [...cats].some((c) => /^(D5|D6[0-4])/.test(c));
    for (const [k, v] of [...m]) {
      if (
        v.source === "rule" &&
        (v.origin === "admit" ||
          (v.kind === "dx" &&
            (cats.has(norm(v.code).slice(0, 3)) || (dm && norm(v.code).startsWith("R73")) || (anemia && norm(v.code).startsWith("D649")))))
      )
        m.delete(k);
    }
  }
  if ([...m.values()].some((v) => v.kind === "dx" && v.source !== "rule" && "VWXY".includes(norm(v.code)[0]))) {
    for (const [k, v] of [...m]) if (v.source === "rule" && v.diagtype === 5) m.delete(k);
  }

  const out: MergedItem[] = [];
  for (const it of m.values()) {
    const c = norm(it.code);
    const dx = it.kind === "dx";
    const code = dx ? fmt10(c) : fmt9(c);
    const bookName = book.name(it.kind, code);
    let already = dx ? haveDx.has(c) : havePx.has(c);
    let reason = it.reason;
    if (dx && already && it.diagtype === 1 && haveDx.get(c) !== 1) {
      already = false;
      reason = `[แนะนำเปลี่ยนเป็น PDx] ${reason}`;
    }
    out.push({
      ...it,
      code,
      reason,
      key: `${it.kind}|${c}`,
      formatOk: dx ? /^[A-Z]\d\d[0-9A-Z]{0,2}$/.test(c) : /^\d{2,4}$/.test(c),
      inBook: bookName != null,
      name: bookName ?? it.aiName ?? null,
      already,
      procClass: dx ? null : (it.procClass ?? book.procClass(code)),
      evidenceUnmatched: it.source === "ai" && !already && !!evidenceOk && !evidenceOk(it.evidence),
    });
  }
  for (const mm of manual) {
    const k = itemKey(mm.kind, mm.code);
    const i = out.findIndex((o) => o.key === k);
    if (i >= 0) out.splice(i, 1);
    out.push({
      ...mm,
      key: k,
      source: "manual",
      reason: "แพทย์เพิ่มเอง",
      evidence: [],
      confidence: 1,
      formatOk: true,
      inBook: book.name(mm.kind, mm.code) != null,
      name: book.name(mm.kind, mm.code),
      already: false,
      procClass: mm.kind === "proc" ? (mm.procClass ?? book.procClass(mm.code)) : null,
      evidenceUnmatched: false,
    });
  }
  const pdxFirst = (x: MergedItem) => (x.diagtype === 1 ? 0 : 1);
  return out.sort(
    (x, y) =>
      (x.kind === "dx" ? 0 : 1) - (y.kind === "dx" ? 0 : 1) ||
      Number(x.already) - Number(y.already) ||
      pdxFirst(x) - pdxFirst(y) ||
      y.confidence - x.confidence,
  );
}

/** รหัสที่แพทย์ยืนยัน (ยอมรับจากข้อเสนอ หรือเพิ่มเอง) และยังไม่มีใน HOSxP */
export function acceptedItems(list: MergedItem[], state: Map<string, DecisionState>): MergedItem[] {
  return list.filter((s) => state.get(s.key) === "accepted" && !s.already);
}
