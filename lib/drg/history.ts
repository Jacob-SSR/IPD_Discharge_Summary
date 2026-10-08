// lib/drg/history.ts
// รวมผลจัดกลุ่มรายเคส (an_stat + iptdiag + iptoprt) เป็นตาราง 4 ระดับแบบ rw_estimator.py ของโปรแกรมเดิม
// ใช้กับโหมด hosxp — โหมด demo อ่านจาก data/tdrg/demo/history.json ที่รวมไว้แล้ว

import type { DrgCounts, GroupingHistory } from "@/lib/patients/types";
import { sdxBucket, sdxCats } from "./estimate";

export interface GroupedCase {
  drg: string;
  rw: number | null;
  /** รหัสโรคร่วม/โรคแทรก/อื่นๆ (diagtype 2–4) */
  sdx: string[];
  hasOr: boolean;
}

const norm = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

function bump(t: Record<string, DrgCounts>, key: string, drg: string) {
  const c = (t[key] ??= {});
  c[drg] = (c[drg] ?? 0) + 1;
}

export function aggregateHistory(pdx: string, cases: GroupedCase[]): GroupingHistory {
  const p = norm(pdx);
  const h: GroupingHistory = { t1: {}, t2: {}, t3: {}, t4: {}, drgRw: {} };
  const rwSum: Record<string, [number, number]> = {};
  for (const c of cases) {
    if (!c.drg) continue;
    const s = c.sdx.map(norm).filter((x) => x && x !== p);
    const o = c.hasOr ? 1 : 0;
    bump(h.t1, `${sdxCats(s)}#${o}`, c.drg);
    bump(h.t2, `${sdxBucket(s.length)}#${o}`, c.drg);
    bump(h.t3, `${o}`, c.drg);
    h.t4[c.drg] = (h.t4[c.drg] ?? 0) + 1;
    if (c.rw != null) {
      const x = (rwSum[c.drg] ??= [0, 0]);
      x[0] += c.rw;
      x[1] += 1;
    }
  }
  for (const [drg, [sum, n]] of Object.entries(rwSum)) h.drgRw[drg] = +(sum / n).toFixed(4);
  return h;
}
