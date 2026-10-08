// สูตร AdjRW ตาม rw_estimator.py ของโปรแกรมเดิม (ค่าที่คาดหวังคำนวณตามสูตรเดิม — พารามิเตอร์สมมติ)
import { describe, expect, it } from "vitest";
import { ADJRW_FORMULA_VERIFIED, computeAdjRw } from "./adjrw";
import type { DrgParams } from "./tables";

const P: DrgParams = { drg: "TEST1", description: "", rw: 1.2, wtlos: 6, ot: 18, rw0d: 0.3, of: 0.5 };

describe("computeAdjRw (โปรแกรมเดิม)", () => {
  it("นอน < 24 ชม. = RW0d", () => {
    expect(computeAdjRw(P, 0)).toEqual({ adjrw: 0.3, note: "นอน < 24 ชม. ใช้ RW0d" });
  });
  it("LOS < ⌈WtLOS/3⌉ → RW0d + LOS×(RW−RW0d)/⌈WtLOS/3⌉", () => {
    expect(computeAdjRw(P, 1)).toEqual({ adjrw: 0.75, note: "วันนอนน้อยกว่า 2 วัน (WtLOS/3)" });
    expect(computeAdjRw({ ...P, wtlos: 7 }, 2).adjrw).toBe(0.9); // ⌈7/3⌉ = 3
  });
  it("⌈WtLOS/3⌉ ≤ LOS ≤ OT → RW", () => {
    expect(computeAdjRw(P, 2)).toEqual({ adjrw: 1.2, note: "วันนอนอยู่ในช่วงปกติ (2–18 วัน)" });
    expect(computeAdjRw(P, 18).adjrw).toBe(1.2);
  });
  it("เกิน OT → ไม่คำนวณ ต้องยืนยันด้วย TDS/TGrp", () => {
    expect(computeAdjRw(P, 19)).toEqual({ adjrw: null, note: "วันนอนเกิน OT (18 วัน) ต้องยืนยันด้วย TDS/TGrp" });
  });
  it("ไม่มีในตาราง / ไม่ทราบวันนอน → แสดงเฉพาะ RW", () => {
    expect(computeAdjRw(undefined, 3)).toEqual({ adjrw: null, note: "แสดงเฉพาะ RW" });
    expect(computeAdjRw(P, null).adjrw).toBeNull();
  });
  it("สูตรตรงกับโปรแกรมเดิม", () => {
    expect(ADJRW_FORMULA_VERIFIED).toBe(true);
  });
});
