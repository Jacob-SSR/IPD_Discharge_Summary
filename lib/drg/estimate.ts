// lib/drg/estimate.ts
// ประมาณ DRG จากผลจัดกลุ่มจริงย้อนหลังของผู้ป่วยที่ PDx และโรคร่วมคล้ายกัน — port จาก rw_estimator.py
// ไล่ 4 ระดับ ใช้ระดับแรกที่มีเคสพอ แล้วเลือก DRG ที่พบบ่อยที่สุด:
//   1) PDx + หมวดโรคร่วมชุดเดียวกัน + OR/Non-OR เหมือนกัน   (ต้อง ≥ 3 ราย)
//   2) PDx + จำนวนโรคร่วมใกล้เคียง (0/1/2+) + OR/Non-OR     (≥ 5 ราย)
//   3) PDx + OR/Non-OR                                      (≥ 5 ราย)
//   4) PDx เดียวกัน                                          (≥ 5 ราย)
// เป็น "ค่าประมาณ" — ค่าจริงต้องยืนยันด้วย TDRG Seeker หรือหลังลงรหัสใน HOSxP

import type { DrgCounts, GroupingHistory } from "@/lib/patients/types";
import { computeAdjRw } from "./adjrw";
import type { TdrgTables } from "./tables";

export interface Estimate {
  drg: string;
  /** % ของเคสที่ได้ DRG นี้ */
  share: number;
  n: number;
  level: number;
  level_th: string;
  rw: number | null;
  adjrw: number | null;
  note: string;
  /** DRG อื่นที่เป็นไปได้ */
  alts: string[];
}

const norm = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const sdxBucket = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : 2);
export const sdxCats = (sdx: string[]) => [...new Set(sdx.map((x) => norm(x).slice(0, 3)))].sort().join(",");

export function rwOf(drg: string, tables: TdrgTables, history: GroupingHistory): number | null {
  return tables.rw.get(drg)?.rw ?? history.drgRw[drg] ?? null;
}

export function estimate(
  history: GroupingHistory,
  pdx: string,
  sdx: string[],
  los: number | null,
  hasOr: boolean,
  tables: TdrgTables,
): Estimate | null {
  const p = norm(pdx);
  if (!p) return null;
  const s = sdx.map(norm).filter((x) => x && x !== p);
  const o = hasOr ? 1 : 0;
  const tiers: [number, DrgCounts | undefined, number, string][] = [
    [1, history.t1[`${sdxCats(s)}#${o}`], 3, "PDx + โรคร่วมชุดเดียวกัน + OR/Non-OR เหมือนกัน"],
    [2, history.t2[`${sdxBucket(s.length)}#${o}`], 5, "PDx + จำนวนโรคร่วมใกล้เคียง + OR/Non-OR เหมือนกัน"],
    [3, history.t3[`${o}`], 5, "PDx + OR/Non-OR เหมือนกัน"],
    [4, history.t4, 5, "PDx เดียวกัน (ไม่ได้แยกตามหัตถการ)"],
  ];
  for (const [level, counts, need, level_th] of tiers) {
    if (!counts) continue;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total < need) continue;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const drg = ranked[0][0];
    const adj = computeAdjRw(tables.rw.get(drg), los);
    return {
      drg,
      share: Math.round((100 * ranked[0][1]) / total),
      n: total,
      level,
      level_th,
      rw: rwOf(drg, tables, history),
      adjrw: adj.adjrw,
      note: adj.note,
      alts: ranked.slice(1, 3).map((x) => x[0]),
    };
  }
  return null;
}

/** ค่าที่ใช้คิดเงิน: AdjRW ถ้ามี ไม่มีก็ RW */
export const valOf = (e: Estimate | null) => (e ? (e.adjrw ?? e.rw) : null);
