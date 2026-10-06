import { describe, expect, it } from "vitest";
import type { CodeDecision } from "@/lib/appdb/types";
import { buildFinalCodes, codesToClipboardText, latestDecisions, suggestionState } from "@/lib/coding/final";
import { fiscalYearBE, fiscalYearRange, formatThaiDate, quickRange } from "@/lib/date";
import { buildDemoAdmissions } from "@/lib/demo/data";
import { matchesFilter } from "@/lib/demo/source";
import { buildListWhere } from "@/lib/hosxp/queries";
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
    const { where, params } = buildListWhere({ admitFrom: "2026-01-01", dischargeTo: "2026-02-01", pdxDoctor: "D1", pending: true, pendingStatus: "noPdx" });
    expect(where).toContain("i.regdate >= ?");
    expect(where).toContain("i.dchdate <= ?");
    expect(where).toContain("x.doctor = ?");
    expect(where).toContain("NOT EXISTS");
    expect(params).toEqual(["2026-01-01", "2026-02-01", "D1"]);
  });
  it("แท็บรอสรุปไม่มีช่วงวัน → จำกัด 1 ปี", () => {
    const { where, params } = buildListWhere({ pending: true });
    expect(where).toContain("i.regdate >= ?");
    expect(where).toContain("OR i.dchdate IS NULL");
    expect(params).toHaveLength(1);
  });
  it("demo: รอสรุป = ไม่มี PDx หรือยังนอนอยู่", () => {
    const all = buildDemoAdmissions("2026-10-06");
    const pending = all.filter((a) => matchesFilter(a, { pending: true })).map((a) => a.an);
    expect(pending.sort()).toEqual(["690000021", "690000022", "690000023"]);
    expect(all.filter((a) => matchesFilter(a, { pending: true, pendingStatus: "noPdx" })).map((a) => a.an).sort()).toEqual(["690000021", "690000022"]);
  });
});

describe("ชุดรหัสสุดท้าย", () => {
  const a = { diagnoses: [{ icd10: "J18.9", diagtype: "1" as const, name: "Pneumonia", doctorCode: null, doctorName: null }], procedures: [] };
  it("รวม HOSxP + ยอมรับ + เพิ่มเอง และการตัดสินใจล่าสุดชนะ", () => {
    const decisions = [
      D({ id: 1, action: "accept" }),
      D({ id: 2, code: "D64.9", action: "accept" }),
      D({ id: 3, code: "D64.9", action: "reject" }),
      D({ id: 4, code: "99.04", system: "ICD9CM", source: "manual", action: "add", diagtype: null, orType: "NonOR" }),
      D({ id: 5, code: "B96.2", source: "manual", action: "add" }),
      D({ id: 6, code: "B96.2", source: "manual", action: "remove" }),
    ];
    expect(buildFinalCodes(a, decisions).map((c) => `${c.code}:${c.origin}`)).toEqual(["J18.9:hosxp", "E87.6:rules", "99.04:manual"]);
    const latest = latestDecisions(decisions);
    expect(suggestionState(latest, "1", "ICD10", "D64.9")).toBe("rejected");
    expect(suggestionState(latest, "1", "ICD10", "X00")).toBe("pending");
    expect(suggestionState(latest, "2", "ICD10", "E87.6")).toBe("pending");
  });
  it("ข้อความคัดลอกไปลง HOSxP", () => {
    const text = codesToClipboardText(buildFinalCodes(a, [D({}), D({ id: 2, code: "99.04", system: "ICD9CM", source: "manual", action: "add", diagtype: null, orType: "OR" })]));
    expect(text).toBe("PDx: J18.9\nComorbidity: E87.6\nICD-9-CM: 99.04 (OR)");
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
