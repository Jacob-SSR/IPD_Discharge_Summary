import { describe, expect, it } from "vitest";
import type { CodeDecision } from "@/lib/appdb/types";
import { acceptedItems, decisionView, merge, type BookLookup } from "@/lib/ai/merge";
import { acceptedLabel, copyText, finalCodes } from "@/lib/coding/final";
import { fiscalYearBE, fiscalYearRange, formatThaiDate, quickRange } from "@/lib/date";
import { buildDemoAdmissions } from "@/lib/demo/data";
import { matchesFilter } from "@/lib/demo/source";
import { buildListWhere, splitIcd9 } from "@/lib/hosxp/queries";
import { parseFilter } from "@/lib/patients/filter";
import { buildRwReport } from "@/lib/reports/rw";

const D = (o: Partial<CodeDecision>): CodeDecision => ({
  id: 1, an: "1", code: "E87.6", system: "ICD10", source: "rules", action: "accept", diagtype: "2",
  orType: null, opDate: null, provider: "rules", model: null, aiRunId: 1, decidedBy: "u", decidedAt: "", ...o,
});

describe("วันที่ พ.ศ. / ปีงบประมาณ", () => {
  it("แสดง พ.ศ.", () => expect(formatThaiDate("2026-10-06")).toBe("6 ต.ค. 2569"));
  it("ปีงบเริ่ม 1 ต.ค.", () => {
    expect(fiscalYearBE("2026-09-30")).toBe(2569);
    expect(fiscalYearBE("2026-10-01")).toBe(2570);
    expect(fiscalYearRange(2570)).toEqual({ from: "2026-10-01", to: "2027-09-30" });
  });
  it("ช่วงด่วน", () => {
    expect(quickRange("lastMonth", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(quickRange("thisFiscalYear", "2026-03-15")).toEqual({ from: "2025-10-01", to: "2026-03-15" });
  });
});

describe("ตัวกรองรายชื่อ", () => {
  it("parseFilter ตัดค่าแปลกปลอม", () => {
    const f = parseFilter(new URLSearchParams("admitFrom=2026-01-01&admitTo=bad&ward=W01';--&q=12a&pending=1&pendingStatus=x"));
    expect(f).toMatchObject({ admitFrom: "2026-01-01", admitTo: undefined, ward: undefined, q: undefined, pending: true, pendingStatus: "all" });
  });
  it("SQL ใช้ placeholder ทุกค่า และแยกช่วง admit / จำหน่าย", () => {
    const { where, params } = buildListWhere({ admitFrom: "2026-01-01", dischargeTo: "2026-02-01", pdxDoctor: "D1", pending: true, pendingStatus: "noPdx" }, { admitDoctor: "admdoctor" });
    expect(where).toContain("i.regdate >= ?");
    expect(where).toContain("i.dchdate <= ?");
    expect(where).toContain("x.doctor = ?");
    expect(where).toContain("NOT EXISTS");
    expect(params).toEqual(["2026-01-01", "2026-02-01", "D1"]);
  });
  it("ไม่มีคอลัมน์แพทย์ผู้รับไว้ → กรองแล้วไม่คืนทุกคน", () => {
    expect(buildListWhere({ admitDoctor: "D1", q: "1" }, { admitDoctor: null }).where).toContain("1 = 0");
    expect(buildListWhere({ admitDoctor: "D1", q: "1" }, { admitDoctor: "incharge_doctor" }).where).toContain("i.incharge_doctor = ?");
  });
  it("รหัสหัตถการมี extension ต่อท้าย", () => {
    expect(splitIcd9("990401")).toEqual({ icd9: "99.04", ext: "01" });
    expect(splitIcd9("9904")).toEqual({ icd9: "99.04", ext: null });
    expect(splitIcd9("47.09")).toEqual({ icd9: "47.09", ext: null });
  });
  it("แท็บรอสรุปไม่มีช่วงวัน → จำกัด 1 ปี", () => {
    const { where, params } = buildListWhere({ pending: true }, { admitDoctor: "admdoctor" });
    expect(where).toContain("i.regdate >= ?");
    expect(where).toContain("OR i.dchdate IS NULL");
    expect(params).toHaveLength(1);
  });
  it("demo: รอสรุป = ไม่มี PDx หรือยังนอนอยู่", () => {
    const all = buildDemoAdmissions("2026-10-06");
    const pending = all.filter((a) => matchesFilter(a, { pending: true })).map((a) => a.an);
    const noPdx = ["690001259", "690001400", "690001401", "690001402", "690001403"];
    expect(pending.sort()).toEqual(noPdx);
    expect(all.filter((a) => matchesFilter(a, { pending: true, pendingStatus: "noPdx" })).map((a) => a.an).sort()).toEqual(noPdx);
    expect(all.filter((a) => matchesFilter(a, { pending: true, pendingStatus: "admitted" })).map((a) => a.an).sort()).toEqual(["690001402", "690001403"]);
  });
});

describe("ชุดรหัสในแบบฟอร์ม (renderForm ของโปรแกรมเดิม)", () => {
  const a = { diagnoses: [{ icd10: "J18.9", diagtype: "1" as const, name: "Pneumonia", doctorCode: null, doctorName: null }], procedures: [] };
  const book: BookLookup = { name: () => null, procClass: (c) => (c.startsWith("99") ? "NonOR" : "OR") };
  const items = merge(
    a,
    [],
    [
      { kind: "dx", code: "E87.6", diagtype: 2, reason: "", evidence: [], confidence: 0.8, source: "ai" },
      { kind: "dx", code: "A41.9", diagtype: 1, reason: "", evidence: [], confidence: 0.7, source: "ai" },
      { kind: "dx", code: "D64.9", diagtype: 2, reason: "", evidence: [], confidence: 0.5, source: "ai" },
    ],
    [],
    book,
  );
  const decisions = [
    D({ id: 1, action: "accept" }),
    D({ id: 2, code: "D64.9", action: "accept" }),
    D({ id: 3, code: "D64.9", action: "undo" }),
    D({ id: 4, code: "A41.9", action: "accept", diagtype: "1" }),
    D({ id: 5, code: "99.04", system: "ICD9CM", source: "manual", action: "add", diagtype: null, orType: "NonOR" }),
  ];
  const view = decisionView(decisions);
  const all = merge(a, [], items.filter((x) => x.source !== "manual"), view.manual, book);
  const acc = acceptedItems(all, view.state);

  it("HOSxP + ยืนยันจาก AI + แพทย์เพิ่ม · PDx เดิมที่ถูกแทนขีดฆ่า", () => {
    const { dx, px } = finalCodes(a, acc);
    expect(dx.map((c) => `${c.code}:${c.origin}${c.replaced ? ":replaced" : ""}`)).toEqual(["A41.9:ai", "E87.6:ai", "J18.9:hosxp:replaced"]);
    expect(px.map((c) => `${c.code}:${c.origin}:${c.orType}`)).toEqual(["99.04:manual:NonOR"]);
  });
  it("ข้อความรหัสที่ยอมรับ + คัดลอก", () => {
    expect(acceptedLabel(acc)).toBe("A41.9 (PDx), E87.6 (Comorbidity), 99.04 [หัตถการ]");
    expect(copyText(acc)).toBe("A41.9 E87.6 99.04");
  });
});

describe("รายงาน RW/CMI", () => {
  it("CMI = รวม AdjRW / จำนวนที่มี AdjRW", () => {
    const r = buildRwReport(
      [
        { an: "1", dischargeDate: "2026-01-05", wardCode: "W1", wardName: "A", dischargeDoctor: null, drg: "X", rw: 1, adjrw: 1.2, los: 3 },
        { an: "2", dischargeDate: "2026-01-06", wardCode: "W1", wardName: "A", dischargeDoctor: null, drg: "Y", rw: 0.5, adjrw: 0.6, los: 2 },
        { an: "3", dischargeDate: "2026-02-01", wardCode: "W2", wardName: "B", dischargeDoctor: null, drg: null, rw: null, adjrw: null, los: 1 },
      ],
      "2026-01-01",
      "2026-02-28",
    );
    expect(r.totals).toMatchObject({ n: 3, nWithRw: 2, sumAdjRw: 1.8, cmi: 0.9, nMissingDrg: 1, estimatedRevenue: Math.round(1.8 * 8350) });
    expect(r.byMonth.map((m) => m.key)).toEqual(["2026-01", "2026-02"]);
  });
});
