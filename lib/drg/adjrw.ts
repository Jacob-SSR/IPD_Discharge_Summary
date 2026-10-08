// lib/drg/adjrw.ts
// AdjRW ตามเกณฑ์วันนอน TDRG 6.3 — port จาก rw_estimator.py ของโปรแกรมเดิม (สนามลอง AI ให้รหัส)
//   นอน < 24 ชม. (LOS < 1)        → RW0d
//   LOS < ⌈WtLOS/3⌉               → RW0d + LOS × (RW − RW0d) / ⌈WtLOS/3⌉
//   ⌈WtLOS/3⌉ ≤ LOS ≤ OT          → RW
//   LOS > OT                      → ไม่คำนวณ (ต้องยืนยันด้วย TDS/TGrp)
// อ้างอิง: สรท. TDRG 6.3 (เอกสาร สปสช. 25 เม.ย. 2567) — ดู data/tdrg/refs.json
// ⚠️ ค่าในตาราง RW/WtLOS/OT/RW0d ต้องมาจากคู่มือ TDRG 6.3 ตัวจริง (ตาราง demo เป็นค่าสมมติ)

import type { DrgParams } from "./tables";

/** สูตรตรงกับโปรแกรมเดิมแล้ว — แต่ค่าตาราง TDRG ยังต้องยืนยัน */
export const ADJRW_FORMULA_VERIFIED = true;

export interface AdjRwResult {
  adjrw: number | null;
  note: string;
}

export function computeAdjRw(t: DrgParams | undefined, los: number | null): AdjRwResult {
  if (!t || los == null) return { adjrw: null, note: "แสดงเฉพาะ RW" };
  const low = Math.ceil(t.wtlos / 3);
  const rw0d = t.rw0d ?? t.rw;
  if (los < 1) return { adjrw: rw0d, note: "นอน < 24 ชม. ใช้ RW0d" };
  if (los < low) return { adjrw: +(rw0d + (los * (t.rw - rw0d)) / low).toFixed(4), note: `วันนอนน้อยกว่า ${low} วัน (WtLOS/3)` };
  if (los <= t.ot) return { adjrw: t.rw, note: `วันนอนอยู่ในช่วงปกติ (${low}–${t.ot} วัน)` };
  return { adjrw: null, note: `วันนอนเกิน OT (${t.ot} วัน) ต้องยืนยันด้วย TDS/TGrp` };
}
