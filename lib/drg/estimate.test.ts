// ประมาณ DRG 4 ระดับแบบ rw_estimator.py + การรวมผลจัดกลุ่มรายเคสของโหมด hosxp
import { describe, expect, it } from "vitest";
import { demoGroupingHistory } from "@/lib/demo/data";
import { estimate, valOf } from "./estimate";
import { aggregateHistory, type GroupedCase } from "./history";
import type { TdrgTables } from "./tables";

const tables: TdrgTables = {
  source: null,
  isDemo: false,
  rw: new Map([
    ["A", { drg: "A", description: "", rw: 1, wtlos: 6, ot: 15, rw0d: 0.4, of: null }],
    ["B", { drg: "B", description: "", rw: 2, wtlos: 6, ot: 15, rw0d: 0.8, of: null }],
  ]),
};
const c = (drg: string, sdx: string[], hasOr = false, rw: number | null = null): GroupedCase => ({ drg, sdx, hasOr, rw });

describe("aggregateHistory + estimate", () => {
  const cases = [
    ...Array.from({ length: 3 }, () => c("B", ["E87.6", "I10"])),
    ...Array.from({ length: 4 }, () => c("A", [])),
    c("A", ["E87.6"]),
    c("C", ["N18.3"], false, 0.7),
    c("D", [], true, 3),
  ];
  const h = aggregateHistory("J18.9", cases);

  it("แยกระดับตามหมวดโรคร่วม/จำนวน/OR", () => {
    expect(h.t1["E87,I10#0"]).toEqual({ B: 3 });
    expect(h.t2["0#0"]).toEqual({ A: 4 });
    expect(h.t3["1"]).toEqual({ D: 1 });
    expect(h.t4).toEqual({ B: 3, A: 5, C: 1, D: 1 });
    expect(h.drgRw).toEqual({ C: 0.7, D: 3 });
  });
  it("ระดับ 1 ต้อง ≥ 3 ราย", () => {
    const e = estimate(h, "J18.9", ["I10", "E87.6"], 4, false, tables)!;
    expect(e).toMatchObject({ drg: "B", level: 1, n: 3, share: 100, rw: 2, adjrw: 2 });
  });
  it("ไม่พอระดับ 1 → ระดับ 3 (OR/Non-OR เดียวกัน ≥ 5)", () => {
    const e = estimate(h, "J18.9", ["N18.3"], 1, false, tables)!;
    expect(e.level).toBe(3);
    expect(e.drg).toBe("A");
    expect(e.adjrw).toBe(0.4 + (1 * 0.6) / 2);
    expect(e.alts).toEqual(["B", "C"]);
  });
  it("ไม่มีประวัติพอ → null", () => {
    expect(estimate(aggregateHistory("X", [c("A", [])]), "X00", [], 3, false, tables)).toBeNull();
    expect(valOf(null)).toBeNull();
  });
  it("ข้อมูลผลจัดกลุ่มสมมติ (demo) ใช้ประมาณได้", () => {
    const d = demoGroupingHistory("J18.9");
    expect(Object.values(d.t4).reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  });
});
