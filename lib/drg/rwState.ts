// lib/drg/rwState.ts
// DRG/RW ก่อน–หลังลงรหัสที่ยอมรับ — port จาก rwState ของโปรแกรมเดิม

import type { MergedItem } from "@/lib/ai/types";
import type { AdmissionDetail, GroupingHistory } from "@/lib/patients/types";
import { estimate, valOf, type Estimate } from "./estimate";
import type { TdrgTables } from "./tables";

export interface RwState {
  before: Estimate | null;
  after: Estimate | null;
  /** AdjRW หลัง − ก่อน */
  delta: number | null;
}

export function rwState(
  a: Pick<AdmissionDetail, "diagnoses" | "procedures" | "los">,
  accepted: MergedItem[],
  history: { current: GroupingHistory | null; after: GroupingHistory | null },
  tables: TdrgTables,
): RwState {
  const pdx = a.diagnoses.find((d) => d.diagtype === "1")?.icd10 ?? "";
  const sdx = a.diagnoses.filter((d) => ["2", "3", "4"].includes(d.diagtype)).map((d) => d.icd10);
  const accP = accepted.find((s) => s.kind === "dx" && s.diagtype === 1);
  const pA = accP ? accP.code : pdx;
  const sA = sdx.concat(accepted.filter((s) => s.kind === "dx" && [2, 3, 4].includes(s.diagtype ?? 0)).map((s) => s.code));
  const orB = a.procedures.some((x) => x.orType === "OR");
  const orA = orB || accepted.some((s) => s.kind === "proc" && s.procClass === "OR");
  const before = pdx && history.current ? estimate(history.current, pdx, sdx, a.los, orB, tables) : null;
  const after = accepted.length && pA && history.after ? estimate(history.after, pA, sA, a.los, orA, tables) : null;
  const vb = valOf(before);
  const va = valOf(after);
  const delta = before && after && vb != null && va != null ? +(va - vb).toFixed(4) : null;
  return { before, after, delta };
}

/** PDx ที่ต้องใช้ดึงผลจัดกลุ่มย้อนหลัง (ปัจจุบัน / หลังยอมรับ) */
export function rwPdx(a: Pick<AdmissionDetail, "diagnoses">, accepted: MergedItem[]) {
  const current = a.diagnoses.find((d) => d.diagtype === "1")?.icd10 ?? null;
  const after = accepted.find((s) => s.kind === "dx" && s.diagtype === 1)?.code ?? current;
  return { current, after };
}
