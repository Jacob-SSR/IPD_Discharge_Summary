// lib/drg/adjrw.ts
// สูตร AdjRW (ปรับค่าน้ำหนักตามวันนอน) — โครงตาม TDRG version 6
//   นอนสั้น   LOS < WtLOS/3 : AdjRW = RW0d + (RW − RW0d) × LOS / (WtLOS/3)
//   นอนนาน   LOS > OT      : AdjRW = RW + (LOS − OT) × of × RW / WtLOS
//   ปกติ                    : AdjRW = RW
//
// ⚠️ ADJRW_FORMULA_VERIFIED = false
//    สูตรนี้ยังไม่ได้เทียบกับโปรแกรมเดิม (legacy) และคู่มือ TDRG 6.3 ฉบับที่โรงพยาบาลใช้
//    เพราะยังไม่ได้รับไฟล์ IPD_Discharge_Summary.zip — ห้ามใช้ตัดสินใจทางการเงินจนกว่าจะยืนยัน
//    และเพิ่ม unit test ด้วยเคสจริงจากของเดิม (ดู lib/drg/adjrw.test.ts)
//    AdjRW "จริง" ของระบบมาจาก an_stat (ผล grouper ของ HOSxP) ไม่ใช่จากสูตรนี้

import type { DrgParams } from "./tables";

export const ADJRW_FORMULA_VERIFIED = false;

export type LosKind = "short" | "normal" | "long";

export interface AdjRwResult {
  adjrw: number;
  kind: LosKind;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function computeAdjRw(p: DrgParams, losDays: number): AdjRwResult {
  const los = Math.max(0, losDays);
  const lowTrim = p.wtlos / 3;
  if (p.rw0d != null && los < lowTrim && lowTrim > 0) {
    return { adjrw: round4(p.rw0d + ((p.rw - p.rw0d) * los) / lowTrim), kind: "short" };
  }
  if (p.of != null && los > p.ot && p.wtlos > 0) {
    return { adjrw: round4(p.rw + ((los - p.ot) * p.of * p.rw) / p.wtlos), kind: "long" };
  }
  return { adjrw: round4(p.rw), kind: "normal" };
}
