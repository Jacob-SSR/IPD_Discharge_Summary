import { describe, expect, it } from "vitest";
import { estimateGroup, pickGroup } from "./estimate";
import type { TdrgTables } from "./tables";
import type { HistoricalGroup } from "@/lib/patients/types";

const groups: HistoricalGroup[] = [
  { drg: "G0", n: 100, avgRw: 0.8, avgAdjRw: 0.82, hasOr: false, avgSdx: 0 },
  { drg: "G1", n: 50, avgRw: 1.2, avgAdjRw: 1.25, hasOr: false, avgSdx: 2 },
  { drg: "G2", n: 10, avgRw: 2.5, avgAdjRw: 2.6, hasOr: true, avgSdx: 1 },
];
const noTables: TdrgTables = { source: null, isDemo: false, rw: new Map(), orp: new Set() };

describe("estimate", () => {
  it("เลือกกลุ่มตามจำนวน SDx และ OR", () => {
    expect(pickGroup(groups, { pdx: "X", sdxCount: 0, hasOr: false, los: 3 })?.drg).toBe("G0");
    expect(pickGroup(groups, { pdx: "X", sdxCount: 2, hasOr: false, los: 3 })?.drg).toBe("G1");
    expect(pickGroup(groups, { pdx: "X", sdxCount: 0, hasOr: true, los: 3 })?.drg).toBe("G2");
  });
  it("ไม่มีตาราง TDRG → ใช้ค่าเฉลี่ยย้อนหลัง", () => {
    const e = estimateGroup(groups, { pdx: "X", sdxCount: 2, hasOr: false, los: 4 }, noTables);
    expect(e).toMatchObject({ drg: "G1", rw: 1.2, adjrw: 1.25, adjrwFrom: "history" });
  });
  it("มีตาราง TDRG → ใช้สูตร", () => {
    const t: TdrgTables = {
      ...noTables,
      rw: new Map([["G1", { drg: "G1", description: "", rw: 1.2, wtlos: 6, ot: 18, rw0d: 0.3, of: 0.5 }]]),
    };
    expect(estimateGroup(groups, { pdx: "X", sdxCount: 2, hasOr: false, los: 24 }, t)).toMatchObject({ rw: 1.2, adjrw: 1.8, adjrwFrom: "formula" });
  });
  it("ไม่มี PDx / ไม่มีประวัติ", () => {
    expect(estimateGroup(groups, { pdx: null, sdxCount: 0, hasOr: null, los: 1 }, noTables).drg).toBeNull();
    expect(estimateGroup([], { pdx: "X", sdxCount: 0, hasOr: null, los: 1 }, noTables).drg).toBeNull();
  });
});
