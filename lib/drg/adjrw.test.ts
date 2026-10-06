// ทดสอบว่าโค้ดคำนวณ "ตามสูตรที่เขียนไว้ใน adjrw.ts" ถูกต้อง โดยใช้พารามิเตอร์สมมติ
// ⚠️ ยังไม่ใช่การยืนยันว่าสูตรตรงกับ TDRG 6.3 / โปรแกรมเดิม —
//    เมื่อได้ไฟล์ legacy ให้เพิ่ม test ชุด "legacy cases" ด้วยค่าที่คาดหวังจากของเดิม
//    แล้วเปลี่ยน ADJRW_FORMULA_VERIFIED เป็น true
import { describe, expect, it } from "vitest";
import { ADJRW_FORMULA_VERIFIED, computeAdjRw } from "./adjrw";
import type { DrgParams } from "./tables";

const P: DrgParams = { drg: "TEST1", description: "", rw: 1.2, wtlos: 6, ot: 18, rw0d: 0.3, of: 0.5 };

describe("computeAdjRw (สูตรตาม adjrw.ts — พารามิเตอร์สมมติ)", () => {
  it("วันนอนปกติ = RW", () => {
    expect(computeAdjRw(P, 6)).toEqual({ adjrw: 1.2, kind: "normal" });
    expect(computeAdjRw(P, 2)).toEqual({ adjrw: 1.2, kind: "normal" }); // = WtLOS/3 พอดี ไม่ถือว่าสั้น
    expect(computeAdjRw(P, 18)).toEqual({ adjrw: 1.2, kind: "normal" }); // = OT พอดี ไม่ถือว่านาน
  });
  it("นอนสั้น: RW0d + (RW−RW0d)×LOS/(WtLOS/3)", () => {
    expect(computeAdjRw(P, 0)).toEqual({ adjrw: 0.3, kind: "short" });
    expect(computeAdjRw(P, 1)).toEqual({ adjrw: 0.75, kind: "short" });
  });
  it("นอนนาน: RW + (LOS−OT)×of×RW/WtLOS", () => {
    expect(computeAdjRw(P, 24)).toEqual({ adjrw: 1.8, kind: "long" });
  });
  it("ไม่มี RW0d/of → ใช้ RW", () => {
    expect(computeAdjRw({ ...P, rw0d: null, of: null }, 0).adjrw).toBe(1.2);
    expect(computeAdjRw({ ...P, rw0d: null, of: null }, 40).adjrw).toBe(1.2);
  });
  it("สถานะสูตรยังไม่ยืนยัน", () => {
    expect(ADJRW_FORMULA_VERIFIED).toBe(false);
  });
});
